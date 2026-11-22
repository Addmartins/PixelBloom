\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('92000000-0000-4000-8000-000000000001', 'family-owner@example.test'),
  ('92000000-0000-4000-8000-000000000002', 'family-child@example.test'),
  ('92000000-0000-4000-8000-000000000003', 'family-guardian@example.test');

set local role authenticated;
select set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000001', true);
select set_config('pixelbloom.test.family_org', public.create_organization('Clínica Família Teste', 'fixture-family-kids')::text, true);

reset role;
update public.subscriptions set plan_id = (select id from public.plans where code = 'pro')
where organization_id = current_setting('pixelbloom.test.family_org')::uuid;
insert into public.organization_memberships (organization_id, profile_id, role) values
  (current_setting('pixelbloom.test.family_org')::uuid, '92000000-0000-4000-8000-000000000002', 'patient'),
  (current_setting('pixelbloom.test.family_org')::uuid, '92000000-0000-4000-8000-000000000003', 'guardian');

with child as (
  insert into public.patients (organization_id, profile_id, display_name)
  values (current_setting('pixelbloom.test.family_org')::uuid, '92000000-0000-4000-8000-000000000002', 'Criança sintética')
  returning id
)
select set_config('pixelbloom.test.family_child', id::text, true) from child;

with guardian as (
  insert into public.guardians (organization_id, profile_id, display_name)
  values (current_setting('pixelbloom.test.family_org')::uuid, '92000000-0000-4000-8000-000000000003', 'Responsável sintético')
  returning id, organization_id
)
insert into public.patient_guardians (organization_id, guardian_id, patient_id, relationship, authorization_status)
select organization_id, id, current_setting('pixelbloom.test.family_child')::uuid, 'Responsável', 'authorized' from guardian;

set local role authenticated;
select public.set_organization_pixel_world(current_setting('pixelbloom.test.family_org')::uuid, true);
with prize as (
  insert into public.rewards_catalog (organization_id, name, price_points, kind)
  values (current_setting('pixelbloom.test.family_org')::uuid, 'Kit sintético', 3, 'physical')
  returning id
)
select set_config('pixelbloom.test.family_prize', id::text, true) from prize;

with avatar as (
  insert into public.rewards_catalog (organization_id, name, price_points, avatar_accessory)
  values (current_setting('pixelbloom.test.family_org')::uuid, 'Coroa sintética', 2, 'crown')
  returning id
)
select set_config('pixelbloom.test.family_avatar', id::text, true) from avatar;

do $$
declare
  org uuid := current_setting('pixelbloom.test.family_org')::uuid;
  child uuid := current_setting('pixelbloom.test.family_child')::uuid;
  prize uuid := current_setting('pixelbloom.test.family_prize')::uuid;
  avatar uuid := current_setting('pixelbloom.test.family_avatar')::uuid;
  owner_subject text := '92000000-0000-4000-8000-000000000001';
  child_subject text := '92000000-0000-4000-8000-000000000002';
  guardian_subject text := '92000000-0000-4000-8000-000000000003';
  order_id uuid;
  first_hat uuid;
  second_hat uuid;
