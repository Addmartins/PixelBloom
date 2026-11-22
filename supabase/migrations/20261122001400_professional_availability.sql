begin;

create table public.professional_availability (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  professional_id uuid not null,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  active boolean not null default true,
  check (end_time > start_time),
  unique (organization_id, professional_id, weekday, start_time, end_time),
  foreign key (organization_id, professional_id) references public.professionals (organization_id, id)
);

create table public.organization_holidays (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  day date not null check (isfinite(day)),
  name text not null check (char_length(btrim(name)) between 2 and 100),
  unique (organization_id, day)
);

create function pixelbloom_private.check_appointment_availability()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  clinic_timezone text;
  local_start timestamp;
  local_end timestamp;
  local_day date;
begin
  if new.start_at is null or new.end_at is null
    or not isfinite(new.start_at) or not isfinite(new.end_at) then
    return new;
  end if;

  select settings ->> 'timezone' into clinic_timezone from public.organizations where id = new.organization_id;
  if clinic_timezone is null or not exists (
    select 1 from pg_catalog.pg_timezone_names where name = clinic_timezone
  ) then
    clinic_timezone := 'America/Recife';
  end if;

  local_start := new.start_at at time zone clinic_timezone;
  local_end := new.end_at at time zone clinic_timezone;
  local_day := local_start::date;

  if exists (
    select 1 from public.organization_holidays
    where organization_id = new.organization_id
      and day::timestamp < local_end and day + interval '1 day' > local_start
  ) then
    raise exception 'A clínica está fechada nesse feriado' using errcode = 'PBA01';
  end if;

  if exists (
    select 1 from public.professional_availability
    where organization_id = new.organization_id and professional_id = new.professional_id and active
  ) and not exists (
    select 1 from public.professional_availability
    where organization_id = new.organization_id and professional_id = new.professional_id and active
      and weekday = extract(dow from local_start)
      and local_day + start_time <= local_start and local_day + end_time >= local_end
      and local_end > local_start
  ) then
    raise exception 'Período fora da disponibilidade do profissional' using errcode = 'PBA01';
  end if;

  return new;
end;
$$;

create trigger appointments_availability
before insert or update of start_at, end_at on public.appointments
for each row execute function pixelbloom_private.check_appointment_availability();

create trigger audit_professional_availability after insert or update or delete on public.professional_availability
for each row execute function pixelbloom_private.audit_change();
create trigger audit_organization_holidays after insert or update or delete on public.organization_holidays
for each row execute function pixelbloom_private.audit_change();

alter table public.professional_availability enable row level security;
alter table public.organization_holidays enable row level security;

create policy professional_availability_select on public.professional_availability for select to authenticated
using (
  pixelbloom_private.role_for(organization_id) in ('owner', 'admin', 'manager', 'reception')
  or pixelbloom_private.is_own_professional(organization_id, professional_id)
);
create policy professional_availability_insert on public.professional_availability for insert to authenticated
with check (pixelbloom_private.role_for(organization_id) in ('owner', 'admin'));
create policy professional_availability_update on public.professional_availability for update to authenticated
using (pixelbloom_private.role_for(organization_id) in ('owner', 'admin'))
with check (pixelbloom_private.role_for(organization_id) in ('owner', 'admin'));
create policy professional_availability_delete on public.professional_availability for delete to authenticated
using (pixelbloom_private.role_for(organization_id) in ('owner', 'admin'));

create policy organization_holidays_select on public.organization_holidays for select to authenticated
using (pixelbloom_private.role_for(organization_id) is not null);
create policy organization_holidays_insert on public.organization_holidays for insert to authenticated
with check (pixelbloom_private.role_for(organization_id) in ('owner', 'admin'));
create policy organization_holidays_delete on public.organization_holidays for delete to authenticated
using (pixelbloom_private.role_for(organization_id) in ('owner', 'admin'));

revoke all on public.professional_availability, public.organization_holidays from public, anon, authenticated;
grant select, delete on public.professional_availability, public.organization_holidays to authenticated;
grant insert (organization_id, professional_id, weekday, start_time, end_time, active),
  update (weekday, start_time, end_time, active) on public.professional_availability to authenticated;
grant insert (organization_id, day, name) on public.organization_holidays to authenticated;

revoke all on function pixelbloom_private.check_appointment_availability() from public, anon, authenticated;

commit;
