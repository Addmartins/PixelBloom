begin;

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  name text not null check (char_length(btrim(name)) between 2 and 100),
  description text check (char_length(description) <= 1000),
  instructions text check (char_length(instructions) <= 4000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table public.patient_activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  patient_id uuid not null,
  activity_id uuid not null,
  status text not null default 'assigned' check (status in ('assigned', 'completed')),
  assigned_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check ((status = 'completed') = (completed_at is not null)),
  foreign key (organization_id, patient_id) references public.patients (organization_id, id),
  foreign key (organization_id, activity_id) references public.activities (organization_id, id),
  foreign key (organization_id, assigned_by) references public.organization_memberships (organization_id, profile_id)
);
create index patient_activities_by_patient on public.patient_activities (organization_id, patient_id, created_at desc);
create index patient_activities_by_activity on public.patient_activities (organization_id, activity_id);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  title text not null check (char_length(btrim(title)) between 2 and 150),
  content text not null check (char_length(btrim(content)) between 1 and 4000),
  published_at timestamptz not null default now(),
  expiration_at timestamptz check (expiration_at > published_at),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index announcements_by_organization on public.announcements (organization_id, published_at desc);

create function pixelbloom_private.can_read_activity(p_organization_id uuid, p_activity_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.patient_activities assignment
    where assignment.organization_id = p_organization_id and assignment.activity_id = p_activity_id
      and (pixelbloom_private.is_own_patient(p_organization_id, assignment.patient_id)
        or pixelbloom_private.is_authorized_guardian(p_organization_id, assignment.patient_id))
  );
$$;

create function public.complete_patient_activity(p_organization_id uuid, p_assignment_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not pixelbloom_private.plan_feature_enabled(p_organization_id, 'activities')
    or pixelbloom_private.role_for(p_organization_id) is distinct from 'patient'::public.membership_role then
    raise exception 'Operação sem autorização' using errcode = '42501';
  end if;

  update public.patient_activities
  set status = 'completed', completed_at = now()
  where organization_id = p_organization_id and id = p_assignment_id and status = 'assigned'
    and pixelbloom_private.is_own_patient(p_organization_id, patient_id);

  if not found and not exists (
    select 1 from public.patient_activities
    where organization_id = p_organization_id and id = p_assignment_id and status = 'completed'
      and pixelbloom_private.is_own_patient(p_organization_id, patient_id)
  ) then
    raise exception 'Atividade indisponível' using errcode = '22023';
  end if;
end;
$$;

create function public.link_patient_profile(p_organization_id uuid, p_patient_id uuid, p_profile_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce(pixelbloom_private.role_for(p_organization_id) in ('owner', 'admin'), false) then
    raise exception 'Operação sem autorização' using errcode = '42501';
  end if;

  if p_profile_id is not null and not exists (
    select 1 from public.organization_memberships
    where organization_id = p_organization_id and profile_id = p_profile_id and role = 'patient' and status = 'active'
  ) then
    raise exception 'Vínculo de paciente indisponível' using errcode = '22023';
  end if;

  update public.patients set profile_id = p_profile_id
  where organization_id = p_organization_id and id = p_patient_id;
  if not found then
    raise exception 'Paciente indisponível' using errcode = '22023';
  end if;
end;
$$;

create trigger audit_activities after insert or update on public.activities
for each row execute function pixelbloom_private.audit_change();
create trigger audit_patient_activities after insert or update on public.patient_activities
for each row execute function pixelbloom_private.audit_change();
create trigger audit_announcements after insert or update on public.announcements
for each row execute function pixelbloom_private.audit_change();

alter table public.activities enable row level security;
alter table public.patient_activities enable row level security;
alter table public.announcements enable row level security;

create policy activities_select on public.activities for select to authenticated
using (
  pixelbloom_private.plan_feature_enabled(organization_id, 'activities') and (
    pixelbloom_private.role_for(organization_id) in ('owner', 'admin', 'professional')
    or pixelbloom_private.can_read_activity(organization_id, id)
  )
);
create policy activities_insert on public.activities for insert to authenticated
with check (
  pixelbloom_private.plan_feature_enabled(organization_id, 'activities')
  and pixelbloom_private.role_for(organization_id) in ('owner', 'admin')
);
create policy activities_update on public.activities for update to authenticated
using (
  pixelbloom_private.plan_feature_enabled(organization_id, 'activities')
  and pixelbloom_private.role_for(organization_id) in ('owner', 'admin')
)
with check (
  pixelbloom_private.plan_feature_enabled(organization_id, 'activities')
  and pixelbloom_private.role_for(organization_id) in ('owner', 'admin')
);

create policy patient_activities_select on public.patient_activities for select to authenticated
using (
  pixelbloom_private.plan_feature_enabled(organization_id, 'activities') and (
    pixelbloom_private.role_for(organization_id) in ('owner', 'admin')
    or pixelbloom_private.is_assigned_patient(organization_id, patient_id)
    or pixelbloom_private.is_own_patient(organization_id, patient_id)
    or pixelbloom_private.is_authorized_guardian(organization_id, patient_id)
  )
);
create policy patient_activities_insert on public.patient_activities for insert to authenticated
with check (
  pixelbloom_private.plan_feature_enabled(organization_id, 'activities') and (
    pixelbloom_private.role_for(organization_id) in ('owner', 'admin')
    or pixelbloom_private.is_assigned_patient(organization_id, patient_id)
  )
  and exists (
    select 1 from public.activities catalog
    where catalog.organization_id = patient_activities.organization_id
      and catalog.id = patient_activities.activity_id and catalog.active
  )
  and exists (
    select 1 from public.patients patient
    where patient.organization_id = patient_activities.organization_id
      and patient.id = patient_activities.patient_id and patient.active
  )
);

create policy announcements_select on public.announcements for select to authenticated
using (
  pixelbloom_private.plan_feature_enabled(organization_id, 'announcements') and (
    pixelbloom_private.role_for(organization_id) in ('owner', 'admin')
    or (active and published_at <= now() and (expiration_at is null or expiration_at > now()))
  )
);
create policy announcements_insert on public.announcements for insert to authenticated
with check (
  pixelbloom_private.plan_feature_enabled(organization_id, 'announcements')
  and pixelbloom_private.role_for(organization_id) in ('owner', 'admin')
);
create policy announcements_update on public.announcements for update to authenticated
using (
  pixelbloom_private.plan_feature_enabled(organization_id, 'announcements')
  and pixelbloom_private.role_for(organization_id) in ('owner', 'admin')
)
with check (
  pixelbloom_private.plan_feature_enabled(organization_id, 'announcements')
  and pixelbloom_private.role_for(organization_id) in ('owner', 'admin')
);

revoke all on public.activities, public.patient_activities, public.announcements from public, anon, authenticated;
grant select on public.activities, public.patient_activities, public.announcements to authenticated;
grant insert (organization_id, name, description, instructions, active),
  update (name, description, instructions, active) on public.activities to authenticated;
grant insert (organization_id, patient_id, activity_id) on public.patient_activities to authenticated;
grant insert (organization_id, title, content, published_at, expiration_at, active),
  update (title, content, published_at, expiration_at, active) on public.announcements to authenticated;

revoke all on function pixelbloom_private.can_read_activity(uuid, uuid), public.complete_patient_activity(uuid, uuid),
  public.link_patient_profile(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function pixelbloom_private.can_read_activity(uuid, uuid), public.complete_patient_activity(uuid, uuid),
  public.link_patient_profile(uuid, uuid, uuid) to authenticated;

commit;
