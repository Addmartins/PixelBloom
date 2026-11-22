\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email)
values
  ('40000000-0000-4000-8000-000000000001', 'experience-owner@example.test'),
  ('40000000-0000-4000-8000-000000000002', 'experience-patient@example.test'),
  ('40000000-0000-4000-8000-000000000003', 'experience-other-patient@example.test');

set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-000000000001', true);
select set_config('pixelbloom.test.reward_clinic',
  public.create_organization('Experiência de Teste', 'fixture-experiencia')::text, true);

do $$
begin
  perform public.set_organization_pixel_world(current_setting('pixelbloom.test.reward_clinic')::uuid, true);
  raise exception 'Starter plan accepted a Pixel World activation';
exception when invalid_parameter_value then
  null;
end;
$$;

reset role;
update public.subscriptions
set plan_id = (select id from public.plans where code = 'pro')
where organization_id = current_setting('pixelbloom.test.reward_clinic')::uuid;

insert into public.organization_memberships (organization_id, profile_id, role)
select current_setting('pixelbloom.test.reward_clinic')::uuid, id, 'patient'
from auth.users where id in (
  '40000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000003'
);

with patient as (
  insert into public.patients (organization_id, profile_id, display_name)
  values (current_setting('pixelbloom.test.reward_clinic')::uuid,
    '40000000-0000-4000-8000-000000000002', 'Paciente de teste')
  returning id
)
select set_config('pixelbloom.test.reward_patient', id::text, true) from patient;

set local role authenticated;
select public.set_organization_pixel_world(current_setting('pixelbloom.test.reward_clinic')::uuid, true);
with reward as (
  insert into public.rewards_catalog (organization_id, name, price_points)
  values (current_setting('pixelbloom.test.reward_clinic')::uuid, 'Colecionável sintético', 8)
  returning id
)
select set_config('pixelbloom.test.reward_id', id::text, true) from reward;

do $$
begin
  perform public.grant_reward_points(current_setting('pixelbloom.test.reward_clinic')::uuid,
    current_setting('pixelbloom.test.reward_patient')::uuid, 10, 'Crédito sintético');
  raise exception 'An account without individual opt-in received points';
exception when invalid_parameter_value then
  null;
end;
$$;

select set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-000000000002', true);
select public.set_pixel_world_opt_in(current_setting('pixelbloom.test.reward_clinic')::uuid,
  current_setting('pixelbloom.test.reward_patient')::uuid, true);

do $$
begin
  perform public.redeem_reward(current_setting('pixelbloom.test.reward_clinic')::uuid,
    current_setting('pixelbloom.test.reward_patient')::uuid, current_setting('pixelbloom.test.reward_id')::uuid);
  raise exception 'Insufficient funds were accepted';
exception when invalid_parameter_value then
  null;
end;
$$;

select set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-000000000001', true);
select public.grant_reward_points(current_setting('pixelbloom.test.reward_clinic')::uuid,
  current_setting('pixelbloom.test.reward_patient')::uuid, 10, 'Crédito sintético');

select set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-000000000002', true);
do $$
declare
  clinic uuid := current_setting('pixelbloom.test.reward_clinic')::uuid;
  patient uuid := current_setting('pixelbloom.test.reward_patient')::uuid;
  item uuid := current_setting('pixelbloom.test.reward_id')::uuid;
  entry uuid;
begin
  perform public.save_patient_avatar(clinic, patient, 'mint', 'leaf');
  if not exists (select from public.patient_avatars where patient_id = patient and palette = 'mint') then
    raise exception 'Avatar customization did not persist';
  end if;
  entry := public.redeem_reward(clinic, patient, item);
  if public.redeem_reward(clinic, patient, item) <> entry then
    raise exception 'Repeated redemption must return the original inventory item';
  end if;
  if public.reward_balance(clinic, patient) <> 2
    or (select count(*) from public.patient_inventory where patient_id = patient) <> 1
    or (select count(*) from public.reward_ledger where patient_id = patient and transaction_type = 'redemption') <> 1 then
    raise exception 'Redemption did not persist an atomic, single charge and inventory update';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-000000000003', true);
do $$
begin
  if exists (select from public.patient_inventory) or exists (select from public.reward_ledger)
    or exists (select from public.patient_avatars) then
    raise exception 'Another patient can access individual experience data';
  end if;
end;
$$;

rollback;
