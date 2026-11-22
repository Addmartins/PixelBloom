begin;

create table public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  email text not null check (email = lower(btrim(email)) and char_length(email) between 3 and 254),
  role public.membership_role not null check (role <> 'owner'),
  token_hash bytea not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  expires_at timestamptz not null,
  invited_by uuid not null,
  created_at timestamptz not null default now(),
  foreign key (organization_id, invited_by) references public.organization_memberships (organization_id, profile_id)
);
create index organization_invites_organization_idx on public.organization_invites (organization_id, created_at desc);

create table public.guardians (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  profile_id uuid,
  display_name text not null check (char_length(btrim(display_name)) between 2 and 100),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, profile_id),
  foreign key (organization_id, profile_id) references public.organization_memberships (organization_id, profile_id)
);
create table public.patient_guardians (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  patient_id uuid not null,
  guardian_id uuid not null,
  relationship text not null check (char_length(btrim(relationship)) between 2 and 100),
  authorization_status text not null default 'pending'
    check (authorization_status in ('pending', 'authorized', 'revoked')),
  created_at timestamptz not null default now(),
  unique (organization_id, patient_id, guardian_id),
  foreign key (organization_id, patient_id) references public.patients (organization_id, id),
  foreign key (organization_id, guardian_id) references public.guardians (organization_id, id)
);
create index patient_guardians_by_guardian on public.patient_guardians (organization_id, guardian_id);

create function pixelbloom_private.is_own_guardian(p_organization_id uuid, p_guardian_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.guardians
    where organization_id = p_organization_id and id = p_guardian_id
      and profile_id = (select auth.uid())
      and pixelbloom_private.role_for(p_organization_id) = 'guardian'
  );
$$;

create function pixelbloom_private.is_authorized_guardian(p_organization_id uuid, p_patient_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.patient_guardians link
    join public.patients patient on patient.organization_id = link.organization_id and patient.id = link.patient_id
    where link.organization_id = p_organization_id and link.patient_id = p_patient_id
      and link.authorization_status = 'authorized' and patient.active
      and pixelbloom_private.is_own_guardian(p_organization_id, link.guardian_id)
  );
$$;

create function public.create_organization_invite(p_organization_id uuid, p_email text, p_role public.membership_role)
returns text language plpgsql security definer set search_path = '' as $$
declare
  actor_role public.membership_role := pixelbloom_private.role_for(p_organization_id);
  normalized_email text := lower(btrim(p_email));
  token text;
begin
  if not coalesce(
    (actor_role = 'owner' and p_role <> 'owner')
    or (actor_role = 'admin' and p_role in ('reception', 'professional', 'guardian', 'patient')), false
  ) then
    raise exception 'Operação sem autorização' using errcode = '42501';
  end if;

  if normalized_email is null or normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
    raise exception 'Email inválido' using errcode = '22023';
  end if;

  token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.organization_invites (organization_id, email, role, token_hash, expires_at, invited_by)
  values (p_organization_id, normalized_email, p_role, sha256(convert_to(token, 'UTF8')), now() + interval '72 hours', auth.uid());
  return token;
end;
$$;

