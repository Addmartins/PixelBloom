begin;

create function public.organization_features(p_organization_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'activities', pixelbloom_private.plan_feature_enabled(p_organization_id, 'activities'),
    'announcements', pixelbloom_private.plan_feature_enabled(p_organization_id, 'announcements'),
    'pixel_world', pixelbloom_private.plan_feature_enabled(p_organization_id, 'pixel_world'),
    'pixel_world_enabled', pixelbloom_private.pixel_world_enabled(p_organization_id)
  );
$$;

create function public.set_organization_pixel_world(p_organization_id uuid, p_enabled boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce(pixelbloom_private.role_for(p_organization_id) in ('owner', 'admin'), false) then
    raise exception 'Operação sem autorização' using errcode = '42501';
  end if;

  if p_enabled and not pixelbloom_private.plan_feature_enabled(p_organization_id, 'pixel_world') then
    raise exception 'Experiência indisponível no plano atual' using errcode = '22023';
  end if;

  update public.organizations
  set settings = jsonb_set(settings, '{pixel_world_enabled}', to_jsonb(p_enabled))
  where id = p_organization_id;
end;
$$;

create function pixelbloom_private.validate_relation_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.profile_id is not null and not exists (
    select 1 from public.organization_memberships membership
    join auth.users account on account.id = membership.profile_id
    where membership.organization_id = new.organization_id and membership.profile_id = new.profile_id
      and membership.role = tg_argv[0]::public.membership_role and membership.status = 'active'
      and account.deleted_at is null and (account.banned_until is null or account.banned_until <= now())
  ) then
    raise exception 'Vínculo indisponível' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger validate_professional_profile before insert or update of profile_id on public.professionals
for each row execute function pixelbloom_private.validate_relation_profile('professional');
create trigger validate_guardian_profile before insert or update of profile_id on public.guardians
for each row execute function pixelbloom_private.validate_relation_profile('guardian');
create trigger validate_patient_profile before insert or update of profile_id on public.patients
for each row execute function pixelbloom_private.validate_relation_profile('patient');

revoke all on function public.organization_features(uuid), public.set_organization_pixel_world(uuid, boolean),
  pixelbloom_private.validate_relation_profile() from public, anon, authenticated;
grant execute on function public.organization_features(uuid), public.set_organization_pixel_world(uuid, boolean) to authenticated;

commit;
