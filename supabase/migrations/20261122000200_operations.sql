begin;

create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;
set local search_path = public, extensions, pg_catalog;

create type public.appointment_status as enum ('scheduled', 'confirmed', 'completed', 'canceled');

create table public.services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null check (char_length(btrim(name)) between 2 and 100),
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  description text check (char_length(description) <= 1000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table public.professionals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  profile_id uuid,
  display_name text not null check (char_length(btrim(display_name)) between 2 and 100),
  registration_number text check (char_length(registration_number) <= 60),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, profile_id),
  foreign key (organization_id, profile_id) references public.organization_memberships (organization_id, profile_id)
);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  profile_id uuid,
  display_name text not null check (char_length(btrim(display_name)) between 2 and 100),
  preferences jsonb not null default '{}' check (jsonb_typeof(preferences) = 'object'),
  accessibility_settings jsonb not null default '{}' check (jsonb_typeof(accessibility_settings) = 'object'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, profile_id),
  foreign key (organization_id, profile_id) references public.organization_memberships (organization_id, profile_id)
);

create table public.professional_patients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  professional_id uuid not null,
  patient_id uuid not null,
  created_at timestamptz not null default now(),
  unique (organization_id, professional_id, patient_id),
  foreign key (organization_id, professional_id) references public.professionals (organization_id, id),
  foreign key (organization_id, patient_id) references public.patients (organization_id, id)
);
create index professional_patients_by_patient on public.professional_patients (organization_id, patient_id);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  patient_id uuid not null,
  professional_id uuid not null,
  service_id uuid not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status public.appointment_status not null default 'scheduled',
  created_by uuid not null,
  cancellation_reason text check (char_length(cancellation_reason) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at and isfinite(start_at) and isfinite(end_at)),
  check ((status = 'canceled') = (cancellation_reason is not null)),
  foreign key (organization_id, patient_id) references public.patients (organization_id, id),
  foreign key (organization_id, professional_id) references public.professionals (organization_id, id),
  foreign key (organization_id, service_id) references public.services (organization_id, id),
  foreign key (organization_id, created_by) references public.organization_memberships (organization_id, profile_id),
  exclude using gist (
    organization_id with =, professional_id with =, tstzrange(start_at, end_at, '[)') with &&
  ) where (status <> 'canceled'),
  exclude using gist (
    organization_id with =, patient_id with =, tstzrange(start_at, end_at, '[)') with &&
  ) where (status <> 'canceled')
);
create index appointments_calendar_idx on public.appointments (organization_id, start_at);
create index appointments_patient_idx on public.appointments (organization_id, patient_id, start_at);
create index appointments_professional_idx on public.appointments (organization_id, professional_id, start_at);
create index appointments_service_idx on public.appointments (organization_id, service_id);

create function pixelbloom_private.is_own_professional(p_organization_id uuid, p_professional_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.professionals
    where organization_id = p_organization_id and id = p_professional_id
      and profile_id = (select auth.uid()) and active
      and pixelbloom_private.role_for(p_organization_id) = 'professional'
  );
$$;

create function pixelbloom_private.is_own_patient(p_organization_id uuid, p_patient_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.patients
    where organization_id = p_organization_id and id = p_patient_id
      and profile_id = (select auth.uid()) and active
      and pixelbloom_private.role_for(p_organization_id) = 'patient'
  );
$$;

create function pixelbloom_private.is_assigned_patient(p_organization_id uuid, p_patient_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.professional_patients
    where organization_id = p_organization_id and patient_id = p_patient_id
      and pixelbloom_private.is_own_professional(p_organization_id, professional_id)
  );
$$;

