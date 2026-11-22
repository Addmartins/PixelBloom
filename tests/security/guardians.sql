\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email)
values
  ('91000000-0000-4000-8000-000000000001', 'owner-guardians@example.test'),
  ('91000000-0000-4000-8000-000000000002', 'guardian@example.test');

set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true);
select set_config('pixelbloom.test.guardian_org', public.create_organization('Clínica Responsáveis', 'fixture-responsaveis')::text, true);

insert into public.patients (organization_id, display_name)
values
  (current_setting('pixelbloom.test.guardian_org')::uuid, 'Paciente vinculado'),
  (current_setting('pixelbloom.test.guardian_org')::uuid, 'Paciente sem vínculo');
insert into public.professionals (organization_id, display_name)
values (current_setting('pixelbloom.test.guardian_org')::uuid, 'Profissional sintético');
insert into public.services (organization_id, name, duration_minutes)
values (current_setting('pixelbloom.test.guardian_org')::uuid, 'Serviço sintético', 30);

select set_config('pixelbloom.test.linked_patient', (
  select id::text from public.patients where organization_id = current_setting('pixelbloom.test.guardian_org')::uuid
    and display_name = 'Paciente vinculado'
), true);

select public.create_appointment(
  patient.organization_id,
  patient.id,
  (select id from public.professionals where organization_id = patient.organization_id),
  (select id from public.services where organization_id = patient.organization_id),
  now() + case when patient.id = current_setting('pixelbloom.test.linked_patient')::uuid then '1 day'::interval else '2 days'::interval end
)
from public.patients patient
where patient.organization_id = current_setting('pixelbloom.test.guardian_org')::uuid;

reset role;
insert into public.organization_memberships (organization_id, profile_id, role)
values (current_setting('pixelbloom.test.guardian_org')::uuid, '91000000-0000-4000-8000-000000000002', 'guardian');

set local role authenticated;
insert into public.guardians (organization_id, profile_id, display_name)
values (current_setting('pixelbloom.test.guardian_org')::uuid, '91000000-0000-4000-8000-000000000002', 'Responsável sintético');

insert into public.patient_guardians (organization_id, patient_id, guardian_id, relationship, authorization_status)
values (
  current_setting('pixelbloom.test.guardian_org')::uuid, current_setting('pixelbloom.test.linked_patient')::uuid,
  (select id from public.guardians where organization_id = current_setting('pixelbloom.test.guardian_org')::uuid),
  'Responsável autorizado', 'authorized'
);

select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000002', true);

do $$
declare
  org uuid := current_setting('pixelbloom.test.guardian_org')::uuid;
  linked_patient uuid := current_setting('pixelbloom.test.linked_patient')::uuid;
begin
  if exists (select from public.appointments where organization_id = org) then
    raise exception 'Guardian can read administrative appointment records';
  end if;

  if (select count(*) from public.list_guardian_appointments(org)) <> 1
    or not exists (select from public.list_guardian_appointments(org) where patient_id = linked_patient) then
    raise exception 'Guardian agenda did not isolate the authorized patient';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true);
update public.patient_guardians set authorization_status = 'revoked'
where organization_id = current_setting('pixelbloom.test.guardian_org')::uuid;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000002', true);

do $$
begin
  if exists (select from public.list_guardian_appointments(current_setting('pixelbloom.test.guardian_org')::uuid)) then
    raise exception 'Revoked guardian link still grants agenda access';
  end if;
end;
$$;

rollback;
