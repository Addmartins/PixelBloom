\set ON_ERROR_STOP on

-- Run after the migrations against a local development database.
-- Fixtures use reserved example domains and roll back at the end.
begin;

insert into auth.users (id, email, raw_user_meta_data)
values
  ('10000000-0000-4000-8000-000000000001', 'owner-a@example.test', '{"display_name":"Titular A"}'),
  ('10000000-0000-4000-8000-000000000002', 'owner-b@example.test', '{"display_name":"Titular B"}'),
  ('10000000-0000-4000-8000-000000000003', 'staff-a@example.test', '{"display_name":"Equipe A"}'),
  ('10000000-0000-4000-8000-000000000004', 'patient-a@example.test', '{"display_name":"Paciente A"}');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select set_config('pixelbloom.test.org_a', public.create_organization('Clínica de Teste A', 'fixture-clinica-a')::text, true);

insert into public.patients (organization_id, display_name)
values (current_setting('pixelbloom.test.org_a')::uuid, 'Paciente sintético A');

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select set_config('pixelbloom.test.org_b', public.create_organization('Clínica de Teste B', 'fixture-clinica-b')::text, true);

insert into public.patients (organization_id, display_name)
values (current_setting('pixelbloom.test.org_b')::uuid, 'Paciente sintético B');

do $$
declare
  org_a uuid := current_setting('pixelbloom.test.org_a')::uuid;
  org_b uuid := current_setting('pixelbloom.test.org_b')::uuid;
begin
  if not exists (select id from public.subscriptions where organization_id = org_b and status = 'active')
    or exists (select id from public.subscriptions where organization_id = org_a) then
    raise exception 'A starter subscription must be provisioned and scoped to the owner';
  end if;
  if not pixelbloom_private.plan_feature_enabled(org_b, 'agenda')
    or pixelbloom_private.plan_feature_enabled(org_b, 'pixel_world')
    or pixelbloom_private.plan_feature_enabled(org_a, 'agenda') then
    raise exception 'Feature evaluation did not enforce plan and tenant';
  end if;
  if not exists (select from public.audit_logs where organization_id = org_b)
    or exists (select from public.audit_logs where organization_id = org_a) then
    raise exception 'Owner audit access must be scoped to its own organization';
  end if;
  if not exists (select from public.patients where organization_id = org_b) then
    raise exception 'Owner B should be able to read its own patient';
  end if;
  if exists (select from public.organizations where id = org_a)
    or exists (select from public.patients where organization_id = org_a)
    or exists (select from public.organization_memberships where organization_id = org_a) then
    raise exception 'Owner B can read records from organization A';
  end if;
  begin
    insert into public.patients (organization_id, display_name)
    values (org_a, 'Synthetic unauthorized patient');
    raise exception 'Owner B can insert a patient in organization A';
  exception when insufficient_privilege then
    null;
  end;
  begin
    update public.patients set display_name = 'Synthetic unauthorized update'
    where organization_id = org_a;
    if found then
      raise exception 'Owner B can update a patient in organization A';
    end if;
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

reset role;
insert into public.organization_memberships (organization_id, profile_id, role, status)
values (current_setting('pixelbloom.test.org_a')::uuid, '10000000-0000-4000-8000-000000000003', 'reception', 'active');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);

do $$
declare
  org_a uuid := current_setting('pixelbloom.test.org_a')::uuid;
begin
  if not exists (select from public.patients where organization_id = org_a) then
    raise exception 'Active reception staff should be able to read patients in its organization';
  end if;
  begin
    update public.organization_memberships set role = 'owner'
    where organization_id = org_a and profile_id = auth.uid();
    if found then
      raise exception 'Reception staff can elevate its own role';
    end if;
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

reset role;
update public.organization_memberships set status = 'revoked'
where organization_id = current_setting('pixelbloom.test.org_a')::uuid
  and profile_id = '10000000-0000-4000-8000-000000000003';

set local role authenticated;

do $$
begin
  if exists (select from public.patients where organization_id = current_setting('pixelbloom.test.org_a')::uuid)
    or exists (select from public.organizations where id = current_setting('pixelbloom.test.org_a')::uuid) then
    raise exception 'Revoked staff still has access';
  end if;
end;
$$;

reset role;
insert into public.organization_memberships (organization_id, profile_id, role)
values (current_setting('pixelbloom.test.org_a')::uuid, '10000000-0000-4000-8000-000000000004', 'patient');

insert into public.patients (organization_id, profile_id, display_name)
values (current_setting('pixelbloom.test.org_a')::uuid, '10000000-0000-4000-8000-000000000004', 'Paciente com conta');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', true);
do $$
begin
  if (select count(*) from public.patients) <> 1
    or not exists (select from public.patients where profile_id = auth.uid()) then
    raise exception 'Patient access must be limited to its own record';
  end if;
end;
$$;

rollback;