create function public.create_appointment(
  p_organization_id uuid, p_patient_id uuid, p_professional_id uuid, p_service_id uuid, p_start_at timestamptz
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  service_duration integer;
  new_appointment_id uuid;
begin
  if not coalesce(pixelbloom_private.role_for(p_organization_id) in ('owner', 'admin', 'manager', 'reception'), false) then
    raise exception 'Operação sem autorização' using errcode = '42501';
  end if;

  perform 1 from public.patients
  where organization_id = p_organization_id and id = p_patient_id and active for share;
  if not found then
    raise exception 'Paciente indisponível para agendamento' using errcode = '22023';
  end if;

  perform 1 from public.professionals
  where organization_id = p_organization_id and id = p_professional_id and active for share;
  if not found then
    raise exception 'Profissional indisponível para agendamento' using errcode = '22023';
  end if;

  select duration_minutes into service_duration from public.services
  where organization_id = p_organization_id and id = p_service_id and active for share;
  if not found then
    raise exception 'Serviço indisponível para agendamento' using errcode = '22023';
  end if;

  insert into public.appointments (organization_id, patient_id, professional_id, service_id, start_at, end_at, created_by)
  values (
    p_organization_id, p_patient_id, p_professional_id, p_service_id, p_start_at,
    p_start_at + make_interval(mins => service_duration), auth.uid()
  ) returning id into new_appointment_id;

  return new_appointment_id;
end;
$$;

create function public.cancel_appointment(p_organization_id uuid, p_appointment_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce(pixelbloom_private.role_for(p_organization_id) in ('owner', 'admin', 'manager', 'reception'), false) then
    raise exception 'Operação sem autorização' using errcode = '42501';
  end if;

  if p_reason is null or char_length(btrim(p_reason)) not between 1 and 500 then
    raise exception 'Informe o motivo do cancelamento' using errcode = '22023';
  end if;

  update public.appointments
  set status = 'canceled', cancellation_reason = btrim(p_reason)
  where organization_id = p_organization_id and id = p_appointment_id and status in ('scheduled', 'confirmed');

  if not found then
    raise exception 'Agendamento indisponível para cancelamento' using errcode = '22023';
  end if;
end;
$$;

create trigger patients_updated_at before update on public.patients
for each row execute function pixelbloom_private.touch_updated_at();
create trigger appointments_updated_at before update on public.appointments
for each row execute function pixelbloom_private.touch_updated_at();

create trigger audit_services after insert or update on public.services
for each row execute function pixelbloom_private.audit_change();
create trigger audit_professionals after insert or update on public.professionals
for each row execute function pixelbloom_private.audit_change();
create trigger audit_patients after insert or update on public.patients
for each row execute function pixelbloom_private.audit_change();
create trigger audit_professional_patients after insert or delete on public.professional_patients
for each row execute function pixelbloom_private.audit_change();
create trigger audit_appointments after insert or update on public.appointments
for each row execute function pixelbloom_private.audit_change();

alter table public.services enable row level security;
alter table public.professionals enable row level security;
alter table public.patients enable row level security;
alter table public.professional_patients enable row level security;
alter table public.appointments enable row level security;

create policy services_select on public.services for select to authenticated
using (pixelbloom_private.role_for(organization_id) in ('owner', 'admin', 'manager', 'reception', 'professional'));
create policy services_insert on public.services for insert to authenticated
with check (pixelbloom_private.role_for(organization_id) in ('owner', 'admin'));
create policy services_update on public.services for update to authenticated
using (pixelbloom_private.role_for(organization_id) in ('owner', 'admin'))
with check (pixelbloom_private.role_for(organization_id) in ('owner', 'admin'));

create policy professionals_select on public.professionals for select to authenticated
using (
  pixelbloom_private.role_for(organization_id) in ('owner', 'admin', 'manager', 'reception')
  or pixelbloom_private.is_own_professional(organization_id, id)
);
create policy professionals_insert on public.professionals for insert to authenticated
with check (pixelbloom_private.role_for(organization_id) in ('owner', 'admin'));
create policy professionals_update on public.professionals for update to authenticated
using (pixelbloom_private.role_for(organization_id) in ('owner', 'admin'))
with check (pixelbloom_private.role_for(organization_id) in ('owner', 'admin'));

create policy patients_select on public.patients for select to authenticated
using (
  pixelbloom_private.role_for(organization_id) in ('owner', 'admin', 'manager', 'reception')
  or pixelbloom_private.is_own_patient(organization_id, id)
  or pixelbloom_private.is_assigned_patient(organization_id, id)
);
create policy patients_insert on public.patients for insert to authenticated
with check (pixelbloom_private.role_for(organization_id) in ('owner', 'admin', 'reception'));
create policy patients_update on public.patients for update to authenticated
using (pixelbloom_private.role_for(organization_id) in ('owner', 'admin', 'reception'))
with check (pixelbloom_private.role_for(organization_id) in ('owner', 'admin', 'reception'));

create policy professional_patients_select on public.professional_patients for select to authenticated
using (
  pixelbloom_private.role_for(organization_id) in ('owner', 'admin')
  or pixelbloom_private.is_own_professional(organization_id, professional_id)
);
create policy professional_patients_insert on public.professional_patients for insert to authenticated
with check (pixelbloom_private.role_for(organization_id) in ('owner', 'admin'));
create policy professional_patients_delete on public.professional_patients for delete to authenticated
using (pixelbloom_private.role_for(organization_id) in ('owner', 'admin'));

create policy appointments_select on public.appointments for select to authenticated
using (
  pixelbloom_private.role_for(organization_id) in ('owner', 'admin', 'manager', 'reception')
  or pixelbloom_private.is_own_professional(organization_id, professional_id)
  or pixelbloom_private.is_own_patient(organization_id, patient_id)
);

revoke all on public.services, public.professionals, public.patients, public.professional_patients, public.appointments
from public, anon, authenticated;
grant select on public.services, public.professionals, public.patients, public.professional_patients, public.appointments to authenticated;
grant insert (organization_id, name, duration_minutes, description, active), update (name, duration_minutes, description, active)
on public.services to authenticated;
grant insert (organization_id, profile_id, display_name, registration_number, active), update (profile_id, display_name, registration_number, active)
on public.professionals to authenticated;
grant insert (organization_id, display_name, preferences, accessibility_settings, active), update (display_name, preferences, accessibility_settings, active)
on public.patients to authenticated;
grant insert (organization_id, professional_id, patient_id), delete on public.professional_patients to authenticated;

revoke all on function pixelbloom_private.is_own_professional(uuid, uuid), pixelbloom_private.is_own_patient(uuid, uuid),
  pixelbloom_private.is_assigned_patient(uuid, uuid), public.create_appointment(uuid, uuid, uuid, uuid, timestamptz),
  public.cancel_appointment(uuid, uuid, text) from public, anon, authenticated;
grant execute on function pixelbloom_private.is_own_professional(uuid, uuid), pixelbloom_private.is_own_patient(uuid, uuid),
  pixelbloom_private.is_assigned_patient(uuid, uuid), public.create_appointment(uuid, uuid, uuid, uuid, timestamptz),
  public.cancel_appointment(uuid, uuid, text) to authenticated;

commit;
