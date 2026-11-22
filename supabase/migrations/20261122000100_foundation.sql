begin;

create schema pixelbloom_private;
revoke all on schema pixelbloom_private from public;
grant usage on schema pixelbloom_private to authenticated;

create type public.membership_role as enum (
  'owner', 'admin', 'manager', 'reception', 'professional', 'guardian', 'patient'
);
create type public.membership_status as enum ('active', 'revoked');
create type public.organization_status as enum ('active', 'suspended');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 100),
  email text not null,
  avatar text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 100),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 64),
  logo_url text,
  settings jsonb not null default '{"timezone":"America/Recife"}' check (jsonb_typeof(settings) = 'object'),
  status public.organization_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  profile_id uuid not null references public.profiles(id),
  role public.membership_role not null,
  status public.membership_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, profile_id)
);
create index organization_memberships_profile_idx
  on public.organization_memberships (profile_id, organization_id)
  where status = 'active';

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  actor_id uuid,
  action text not null,
  resource_type text not null,
  resource_id uuid not null,
  created_at timestamptz not null default now()
);
create index audit_logs_by_organization on public.audit_logs (organization_id, created_at desc);

create function pixelbloom_private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function pixelbloom_private.sync_auth_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name, email)
  values (
    new.id,
    coalesce(nullif(left(btrim(new.raw_user_meta_data ->> 'display_name'), 100), ''), 'Usuário'),
    coalesce(new.email, '')
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

create trigger sync_auth_profile
after insert or update of email on auth.users
for each row execute function pixelbloom_private.sync_auth_profile();

insert into public.profiles (id, display_name, email)
select id,
       coalesce(nullif(left(btrim(raw_user_meta_data ->> 'display_name'), 100), ''), 'Usuário'),
       coalesce(email, '')
from auth.users
on conflict (id) do nothing;

create function pixelbloom_private.current_profile_is_active()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users
    where id = (select auth.uid())
      and deleted_at is null
      and (banned_until is null or banned_until <= now())
  );
$$;

create function pixelbloom_private.role_for(p_organization_id uuid)
returns public.membership_role language sql stable security definer set search_path = '' as $$
  select membership.role
  from public.organization_memberships membership
  join public.organizations organization on organization.id = membership.organization_id
  where membership.organization_id = p_organization_id
    and membership.profile_id = (select auth.uid())
    and membership.status = 'active'
    and organization.status = 'active'
    and (select pixelbloom_private.current_profile_is_active());
$$;

create function pixelbloom_private.audit_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  event_row jsonb;
begin
  event_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  insert into public.audit_logs (organization_id, actor_id, action, resource_type, resource_id)
  values (
    coalesce(event_row ->> 'organization_id', event_row ->> 'id')::uuid,
    auth.uid(), lower(tg_op), tg_table_name, (event_row ->> 'id')::uuid
  );
  return null;
end;
$$;

create function public.create_organization(p_name text, p_slug text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  new_organization_id uuid;
begin
  if not pixelbloom_private.current_profile_is_active() then
    raise exception 'Sessão sem autorização' using errcode = '42501';
  end if;

  insert into public.organizations (name, slug)
  values (btrim(p_name), lower(btrim(p_slug)))
  returning id into new_organization_id;

  insert into public.organization_memberships (organization_id, profile_id, role)
  values (new_organization_id, actor, 'owner');

  return new_organization_id;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
for each row execute function pixelbloom_private.touch_updated_at();
create trigger organizations_updated_at before update on public.organizations
for each row execute function pixelbloom_private.touch_updated_at();
create trigger memberships_updated_at before update on public.organization_memberships
for each row execute function pixelbloom_private.touch_updated_at();
create trigger audit_organizations after insert or update on public.organizations
for each row execute function pixelbloom_private.audit_change();
create trigger audit_memberships after insert or update or delete on public.organization_memberships
for each row execute function pixelbloom_private.audit_change();

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_select on public.profiles for select to authenticated
using (id = (select auth.uid()) and (select pixelbloom_private.current_profile_is_active()));

create policy profiles_update on public.profiles for update to authenticated
using (id = (select auth.uid()) and (select pixelbloom_private.current_profile_is_active()))
with check (id = (select auth.uid()) and (select pixelbloom_private.current_profile_is_active()));

create policy organizations_select on public.organizations for select to authenticated
using (pixelbloom_private.role_for(id) is not null);

create policy organizations_update on public.organizations for update to authenticated
using (pixelbloom_private.role_for(id) in ('owner', 'admin'))
with check (pixelbloom_private.role_for(id) in ('owner', 'admin'));

create policy memberships_select on public.organization_memberships for select to authenticated
using (
  (profile_id = (select auth.uid()) and status = 'active' and pixelbloom_private.role_for(organization_id) is not null)
  or pixelbloom_private.role_for(organization_id) in ('owner', 'admin')
);

create policy audit_logs_select on public.audit_logs for select to authenticated
using (pixelbloom_private.role_for(organization_id) = 'owner');

revoke all on public.profiles, public.organizations, public.organization_memberships, public.audit_logs
from public, anon, authenticated;
grant select on public.profiles, public.organizations, public.organization_memberships, public.audit_logs to authenticated;
grant update (display_name, avatar) on public.profiles to authenticated;
grant update (name, logo_url, settings) on public.organizations to authenticated;

revoke all on all functions in schema pixelbloom_private from public, anon, authenticated;
grant execute on function pixelbloom_private.current_profile_is_active() to authenticated;
grant execute on function pixelbloom_private.role_for(uuid) to authenticated;
revoke all on function public.create_organization(text, text) from public, anon, authenticated;
grant execute on function public.create_organization(text, text) to authenticated;

commit;
