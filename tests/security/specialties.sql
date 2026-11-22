\set ON_ERROR_STOP on

begin;
insert into auth.users (id, email, raw_user_meta_data) values
  ('18000000-0000-4000-8000-000000000001', 'specialty-owner-a@example.test', '{"display_name":"Titular A"}'),
  ('18000000-0000-4000-8000-000000000002', 'specialty-owner-b@example.test', '{"display_name":"Titular B"}'),
  ('18000000-0000-4000-8000-000000000003', 'specialty-reception@example.test', '{"display_name":"Recepção"}');

set local role authenticated;
select set_config('request.jwt.claim.sub', '18000000-0000-4000-8000-000000000001', true);
select set_config('pixelbloom.specialty.org_a', public.create_organization('Clínica A', 'test-specialties-a')::text, true);
insert into public.specialties (organization_id, name)
values (current_setting('pixelbloom.specialty.org_a')::uuid, 'Especialidade sintética');
select set_config('pixelbloom.specialty.id_a', (select id::text from public.specialties where organization_id = current_setting('pixelbloom.specialty.org_a')::uuid), true);

select set_config('request.jwt.claim.sub', '18000000-0000-4000-8000-000000000002', true);
select set_config('pixelbloom.specialty.org_b', public.create_organization('Clínica B', 'test-specialties-b')::text, true);

do $$
declare
  org_a uuid := current_setting('pixelbloom.specialty.org_a')::uuid;
  org_b uuid := current_setting('pixelbloom.specialty.org_b')::uuid;
  specialty_a uuid := current_setting('pixelbloom.specialty.id_a')::uuid;
  specialty_b uuid;
  professional_b uuid;
begin
  insert into public.specialties (organization_id, name)
    values (org_b, 'Especialidade sintética') returning id into specialty_b;
  insert into public.professionals (organization_id, display_name)
    values (org_b, 'Profissional sintético') returning id into professional_b;

  insert into public.services (organization_id, name, duration_minutes, specialty_id)
    values (org_b, 'Serviço sintético', 30, specialty_b);
  insert into public.professional_specialties (organization_id, professional_id, specialty_id)
    values (org_b, professional_b, specialty_b);

  if exists (select 1 from public.specialties where id = specialty_a) then
    raise exception 'Cross-tenant specialty read succeeded';
  end if;
  begin
    insert into public.specialties (organization_id, name) values (org_a, 'Cadastro fora do tenant');
    raise exception 'Cross-tenant specialty write succeeded';
  exception when insufficient_privilege then
    null;
  end;
  begin
    update public.services set specialty_id = specialty_a where organization_id = org_b;
    raise exception 'Cross-tenant service association succeeded';
  exception when foreign_key_violation then
    null;
  end;
  begin
    insert into public.professional_specialties (organization_id, professional_id, specialty_id)
      values (org_b, professional_b, specialty_a);
    raise exception 'Cross-tenant professional association succeeded';
  exception when foreign_key_violation then
    null;
  end;
end;
$$;

reset role;
insert into public.organization_memberships (organization_id, profile_id, role)
values (current_setting('pixelbloom.specialty.org_b')::uuid, '18000000-0000-4000-8000-000000000003', 'reception');
set local role authenticated;
select set_config('request.jwt.claim.sub', '18000000-0000-4000-8000-000000000003', true);

do $$
declare
  org_b uuid := current_setting('pixelbloom.specialty.org_b')::uuid;
begin
  if not exists (select 1 from public.specialties where organization_id = org_b)
    or not exists (select 1 from public.professional_specialties where organization_id = org_b) then
    raise exception 'Reception should be able to read its organization specialties and associations';
  end if;
  update public.specialties set active = false where organization_id = org_b;
  if found then
    raise exception 'Reception mutated an organization specialty';
  end if;
end;
$$;

rollback;
