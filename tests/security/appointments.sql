\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email)
values
  ('20000000-0000-4000-8000-000000000001', 'scheduler@example.test'),
  ('20000000-0000-4000-8000-000000000002', 'professional@example.test');

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', true);
select set_config('pixelbloom.test.clinic', public.create_organization('Agenda de Teste', 'fixture-agenda')::text, true);
select set_config('pixelbloom.test.other_clinic', public.create_organization('Outra Agenda', 'fixture-outra-agenda')::text, true);

reset role;
insert into public.organization_memberships (organization_id, profile_id, role)
values (current_setting('pixelbloom.test.clinic')::uuid, '20000000-0000-4000-8000-000000000002', 'professional');

set local role authenticated;

do $$
declare
  clinic uuid := current_setting('pixelbloom.test.clinic')::uuid;
  other_clinic uuid := current_setting('pixelbloom.test.other_clinic')::uuid;
  patient uuid;
  other_patient uuid;
  professional uuid;
  service uuid;
  appointment uuid;
  second_appointment uuid;
  begins timestamptz := '2099-11-22 14:00:00+00';
begin
  insert into public.patients (organization_id, display_name)
  values (clinic, 'Paciente vinculado') returning id into patient;
  insert into public.patients (organization_id, display_name)
  values (clinic, 'Paciente sem vínculo');
  insert into public.patients (organization_id, display_name)
  values (other_clinic, 'Paciente de outra clínica') returning id into other_patient;
  insert into public.professionals (organization_id, profile_id, display_name)
  values (clinic, '20000000-0000-4000-8000-000000000002', 'Profissional sintético') returning id into professional;
  insert into public.professional_patients (organization_id, professional_id, patient_id)
  values (clinic, professional, patient);
  insert into public.services (organization_id, name, duration_minutes)
  values (clinic, 'Atendimento de teste', 30) returning id into service;

  appointment := public.create_appointment(clinic, patient, professional, service, begins);
  if not exists (
    select from public.appointments where id = appointment and end_at = begins + interval '30 minutes'
  ) then
    raise exception 'Appointment end should be computed from service duration';
  end if;
  begin
    perform public.create_appointment(clinic, patient, professional, service, begins + interval '15 minutes');
    raise exception 'Overlapping appointment was accepted';
  exception when exclusion_violation then
    null;
  end;
  begin
    perform public.create_appointment(clinic, other_patient, professional, service, begins + interval '1 hour');
    raise exception 'Patient from another organization was accepted';
  exception when invalid_parameter_value then
    null;
  end;
  second_appointment := public.create_appointment(clinic, patient, professional, service, begins + interval '30 minutes');
  begin
    perform public.reschedule_appointment(clinic, second_appointment, begins + interval '15 minutes');
    raise exception 'Reschedule accepted a conflict';
  exception when exclusion_violation then
    null;
  end;
  perform public.reschedule_appointment(clinic, second_appointment, begins + interval '1 hour');
  perform public.confirm_appointment(clinic, second_appointment);
  perform public.confirm_appointment(clinic, second_appointment);

  if not exists (
    select from public.appointments
    where id = second_appointment and start_at = begins + interval '1 hour'
      and end_at = begins + interval '90 minutes' and status = 'confirmed'
  ) then
    raise exception 'Rescheduling and confirmation did not preserve appointment duration and state';
  end if;
  perform public.cancel_appointment(clinic, appointment, 'Cancelamento sintético');
  if not exists (select from public.appointments where id = appointment and status = 'canceled') then
    raise exception 'Cancellation did not persist';
  end if;
  perform public.create_appointment(clinic, patient, professional, service, begins);
end;
$$;

select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
do $$
begin
  if (select count(*) from public.patients) <> 1
    or not exists (select from public.patients where display_name = 'Paciente vinculado') then
    raise exception 'Professional access has to be limited to assigned patients';
  end if;
  if (select count(*) from public.appointments where status = 'scheduled') <> 1 then
    raise exception 'Professional should be able to see its own schedule';
  end if;
end;
$$;

rollback;
