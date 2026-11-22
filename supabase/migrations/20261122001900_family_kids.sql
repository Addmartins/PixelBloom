begin;

create table public.family_kids_controls (
  organization_id uuid not null,
  patient_id uuid not null,
  paused boolean not null default false,
  share_mood boolean not null default false,
  primary key (organization_id, patient_id),
  foreign key (organization_id, patient_id) references public.patients (organization_id, id)
);

create table public.kids_moods (
  organization_id uuid not null,
  patient_id uuid not null,
  day date not null default ((now() at time zone 'America/Recife')::date),
  mood text not null check (mood in ('happy', 'calm', 'sad', 'angry', 'worried', 'tired')),
  primary key (organization_id, patient_id, day),
  foreign key (organization_id, patient_id) references public.patients (organization_id, id)
);

create table public.kids_game_completions (
  organization_id uuid not null,
  patient_id uuid not null,
  day date not null,
  game text not null check (game in ('patterns', 'words')),
  primary key (organization_id, patient_id, day, game),
  foreign key (organization_id, patient_id) references public.patients (organization_id, id)
);

alter table public.family_kids_controls enable row level security;
alter table public.kids_moods enable row level security;
alter table public.kids_game_completions enable row level security;
revoke all on public.family_kids_controls, public.kids_moods, public.kids_game_completions from public, anon, authenticated;
grant select on public.family_kids_controls, public.kids_moods to authenticated;

create policy family_controls_read on public.family_kids_controls for select to authenticated
using (pixelbloom_private.is_own_patient(organization_id, patient_id)
  or pixelbloom_private.is_authorized_guardian(organization_id, patient_id));

create policy kids_moods_read on public.kids_moods for select to authenticated
using (pixelbloom_private.pixel_world_enabled(organization_id)
  and (pixelbloom_private.is_own_patient(organization_id, patient_id)
    or pixelbloom_private.is_authorized_guardian(organization_id, patient_id))
  and exists (select from public.family_kids_controls controls
    where controls.organization_id = kids_moods.organization_id and controls.patient_id = kids_moods.patient_id
      and controls.share_mood and not controls.paused));

