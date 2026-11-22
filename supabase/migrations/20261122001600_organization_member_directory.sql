begin;

create function public.organization_member_directory(p_organization_id uuid)
returns table (
  id uuid,
  display_name text,
  role public.membership_role,
  status public.membership_status
)
language sql stable security definer set search_path = '' as $$
  select membership.id, profile.display_name, membership.role, membership.status
  from public.organization_memberships membership
  join public.profiles profile on profile.id = membership.profile_id
  where membership.organization_id = p_organization_id
    and pixelbloom_private.role_for(p_organization_id) in ('owner', 'admin')
  order by profile.display_name, membership.id;
$$;

revoke all on function public.organization_member_directory(uuid) from public, anon, authenticated;
grant execute on function public.organization_member_directory(uuid) to authenticated;

commit;
