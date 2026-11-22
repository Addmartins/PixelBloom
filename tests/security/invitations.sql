\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email, email_confirmed_at)
values
  ('30000000-0000-4000-8000-000000000001', 'inviter@example.test', now()),
  ('30000000-0000-4000-8000-000000000002', 'guardian@example.test', now()),
  ('30000000-0000-4000-8000-000000000003', 'other@example.test', now());

set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000001', true);
select set_config('pixelbloom.test.invite_clinic', public.create_organization('Convites de Teste', 'fixture-convites')::text, true);
select set_config('pixelbloom.test.valid_token',
  public.create_organization_invite(current_setting('pixelbloom.test.invite_clinic')::uuid, 'Guardian@example.test', 'guardian'), true);
select set_config('pixelbloom.test.expired_token',
  public.create_organization_invite(current_setting('pixelbloom.test.invite_clinic')::uuid, 'guardian@example.test', 'guardian'), true);

reset role;
update public.organization_invites set expires_at = now() - interval '1 minute'
where token_hash = sha256(convert_to(current_setting('pixelbloom.test.expired_token'), 'UTF8'));

set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000003', true);
do $$
begin
  perform public.accept_organization_invite(current_setting('pixelbloom.test.valid_token'));
  raise exception 'A confirmed email different from the invite email was accepted';
exception when invalid_parameter_value then
  null;
end;
$$;

select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000002', true);
do $$
declare
  clinic uuid := current_setting('pixelbloom.test.invite_clinic')::uuid;
begin
  begin
    perform public.accept_organization_invite(current_setting('pixelbloom.test.expired_token'));
    raise exception 'Expired invitation was accepted';
  exception when invalid_parameter_value then
    null;
  end;
  begin
    perform public.accept_organization_invite('invalid-token');
    raise exception 'Malformed invitation token was accepted';
  exception when invalid_parameter_value then
    null;
  end;

  if public.accept_organization_invite(current_setting('pixelbloom.test.valid_token')) <> clinic then
    raise exception 'Valid invitation returned a different organization';
  end if;
  if not exists (
    select from public.organization_memberships
    where organization_id = clinic and profile_id = auth.uid() and role = 'guardian' and status = 'active'
  ) then
    raise exception 'Accepting an invitation did not create the expected active membership';
  end if;
  begin
    perform public.accept_organization_invite(current_setting('pixelbloom.test.valid_token'));
    raise exception 'The same invitation could be accepted twice';
  exception when invalid_parameter_value then
    null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000001', true);
do $$
declare
  clinic uuid := current_setting('pixelbloom.test.invite_clinic')::uuid;
  guardian uuid;
  allowed_patient uuid;
  pending_patient uuid;
begin
  insert into public.guardians (organization_id, profile_id, display_name)
  values (clinic, '30000000-0000-4000-8000-000000000002', 'Responsável sintético') returning id into guardian;
  insert into public.patients (organization_id, display_name)
  values (clinic, 'Paciente autorizado') returning id into allowed_patient;
  insert into public.patients (organization_id, display_name)
  values (clinic, 'Paciente pendente') returning id into pending_patient;
  insert into public.patient_guardians (organization_id, patient_id, guardian_id, relationship, authorization_status)
  values
    (clinic, allowed_patient, guardian, 'Responsável', 'authorized'),
    (clinic, pending_patient, guardian, 'Responsável', 'pending');
end;
$$;

select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000002', true);
do $$
begin
  if (select count(*) from public.patients) <> 1
    or not exists (select from public.patients where display_name = 'Paciente autorizado') then
    raise exception 'Guardian access must be limited to authorized patients';
  end if;
end;
$$;

reset role;
update auth.users set banned_until = now() + interval '1 day'
where id = '30000000-0000-4000-8000-000000000002';

set local role authenticated;
do $$
begin
  if exists (select from public.patients) or exists (select from public.organizations) then
    raise exception 'Disabled authentication user still has access';
  end if;
end;
$$;

rollback;
