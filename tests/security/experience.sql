\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email) values
  ('50000000-0000-4000-8000-000000000001', 'activities-owner@example.test'),
  ('50000000-0000-4000-8000-000000000002', 'activities-patient@example.test'),
  ('50000000-0000-4000-8000-000000000003', 'activities-peer@example.test');

set local role authenticated;
select set_config('request.jwt.claim.sub', '50000000-0000-4000-8000-000000000001', true);
select set_config('pixelbloom.test.experience_org',
  public.create_organization('Clínica de atividades', 'fixture-activities')::text, true);

do $$
declare clinic uuid := current_setting('pixelbloom.test.experience_org')::uuid;
begin
  if public.organization_features(clinic) -> 'activities' is distinct from 'false'::jsonb then
    raise exception 'Starter exposed activity entitlement';
  end if;
end;
$$;

reset role;
update public.subscriptions set plan_id = (select id from public.plans where code = 'growth')
where organization_id = current_setting('pixelbloom.test.experience_org')::uuid;

insert into public.organization_memberships (organization_id, profile_id, role)
select current_setting('pixelbloom.test.experience_org')::uuid, id, 'patient'
from auth.users where id in ('50000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000003');

insert into public.patients (organization_id, profile_id, display_name)
values (current_setting('pixelbloom.test.experience_org')::uuid, '50000000-0000-4000-8000-000000000002', 'Paciente sintético');

set local role authenticated;
with activity as (
  insert into public.activities(organization_id, name) values
    (current_setting('pixelbloom.test.experience_org')::uuid, 'Atividade sintética')
  returning id
)
select set_config('pixelbloom.test.activity', id::text, true) from activity;

with assignment as (
  insert into public.patient_activities(organization_id, activity_id, patient_id)
  select organization_id, current_setting('pixelbloom.test.activity')::uuid, id
  from public.patients where organization_id = current_setting('pixelbloom.test.experience_org')::uuid
  returning id
)
select set_config('pixelbloom.test.assignment', id::text, true) from assignment;

insert into public.announcements (organization_id, title, content, active) values
  (current_setting('pixelbloom.test.experience_org')::uuid, 'Aviso publicado', 'Mensagem sintética', true),
  (current_setting('pixelbloom.test.experience_org')::uuid, 'Aviso arquivado', 'Mensagem sintética', false);

select set_config('request.jwt.claim.sub', '50000000-0000-4000-8000-000000000002', true);
select public.complete_patient_activity(current_setting('pixelbloom.test.experience_org')::uuid,
  current_setting('pixelbloom.test.assignment')::uuid);
do $$
begin
  if (select count(*) from public.patient_activities where status = 'completed') <> 1
    or (select count(*) from public.activities) <> 1
    or (select count(*) from public.announcements where title = 'Aviso publicado') <> 1
    or exists (select from public.announcements where not active) then
    raise exception 'Patient view differs from the assigned and published records';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '50000000-0000-4000-8000-000000000003', true);
do $$
begin
  if exists (select from public.patient_activities) or exists (select from public.activities) then
    raise exception 'Another patient can read activity assignments';
  end if;
end;
$$;

rollback;
