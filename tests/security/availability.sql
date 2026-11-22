\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email)
values ('92000000-0000-4000-8000-000000000001', 'owner-availability@example.test');

set local role authenticated;
select set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000001', true);
select set_config('pixelbloom.test.availability_org', public.create_organization('Clínica Disponibilidade', 'fixture-disponibilidade')::text, true);

select public.update_organization_timezone(current_setting('pixelbloom.test.availability_org')::uuid, 'America/Manaus');
insert into public.patients (organization_id, display_name)
values (current_setting('pixelbloom.test.availability_org')::uuid, 'Paciente sintético');
insert into public.professionals (organization_id, display_name)
values (current_setting('pixelbloom.test.availability_org')::uuid, 'Profissional sintético');
insert into public.services (organization_id, name, duration_minutes)
values (current_setting('pixelbloom.test.availability_org')::uuid, 'Serviço sintético', 30);

insert into public.professional_availability (organization_id, professional_id, weekday, start_time, end_time)
select organization_id, id, extract(dow from date '2099-01-05'), '08:00', '09:00'
from public.professionals where organization_id = current_setting('pixelbloom.test.availability_org')::uuid;

insert into public.organization_holidays (organization_id, day, name)
values (current_setting('pixelbloom.test.availability_org')::uuid, '2099-01-12', 'Fechamento sintético');

do $$
declare
  org uuid := current_setting('pixelbloom.test.availability_org')::uuid;
  patient uuid := (select id from public.patients where organization_id = org);
  professional uuid := (select id from public.professionals where organization_id = org);
  service uuid := (select id from public.services where organization_id = org);
  booking uuid;
begin
  if not exists (select from public.organizations where id = org and settings ->> 'timezone' = 'America/Manaus') then
    raise exception 'Organization timezone update was not persisted';
  end if;

  begin
    perform public.create_appointment(org, patient, professional, service, '2099-01-05 11:30:00+00');
    raise exception 'An appointment was accepted before the configured window';
  exception when sqlstate 'PBA01' then null;
  end;

  booking := public.create_appointment(org, patient, professional, service, '2099-01-05 12:00:00+00');

  begin
    perform public.reschedule_appointment(org, booking, '2099-01-05 12:31:00+00');
    raise exception 'Rescheduling to a time that ends outside the availability window succeeded';
  exception when sqlstate 'PBA01' then null;
  end;

  begin
    perform public.reschedule_appointment(org, booking, '2099-01-12 12:00:00+00');
    raise exception 'Rescheduling to a clinic closure date succeeded';
  exception when sqlstate 'PBA01' then null;
  end;

  if (select start_at from public.appointments where id = booking) is distinct from '2099-01-05 12:00:00+00'::timestamptz then
    raise exception 'Failed rescheduling changed the existing appointment';
  end if;

  delete from public.organization_holidays where organization_id = org and day = '2099-01-12';
  perform public.reschedule_appointment(org, booking, '2099-01-12 12:30:00+00');
end;
$$;

rollback;
