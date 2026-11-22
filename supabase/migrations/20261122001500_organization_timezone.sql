begin;

create function public.update_organization_timezone(p_organization_id uuid, p_timezone text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce(pixelbloom_private.role_for(p_organization_id) in ('owner', 'admin'), false) then
    raise exception 'Operação sem autorização' using errcode = '42501';
  end if;

  if p_timezone is null or p_timezone !~ '^[A-Za-z]+/[A-Za-z0-9_+-]+(/[A-Za-z0-9_+-]+)?$'
    or not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'Informe um fuso horário válido' using errcode = '22023';
  end if;

  update public.organizations
  set settings = jsonb_set(settings, '{timezone}', to_jsonb(p_timezone))
  where id = p_organization_id and settings ->> 'timezone' is distinct from p_timezone;
end;
$$;

revoke update (settings) on public.organizations from authenticated;
revoke all on function public.update_organization_timezone(uuid, text) from public, anon, authenticated;
grant execute on function public.update_organization_timezone(uuid, text) to authenticated;

commit;
