begin;

create function public.reward_balance(p_organization_id uuid, p_patient_id uuid)
returns bigint language plpgsql stable security definer set search_path = '' as $$
begin
  if not pixelbloom_private.patient_pixel_enabled(p_organization_id, p_patient_id) then
    raise exception 'Operação sem autorização' using errcode = '42501';
  end if;

  return (
    select coalesce(sum(amount), 0)
    from public.reward_ledger
    where organization_id = p_organization_id and patient_id = p_patient_id
  );
end;
$$;

revoke all on function public.reward_balance(uuid, uuid) from public, anon, authenticated;
grant execute on function public.reward_balance(uuid, uuid) to authenticated;

commit;
