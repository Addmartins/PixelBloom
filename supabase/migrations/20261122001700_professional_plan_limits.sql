begin;

alter table public.plans add constraint active_professional_limit_valid check (
  case
    when not (limits ? 'active_professionals') then true
    when jsonb_typeof(limits -> 'active_professionals') = 'number' then
      (limits ->> 'active_professionals')::numeric between 0 and 1000000
      and trunc((limits ->> 'active_professionals')::numeric) = (limits ->> 'active_professionals')::numeric
    else false
  end
);

create function pixelbloom_private.check_professional_plan_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  maximum integer;
begin
  if not new.active or (tg_op = 'UPDATE' and old.active) then
    return new;
  end if;

  if auth.uid() is not null
    and not coalesce(pixelbloom_private.role_for(new.organization_id) in ('owner', 'admin'), false) then
    return new;
  end if;

  select (plan.limits ->> 'active_professionals')::numeric::integer into maximum
  from public.subscriptions subscription
  join public.plans plan on plan.id = subscription.plan_id
  where subscription.organization_id = new.organization_id
    and subscription.status in ('active', 'trialing')
    and (subscription.ends_at is null or subscription.ends_at > now())
  for update of subscription;

  if maximum is not null and maximum <= (
    select count(*) from public.professionals
    where organization_id = new.organization_id and active
  ) then
    raise exception 'Limite de profissionais ativos atingido' using errcode = 'PBL01';
  end if;

  return new;
end;
$$;

revoke all on function pixelbloom_private.check_professional_plan_limit() from public, anon, authenticated;

create trigger enforce_professional_plan_limit before insert or update of active on public.professionals
for each row execute function pixelbloom_private.check_professional_plan_limit();

commit;
