begin;

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_]*$'),
  name text not null check (char_length(btrim(name)) between 2 and 100),
  features jsonb not null default '{}' check (jsonb_typeof(features) = 'object'),
  limits jsonb not null default '{}' check (jsonb_typeof(limits) = 'object'),
  active boolean not null default true
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  plan_id uuid not null references public.plans (id),
  status text not null check (status in ('trialing', 'active', 'past_due', 'ended')),
  external_reference text,
  billing_period text check (billing_period in ('monthly', 'yearly', 'contract')),
  started_at timestamptz not null default now(),
  ends_at timestamptz check (ends_at > started_at),
  created_at timestamptz not null default now()
);
create unique index subscriptions_current_by_organization
  on public.subscriptions (organization_id) where status <> 'ended';
create index subscriptions_history on public.subscriptions (organization_id, started_at desc);

insert into public.plans (name, code, features)
values
  ('Starter', 'starter', '{"agenda":true,"patients":true,"operations":true}'),
  ('Growth', 'growth', '{"agenda":true,"patients":true,"operations":true,"activities":true,"announcements":true}'),
  ('Pro', 'pro', '{"agenda":true,"patients":true,"operations":true,"activities":true,"announcements":true,"pixel_world":true}'),
  ('Enterprise', 'enterprise', '{"agenda":true,"patients":true,"operations":true,"activities":true,"announcements":true,"pixel_world":true}');

insert into public.subscriptions (organization_id, plan_id, status)
select organization.id, plan.id, 'active'
from public.organizations organization cross join public.plans plan where plan.code = 'starter';

create function pixelbloom_private.provision_starter_subscription()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.subscriptions (organization_id, plan_id, status)
  values (new.id, (select id from public.plans where code = 'starter'), 'active');
  return null;
end;
$$;
create trigger provision_starter_subscription after insert on public.organizations
for each row execute function pixelbloom_private.provision_starter_subscription();

create function pixelbloom_private.plan_feature_enabled(p_organization_id uuid, p_feature text)
returns boolean language sql stable security definer set search_path = '' as $$
  select pixelbloom_private.role_for(p_organization_id) is not null and exists (
    select 1 from public.subscriptions subscription
    join public.plans plan on plan.id = subscription.plan_id
    where subscription.organization_id = p_organization_id
      and subscription.status in ('trialing', 'active')
      and (subscription.ends_at is null or subscription.ends_at > now())
      and plan.features -> p_feature = 'true'::jsonb
  );
$$;

alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;

create policy plans_select on public.plans for select to authenticated
using (active and (select pixelbloom_private.current_profile_is_active()));

create policy subscriptions_select on public.subscriptions for select to authenticated
using (pixelbloom_private.role_for(organization_id) = 'owner');

revoke all on public.plans, public.subscriptions from public, anon, authenticated;
grant select on public.plans to authenticated;
grant select (id, organization_id, plan_id, status, billing_period, started_at, ends_at, created_at)
on public.subscriptions to authenticated;

revoke all on function pixelbloom_private.provision_starter_subscription(),
  pixelbloom_private.plan_feature_enabled(uuid, text) from public, anon, authenticated;
grant execute on function pixelbloom_private.plan_feature_enabled(uuid, text) to authenticated;

commit;