begin
  perform set_config('request.jwt.claim.sub', child_subject, true);
  perform public.set_pixel_world_opt_in(org, child, true);
  begin
    perform public.save_kids_mood(org, child, 'calm');
    raise exception 'Mood accepted without guardian consent';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.save_patient_avatar(org, child, 'mint', 'crown');
    raise exception 'Unowned accessory was equipped';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.finish_kids_game(org, child, 'patterns', array['circle','blue','two']);
    raise exception 'Incorrect answers earned points';
  exception when invalid_parameter_value then null;
  end;
  if not public.finish_kids_game(org, child, 'patterns', array['triangle','blue','two'])
    or public.finish_kids_game(org, child, 'patterns', array['triangle','blue','two']) then
    raise exception 'Daily game award must apply exactly once';
  end if;
  begin
    perform public.redeem_reward(org, child, prize);
    raise exception 'Physical prize was redeemable from Kids';
  exception when invalid_parameter_value then null;
  end;
  perform public.redeem_reward(org, child, avatar);
  perform public.save_patient_avatar(org, child, 'mint', 'crown');

  perform set_config('request.jwt.claim.sub', guardian_subject, true);
  perform public.set_family_kids_controls(org, child, false, true);

  perform set_config('request.jwt.claim.sub', child_subject, true);
  perform public.save_kids_mood(org, child, 'calm');

  perform set_config('request.jwt.claim.sub', owner_subject, true);
  if exists (select from public.kids_moods where organization_id = org) then
    raise exception 'Clinic admin accessed private mood history';
  end if;

  perform set_config('request.jwt.claim.sub', guardian_subject, true);
  if (select mood from public.kids_moods where organization_id = org) is distinct from 'calm' then
    raise exception 'Authorized guardian could not see mood history';
  end if;
  order_id := public.redeem_family_prize(org, child, prize, 'Nome sintético');
  if public.redeem_family_prize(org, child, prize, 'Nome sintético') <> order_id
    or public.family_points(org, child) <> 0 then
    raise exception 'Physical prize redemption did not charge the shared wallet exactly once';
  end if;
  perform set_config('request.jwt.claim.sub', owner_subject, true);
  perform public.grant_reward_points(org, child, 50, 'Teste da loja');
  perform set_config('request.jwt.claim.sub', child_subject, true);
  if (select count(*) from public.rewards_catalog where organization_id = org and cosmetic_code is not null) <> 65 then
    raise exception 'New organization lacks the 65 visible shop items';
  end if;
  select id into first_hat from public.rewards_catalog where organization_id = org and cosmetic_code = 'bone_aba_curva';
  select id into second_hat from public.rewards_catalog where organization_id = org and cosmetic_code = 'bone_snapback';
  begin
    perform public.equip_kids_avatar_item(org, child, first_hat, true);
    raise exception 'Unowned shop item was equipped';
  exception when invalid_parameter_value then null;
  end;
  perform public.redeem_reward(org, child, first_hat);
  perform public.redeem_reward(org, child, second_hat);
  perform public.equip_kids_avatar_item(org, child, first_hat, true);
  perform public.equip_kids_avatar_item(org, child, second_hat, true);
  if not exists (select from public.patient_inventory where patient_id = child and reward_id = second_hat and equipped_slot = 'head')
    or exists (select from public.patient_inventory where patient_id = child and reward_id = first_hat and equipped_slot is not null) then
    raise exception 'Equipping a hat did not replace the old one';
  end if;
  perform public.equip_kids_avatar_item(org, child, second_hat, false);
  if exists (select from public.patient_inventory where patient_id = child and equipped_slot is not null) then
    raise exception 'Unequipping the item did not clear its slot';
  end if;
  perform set_config('request.jwt.claim.sub', guardian_subject, true);
  perform public.set_family_kids_controls(org, child, true, false);
  if exists (select from public.kids_moods where organization_id = org) then
    raise exception 'Disabled mood permission exposed history';
  end if;

  perform set_config('request.jwt.claim.sub', child_subject, true);
  begin
    perform public.finish_kids_game(org, child, 'words', array['rain','book','bird']);
    raise exception 'Paused Kids account played a game';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub', owner_subject, true);
  perform public.fulfill_family_prize(org, order_id);
  update public.patient_guardians set authorization_status = 'revoked' where organization_id = org;

  perform set_config('request.jwt.claim.sub', guardian_subject, true);
  if exists (select from public.patient_inventory where id = order_id) then
    raise exception 'Revoked guardian retained order access';
  end if;
  begin
    perform public.set_family_kids_controls(org, child, false, true);
    raise exception 'Revoked guardian retained parental control';
  exception when insufficient_privilege then null;
  end;
end;
$$;
rollback;