create function public.accept_organization_invite(p_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  accepted_invite public.organization_invites;
  now_at_acceptance timestamptz := clock_timestamp();
begin
  if not pixelbloom_private.current_profile_is_active() then
    raise exception 'Sessão sem autorização' using errcode = '42501';
  end if;

  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    raise exception 'Convite indisponível' using errcode = '22023';
  end if;

  update public.organization_invites invite
  set status = 'accepted'
  where invite.token_hash = sha256(convert_to(p_token, 'UTF8'))
    and invite.status = 'pending'
    and invite.expires_at > now_at_acceptance
    and exists (
      select 1 from auth.users
      where id = actor and lower(email) = invite.email and email_confirmed_at is not null
    )
    and exists (
      select 1 from public.organizations
      where id = invite.organization_id and status = 'active'
    )
    and exists (
      select 1 from public.organization_memberships issuer
      join auth.users issuer_user on issuer_user.id = issuer.profile_id
      where issuer.organization_id = invite.organization_id and issuer.profile_id = invite.invited_by
        and issuer.status = 'active'
        and issuer_user.deleted_at is null
        and (issuer_user.banned_until is null or issuer_user.banned_until <= now_at_acceptance)
        and (issuer.role = 'owner' or
          (issuer.role = 'admin' and invite.role in ('reception', 'professional', 'guardian', 'patient')))
    )
  returning * into accepted_invite;
  if not found then
    raise exception 'Convite indisponível' using errcode = '22023';
  end if;

  insert into public.organization_memberships (organization_id, profile_id, role)
  values (accepted_invite.organization_id, actor, accepted_invite.role)
  on conflict (organization_id, profile_id) do nothing;
  if not found then
    raise exception 'A organização já possui um vínculo para esta conta' using errcode = '22023';
  end if;

  return accepted_invite.organization_id;
end;
$$;

create function public.revoke_organization_invite(p_organization_id uuid, p_invite_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor_role public.membership_role := pixelbloom_private.role_for(p_organization_id);
begin
  if not coalesce(actor_role in ('owner', 'admin'), false) then
    raise exception 'Operação sem autorização' using errcode = '42501';
  end if;

  update public.organization_invites
  set status = 'revoked'
  where id = p_invite_id and organization_id = p_organization_id and status = 'pending'
    and (actor_role = 'owner' or invited_by = auth.uid());

  if not found then
    raise exception 'Convite indisponível' using errcode = '22023';
  end if;
end;
$$;

create trigger audit_organization_invites after insert or update on public.organization_invites
for each row execute function pixelbloom_private.audit_change();
create trigger audit_guardians after insert or update on public.guardians
for each row execute function pixelbloom_private.audit_change();
create trigger audit_patient_guardians after insert or update on public.patient_guardians
for each row execute function pixelbloom_private.audit_change();

alter table public.organization_invites enable row level security;
alter table public.guardians enable row level security;
alter table public.patient_guardians enable row level security;

create policy invites_select on public.organization_invites for select to authenticated
using (pixelbloom_private.role_for(organization_id) in ('owner', 'admin'));

create policy guardians_select on public.guardians for select to authenticated
using (
  pixelbloom_private.role_for(organization_id) in ('owner', 'admin', 'reception')
  or pixelbloom_private.is_own_guardian(organization_id, id)
);
create policy guardians_insert on public.guardians for insert to authenticated
with check (pixelbloom_private.role_for(organization_id) in ('owner', 'admin'));
create policy guardians_update on public.guardians for update to authenticated
using (pixelbloom_private.role_for(organization_id) in ('owner', 'admin'))
with check (pixelbloom_private.role_for(organization_id) in ('owner', 'admin'));

create policy patient_guardians_select on public.patient_guardians for select to authenticated
using (
  pixelbloom_private.role_for(organization_id) in ('owner', 'admin', 'reception')
  or (
    authorization_status = 'authorized'
    and pixelbloom_private.is_own_guardian(organization_id, guardian_id)
  )
);
create policy patient_guardians_insert on public.patient_guardians for insert to authenticated
with check (pixelbloom_private.role_for(organization_id) in ('owner', 'admin'));
create policy patient_guardians_update on public.patient_guardians for update to authenticated
using (pixelbloom_private.role_for(organization_id) in ('owner', 'admin'))
with check (pixelbloom_private.role_for(organization_id) in ('owner', 'admin'));

create policy patients_select_authorized_guardian on public.patients for select to authenticated
using (pixelbloom_private.is_authorized_guardian(organization_id, id));

revoke all on public.organization_invites, public.guardians, public.patient_guardians from public, anon, authenticated;
grant select (id, organization_id, email, role, status, expires_at, invited_by, created_at)
on public.organization_invites to authenticated;
grant select on public.guardians, public.patient_guardians to authenticated;
grant insert (organization_id, profile_id, display_name), update (profile_id, display_name)
on public.guardians to authenticated;
grant insert (organization_id, patient_id, guardian_id, relationship, authorization_status),
  update (relationship, authorization_status) on public.patient_guardians to authenticated;

revoke all on function pixelbloom_private.is_own_guardian(uuid, uuid),
  pixelbloom_private.is_authorized_guardian(uuid, uuid),
  public.create_organization_invite(uuid, text, public.membership_role),
  public.accept_organization_invite(text),
  public.revoke_organization_invite(uuid, uuid) from public, anon, authenticated;
grant execute on function pixelbloom_private.is_own_guardian(uuid, uuid),
  pixelbloom_private.is_authorized_guardian(uuid, uuid),
  public.create_organization_invite(uuid, text, public.membership_role),
  public.accept_organization_invite(text),
  public.revoke_organization_invite(uuid, uuid) to authenticated;

commit;
