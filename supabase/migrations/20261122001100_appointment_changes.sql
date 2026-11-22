begin;

create function public.reschedule_appointment(p_organization_id uuid, p_appointment_id uuid, p_start_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce(pixelbloom_private.role_for(p_organization_id) in ('owner', 'admin', 'manager', 'reception'), false) then
    raise exception 'Operação sem autorização' using errcode = '42501';
  end if;

  if p_start_at is null or not isfinite(p_start_at) then
    raise exception 'Informe um horário válido' using errcode = '22023';
  end if;

  update public.appointments
  set start_at = p_start_at, end_at = p_start_at + (end_at - start_at)
  where organization_id = p_organization_id and id = p_appointment_id and status in ('scheduled', 'confirmed');

  if not found then
    raise exception 'Agendamento indisponível para reagendamento' using errcode = '22023';
  end if;
end;
$$;

create function public.confirm_appointment(p_organization_id uuid, p_appointment_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce(pixelbloom_private.role_for(p_organization_id) in ('owner', 'admin', 'manager', 'reception'), false) then
    raise exception 'Operação sem autorização' using errcode = '42501';
  end if;

  update public.appointments
  set status = 'confirmed'
  where organization_id = p_organization_id and id = p_appointment_id and status = 'scheduled';

  if not found and not exists (
    select 1 from public.appointments
    where organization_id = p_organization_id and id = p_appointment_id and status = 'confirmed'
  ) then
    raise exception 'Agendamento indisponível para confirmação' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.reschedule_appointment(uuid, uuid, timestamptz), public.confirm_appointment(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.reschedule_appointment(uuid, uuid, timestamptz), public.confirm_appointment(uuid, uuid)
to authenticated;

commit;
