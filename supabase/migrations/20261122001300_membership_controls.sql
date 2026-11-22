begin;

create function public.set_organization_membership_status(
  p_organization_id uuid, p_membership_id uuid, p_status public.membership_status
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor_role public.membership_role := pixelbloom_private.role_for(p_organization_id);
  target public.organization_memberships;
begin
  if not coalesce(actor_role in ('owner', 'admin'), false) then
    raise exception 'Operação sem autorização' using errcode = '42501';
  end if;

  select * into target from public.organization_memberships
  where organization_id = p_organization_id and id = p_membership_id
  for update;

  if not found or p_status is null or target.role = 'owner'
    or (actor_role = 'admin' and target.role not in ('reception', 'professional', 'guardian', 'patient')) then
    raise exception 'Vínculo indisponível para alteração' using errcode = '22023';
  end if;

  if target.status is distinct from p_status then
    update public.organization_memberships set status = p_status
    where organization_id = p_organization_id and id = p_membership_id;
  end if;
end;
$$;

revoke all on function public.set_organization_membership_status(uuid, uuid, public.membership_status)
from public, anon, authenticated;
grant execute on function public.set_organization_membership_status(uuid, uuid, public.membership_status)
to authenticated;

commit;
