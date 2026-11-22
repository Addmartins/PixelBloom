begin;

create function public.list_guardian_appointments(p_organization_id uuid)
returns table (
  id uuid,
  patient_id uuid,
  start_at timestamptz,
  end_at timestamptz,
  status public.appointment_status
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if pixelbloom_private.role_for(p_organization_id) is distinct from 'guardian'::public.membership_role then
    raise exception 'Operação sem autorização' using errcode = '42501';
  end if;

  return query
  select appointment.id, appointment.patient_id, appointment.start_at, appointment.end_at, appointment.status
  from public.appointments appointment
  where appointment.organization_id = p_organization_id
    and appointment.start_at >= now()
    and pixelbloom_private.is_authorized_guardian(p_organization_id, appointment.patient_id)
  order by appointment.start_at, appointment.id
  limit 100;
end;
$$;

revoke all on function public.list_guardian_appointments(uuid) from public, anon, authenticated;
grant execute on function public.list_guardian_appointments(uuid) to authenticated;

commit;
