begin;

create function public.list_relation_members(p_organization_id uuid)
returns table (profile_id uuid, display_name text, role public.membership_role)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not coalesce(pixelbloom_private.role_for(p_organization_id) in ('owner', 'admin'), false) then
    raise exception 'Operação sem autorização' using errcode = '42501';
  end if;

  return query
  select membership.profile_id, profile.display_name, membership.role
  from public.organization_memberships membership
  join public.profiles profile on profile.id = membership.profile_id
  join auth.users account on account.id = membership.profile_id
  where membership.organization_id = p_organization_id
    and membership.status = 'active' and membership.role in ('professional', 'guardian', 'patient')
    and account.deleted_at is null and (account.banned_until is null or account.banned_until <= now())
  order by profile.display_name, membership.profile_id;
end;
$$;

revoke all on function public.list_relation_members(uuid) from public, anon, authenticated;
grant execute on function public.list_relation_members(uuid) to authenticated;

commit;