create or replace function pixelbloom_private.patient_pixel_enabled(p_organization_id uuid, p_patient_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select pixelbloom_private.pixel_world_enabled(p_organization_id)
    and (coalesce(pixelbloom_private.role_for(p_organization_id) in ('owner', 'admin'), false)
      or pixelbloom_private.is_own_patient(p_organization_id, p_patient_id))
    and exists (
      select 1 from public.patient_pixel_settings settings
      join public.patients patient on patient.organization_id = settings.organization_id and patient.id = settings.patient_id
      where settings.organization_id = p_organization_id and settings.patient_id = p_patient_id
        and settings.enabled and patient.active
    )
    and not exists (select from public.family_kids_controls
      where organization_id = p_organization_id and patient_id = p_patient_id and paused);
$$;

create function public.set_family_kids_controls(p_organization_id uuid, p_patient_id uuid, p_paused boolean, p_share_mood boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not pixelbloom_private.is_authorized_guardian(p_organization_id, p_patient_id) then
    raise exception 'Operação sem autorização' using errcode = '42501';
  end if;
  perform 1 from public.patients where organization_id = p_organization_id and id = p_patient_id for update;
  insert into public.family_kids_controls values (p_organization_id, p_patient_id, p_paused, p_share_mood)
  on conflict (organization_id, patient_id) do update set paused = excluded.paused, share_mood = excluded.share_mood;
  if not p_share_mood then
    delete from public.kids_moods where organization_id = p_organization_id and patient_id = p_patient_id;
  end if;
end;
$$;

create function public.save_kids_mood(p_organization_id uuid, p_patient_id uuid, p_mood text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not pixelbloom_private.is_own_patient(p_organization_id, p_patient_id) then
    raise exception 'Operação sem autorização' using errcode = '42501';
  end if;
  perform 1 from public.patients where organization_id = p_organization_id and id = p_patient_id for update;
  if not pixelbloom_private.patient_pixel_enabled(p_organization_id, p_patient_id)
    or not exists (select from public.family_kids_controls where organization_id = p_organization_id
      and patient_id = p_patient_id and share_mood) then
    raise exception 'Registro indisponível' using errcode = '42501';
  end if;
  insert into public.kids_moods (organization_id, patient_id, mood) values (p_organization_id, p_patient_id, p_mood)
  on conflict (organization_id, patient_id, day) do update set mood = excluded.mood;
end;
$$;

create function public.finish_kids_game(p_organization_id uuid, p_patient_id uuid, p_game text, p_answers text[])
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not pixelbloom_private.is_own_patient(p_organization_id, p_patient_id) then
    raise exception 'Operação sem autorização' using errcode = '42501';
  end if;
  perform 1 from public.patients where organization_id = p_organization_id and id = p_patient_id for update;
  if not pixelbloom_private.patient_pixel_enabled(p_organization_id, p_patient_id) then
    raise exception 'Jogo indisponível' using errcode = '42501';
  end if;
  if p_answers is distinct from (case p_game
    when 'patterns' then array['triangle','blue','two']
    when 'words' then array['rain','book','bird']
    else null end) or p_answers is null then
    raise exception 'Confira suas respostas' using errcode = '22023';
  end if;

  insert into public.kids_game_completions values (
    p_organization_id, p_patient_id, (now() at time zone 'America/Recife')::date, p_game
  ) on conflict do nothing;
  if not found then return false; end if;
  insert into public.reward_ledger (organization_id, patient_id, amount, transaction_type, description)
  values (p_organization_id, p_patient_id, 5, 'grant', 'Jogo educativo');
  return true;
end;
$$;

alter table public.rewards_catalog add column kind text not null default 'avatar' check (kind in ('avatar', 'physical'));
alter table public.rewards_catalog add column avatar_accessory text
  check (avatar_accessory is null or (kind = 'avatar' and avatar_accessory in ('crown', 'butterfly')));
alter table public.patient_avatars drop constraint patient_avatars_accessory_check;
alter table public.patient_avatars add constraint patient_avatars_accessory_check
  check (accessory in ('none', 'leaf', 'star', 'crown', 'butterfly'));

create function pixelbloom_private.check_avatar_accessory()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.accessory in ('crown', 'butterfly') and not exists (
    select from public.patient_inventory item join public.rewards_catalog reward
      on reward.organization_id = item.organization_id and reward.id = item.reward_id
    where item.organization_id = new.organization_id and item.patient_id = new.patient_id
      and reward.avatar_accessory = new.accessory
  ) then
    raise exception 'Acessório indisponível' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function pixelbloom_private.check_avatar_accessory() from public, anon, authenticated;
create trigger check_avatar_accessory before insert or update on public.patient_avatars
for each row execute function pixelbloom_private.check_avatar_accessory();

alter table public.patient_inventory add column personalization text check (char_length(personalization) between 1 and 60);
alter table public.patient_inventory add column fulfilled_at timestamptz;
create function pixelbloom_private.redeem_family_item(p_organization_id uuid, p_patient_id uuid, p_reward_id uuid, p_kind text, p_personalization text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  inventory_id uuid;
  reward_price integer;
  balance bigint;
begin
  if not (
    (p_kind = 'avatar' and pixelbloom_private.is_own_patient(p_organization_id, p_patient_id))
    or (p_kind = 'physical' and pixelbloom_private.is_authorized_guardian(p_organization_id, p_patient_id))
  ) then
    raise exception 'Operação sem autorização' using errcode = '42501';
  end if;

  perform 1 from public.patients where organization_id = p_organization_id and id = p_patient_id and active for update;
  if not found or not pixelbloom_private.pixel_world_enabled(p_organization_id)
    or (p_kind = 'avatar' and not pixelbloom_private.patient_pixel_enabled(p_organization_id, p_patient_id)) then
    raise exception 'Experiência indisponível' using errcode = '22023';
  end if;

  if p_kind = 'physical' and (p_personalization is null or char_length(p_personalization) not between 1 and 60) then
    raise exception 'Personalização inválida' using errcode = '22023';
  end if;

  select case when active then price_points end into reward_price from public.rewards_catalog
  where organization_id = p_organization_id and id = p_reward_id and kind = p_kind for share;
  if not found then
    raise exception 'Item indisponível' using errcode = '22023';
  end if;

  select id into inventory_id from public.patient_inventory
  where organization_id = p_organization_id and patient_id = p_patient_id and reward_id = p_reward_id;
  if found then
    return inventory_id;
  end if;

  if reward_price is null then
    raise exception 'Item indisponível' using errcode = '22023';
  end if;

  select coalesce(sum(amount), 0) into balance from public.reward_ledger
  where organization_id = p_organization_id and patient_id = p_patient_id;
  if balance < reward_price then
    raise exception 'Saldo insuficiente' using errcode = '22023';
  end if;

  insert into public.patient_inventory (organization_id, patient_id, reward_id, personalization)
  values (p_organization_id, p_patient_id, p_reward_id, p_personalization) returning id into inventory_id;
  insert into public.reward_ledger (organization_id, patient_id, amount, transaction_type, reference_id)
  values (p_organization_id, p_patient_id, -reward_price, 'redemption', inventory_id);
  return inventory_id;
end;
$$;


create or replace function public.redeem_reward(p_organization_id uuid, p_patient_id uuid, p_reward_id uuid)
returns uuid language sql security definer set search_path = '' as $$
  select pixelbloom_private.redeem_family_item(p_organization_id, p_patient_id, p_reward_id, 'avatar', null);
$$;

create function public.redeem_family_prize(p_organization_id uuid, p_patient_id uuid, p_reward_id uuid, p_personalization text)
returns uuid language sql security definer set search_path = '' as $$
  select pixelbloom_private.redeem_family_item(p_organization_id, p_patient_id, p_reward_id, 'physical', btrim(p_personalization));
$$;

create function public.family_points(p_organization_id uuid, p_patient_id uuid)
returns bigint language plpgsql stable security definer set search_path = '' as $$
begin
  if not pixelbloom_private.is_authorized_guardian(p_organization_id, p_patient_id) then
    raise exception 'Operação sem autorização' using errcode = '42501';
  end if;
  return (select coalesce(sum(amount), 0) from public.reward_ledger
    where organization_id = p_organization_id and patient_id = p_patient_id);
end;
$$;

create policy guardian_physical_catalog on public.rewards_catalog for select to authenticated
using (kind = 'physical' and pixelbloom_private.role_for(organization_id) = 'guardian'
  and pixelbloom_private.pixel_world_enabled(organization_id));

alter policy rewards_catalog_select on public.rewards_catalog
using (
  pixelbloom_private.pixel_world_enabled(organization_id) and (
    pixelbloom_private.role_for(organization_id) in ('owner', 'admin')
    or (kind = 'avatar' and pixelbloom_private.role_for(organization_id) = 'patient' and exists (
      select 1 from public.patient_pixel_settings settings
      where settings.organization_id = rewards_catalog.organization_id
        and pixelbloom_private.patient_pixel_enabled(settings.organization_id, settings.patient_id)
        and (rewards_catalog.active or exists (
          select 1 from public.patient_inventory item
          where item.organization_id = settings.organization_id and item.patient_id = settings.patient_id
            and item.reward_id = rewards_catalog.id
        ))
    ))
  )
);
alter policy inventory_select on public.patient_inventory
using (personalization is null and pixelbloom_private.patient_pixel_enabled(organization_id, patient_id));

create policy guardian_physical_orders on public.patient_inventory for select to authenticated
using (personalization is not null and pixelbloom_private.is_authorized_guardian(organization_id, patient_id));

create policy clinic_physical_orders on public.patient_inventory for select to authenticated
using (personalization is not null and pixelbloom_private.role_for(organization_id) in ('owner', 'admin'));

create function public.fulfill_family_prize(p_organization_id uuid, p_order_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce(pixelbloom_private.role_for(p_organization_id) in ('owner', 'admin'), false) then
    raise exception 'Operação sem autorização' using errcode = '42501';
  end if;
  update public.patient_inventory set fulfilled_at = coalesce(fulfilled_at, now())
  where organization_id = p_organization_id and id = p_order_id and personalization is not null;
  if not found then raise exception 'Pedido indisponível' using errcode = '22023'; end if;
end;
$$;

revoke all on function pixelbloom_private.redeem_family_item(uuid, uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.set_family_kids_controls(uuid, uuid, boolean, boolean),
  public.save_kids_mood(uuid, uuid, text), public.finish_kids_game(uuid, uuid, text, text[]),
  public.redeem_family_prize(uuid, uuid, uuid, text), public.family_points(uuid, uuid),
  public.fulfill_family_prize(uuid, uuid) from public, anon, authenticated;
grant execute on function public.set_family_kids_controls(uuid, uuid, boolean, boolean),
  public.save_kids_mood(uuid, uuid, text), public.finish_kids_game(uuid, uuid, text, text[]),
  public.redeem_family_prize(uuid, uuid, uuid, text), public.family_points(uuid, uuid),
  public.fulfill_family_prize(uuid, uuid) to authenticated;
grant insert (kind, avatar_accessory) on public.rewards_catalog to authenticated;
commit;
