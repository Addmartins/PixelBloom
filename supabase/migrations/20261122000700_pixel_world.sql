begin;

create table public.patient_pixel_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  patient_id uuid not null,
  enabled boolean not null,
  updated_at timestamptz not null default now(),
  unique (organization_id, patient_id),
  foreign key (organization_id, patient_id) references public.patients (organization_id, id)
);

create table public.patient_avatars (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  patient_id uuid not null,
  palette text not null default 'violet' check (palette in ('violet', 'mint', 'peach')),
  accessory text not null default 'none' check (accessory in ('none', 'leaf', 'star')),
  updated_at timestamptz not null default now(),
  unique (organization_id, patient_id),
  foreign key (organization_id, patient_id) references public.patients (organization_id, id)
);

create table public.rewards_catalog (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  name text not null check (char_length(btrim(name)) between 2 and 100),
  description text check (char_length(description) <= 1000),
  price_points integer not null check (price_points between 1 and 10000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table public.patient_inventory (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  patient_id uuid not null,
  reward_id uuid not null,
  acquired_at timestamptz not null default now(),
  unique (organization_id, patient_id, reward_id),
  unique (organization_id, patient_id, id),
  foreign key (organization_id, patient_id) references public.patients (organization_id, id),
  foreign key (organization_id, reward_id) references public.rewards_catalog (organization_id, id)
);
create index patient_inventory_by_reward on public.patient_inventory (organization_id, reward_id);

create table public.reward_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  patient_id uuid not null,
  amount integer not null check (amount between -10000 and 10000 and amount <> 0),
  transaction_type text not null check (transaction_type in ('grant', 'redemption')),
  reference_id uuid unique,
  description text check (char_length(description) <= 200),
  created_at timestamptz not null default now(),
  check (
    (transaction_type = 'grant' and amount > 0 and reference_id is null)
    or (transaction_type = 'redemption' and amount < 0 and reference_id is not null)
  ),
  foreign key (organization_id, patient_id) references public.patients (organization_id, id),
  foreign key (organization_id, patient_id, reference_id) references public.patient_inventory (organization_id, patient_id, id)
);
create index reward_ledger_by_patient on public.reward_ledger (organization_id, patient_id, created_at desc);

create function pixelbloom_private.pixel_world_enabled(p_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select pixelbloom_private.plan_feature_enabled(p_organization_id, 'pixel_world') and exists (
    select 1 from public.organizations where id = p_organization_id and settings -> 'pixel_world_enabled' = 'true'::jsonb
  );
$$;

create function pixelbloom_private.patient_pixel_enabled(p_organization_id uuid, p_patient_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select pixelbloom_private.pixel_world_enabled(p_organization_id)
    and (coalesce(pixelbloom_private.role_for(p_organization_id) in ('owner', 'admin'), false)
      or pixelbloom_private.is_own_patient(p_organization_id, p_patient_id))
    and exists (
      select 1 from public.patient_pixel_settings settings
      join public.patients patient on patient.organization_id = settings.organization_id and patient.id = settings.patient_id
      where settings.organization_id = p_organization_id and settings.patient_id = p_patient_id
        and settings.enabled and patient.active
    );
$$;

create function public.set_pixel_world_opt_in(p_organization_id uuid, p_patient_id uuid, p_enabled boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not pixelbloom_private.is_own_patient(p_organization_id, p_patient_id)
    or (p_enabled and not pixelbloom_private.pixel_world_enabled(p_organization_id)) then
    raise exception 'Operação sem autorização' using errcode = '42501';
  end if;

  perform 1 from public.patients where organization_id = p_organization_id and id = p_patient_id for update;
  insert into public.patient_pixel_settings (organization_id, patient_id, enabled)
  values (p_organization_id, p_patient_id, p_enabled)
  on conflict (organization_id, patient_id)
  do update set enabled = excluded.enabled, updated_at = now();
end;
$$;

create function public.save_patient_avatar(
  p_organization_id uuid, p_patient_id uuid, p_palette text, p_accessory text
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not pixelbloom_private.is_own_patient(p_organization_id, p_patient_id) then
    raise exception 'Operação sem autorização' using errcode = '42501';
  end if;

  perform 1 from public.patients where organization_id = p_organization_id and id = p_patient_id for update;
  if not pixelbloom_private.patient_pixel_enabled(p_organization_id, p_patient_id) then
    raise exception 'Experiência indisponível' using errcode = '22023';
  end if;

  insert into public.patient_avatars (organization_id, patient_id, palette, accessory)
  values (p_organization_id, p_patient_id, p_palette, p_accessory)
  on conflict (organization_id, patient_id)
  do update set palette = excluded.palette, accessory = excluded.accessory, updated_at = now();
end;
$$;

create function public.grant_reward_points(
  p_organization_id uuid, p_patient_id uuid, p_amount integer, p_reason text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  transaction_id uuid;
begin
  if not coalesce(pixelbloom_private.role_for(p_organization_id) in ('owner', 'admin'), false) then
    raise exception 'Operação sem autorização' using errcode = '42501';
  end if;

  perform 1 from public.patients where organization_id = p_organization_id and id = p_patient_id for update;
  if not pixelbloom_private.patient_pixel_enabled(p_organization_id, p_patient_id) then
    raise exception 'Experiência indisponível' using errcode = '22023';
  end if;

  insert into public.reward_ledger (organization_id, patient_id, amount, transaction_type, description)
  values (p_organization_id, p_patient_id, p_amount, 'grant', nullif(btrim(p_reason), ''))
  returning id into transaction_id;
  return transaction_id;
end;
$$;

create function public.redeem_reward(p_organization_id uuid, p_patient_id uuid, p_reward_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  inventory_id uuid;
  reward_price integer;
  balance bigint;
begin
  if not pixelbloom_private.is_own_patient(p_organization_id, p_patient_id) then
    raise exception 'Operação sem autorização' using errcode = '42501';
  end if;

  perform 1 from public.patients where organization_id = p_organization_id and id = p_patient_id for update;
  if not pixelbloom_private.patient_pixel_enabled(p_organization_id, p_patient_id) then
    raise exception 'Experiência indisponível' using errcode = '22023';
  end if;

  select id into inventory_id from public.patient_inventory
  where organization_id = p_organization_id and patient_id = p_patient_id and reward_id = p_reward_id;
  if found then
    return inventory_id;
  end if;

  select price_points into reward_price from public.rewards_catalog
  where organization_id = p_organization_id and id = p_reward_id and active for share;
  if not found then
    raise exception 'Item indisponível' using errcode = '22023';
  end if;

  select coalesce(sum(amount), 0) into balance from public.reward_ledger
  where organization_id = p_organization_id and patient_id = p_patient_id;
  if balance < reward_price then
    raise exception 'Saldo insuficiente' using errcode = '22023';
  end if;

  insert into public.patient_inventory (organization_id, patient_id, reward_id)
  values (p_organization_id, p_patient_id, p_reward_id) returning id into inventory_id;
  insert into public.reward_ledger (organization_id, patient_id, amount, transaction_type, reference_id)
  values (p_organization_id, p_patient_id, -reward_price, 'redemption', inventory_id);
  return inventory_id;
end;
$$;

create trigger audit_pixel_opt_in after insert or update on public.patient_pixel_settings
for each row execute function pixelbloom_private.audit_change();
create trigger audit_rewards_catalog after insert or update on public.rewards_catalog
for each row execute function pixelbloom_private.audit_change();
create trigger audit_reward_ledger after insert on public.reward_ledger
for each row execute function pixelbloom_private.audit_change();

alter table public.patient_pixel_settings enable row level security;
alter table public.patient_avatars enable row level security;
alter table public.rewards_catalog enable row level security;
alter table public.patient_inventory enable row level security;
alter table public.reward_ledger enable row level security;

create policy pixel_settings_select on public.patient_pixel_settings for select to authenticated
using (
  pixelbloom_private.is_own_patient(organization_id, patient_id)
  or pixelbloom_private.role_for(organization_id) in ('owner', 'admin')
);
create policy avatars_select on public.patient_avatars for select to authenticated
using (
  pixelbloom_private.is_own_patient(organization_id, patient_id)
  and pixelbloom_private.patient_pixel_enabled(organization_id, patient_id)
);
create policy rewards_catalog_select on public.rewards_catalog for select to authenticated
using (
  pixelbloom_private.pixel_world_enabled(organization_id) and (
    pixelbloom_private.role_for(organization_id) in ('owner', 'admin')
    or (pixelbloom_private.role_for(organization_id) = 'patient' and exists (
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
create policy rewards_catalog_insert on public.rewards_catalog for insert to authenticated
with check (
  pixelbloom_private.pixel_world_enabled(organization_id)
  and pixelbloom_private.role_for(organization_id) in ('owner', 'admin')
);
create policy rewards_catalog_update on public.rewards_catalog for update to authenticated
using (
  pixelbloom_private.pixel_world_enabled(organization_id)
  and pixelbloom_private.role_for(organization_id) in ('owner', 'admin')
)
with check (
  pixelbloom_private.pixel_world_enabled(organization_id)
  and pixelbloom_private.role_for(organization_id) in ('owner', 'admin')
);
create policy inventory_select on public.patient_inventory for select to authenticated
using (pixelbloom_private.patient_pixel_enabled(organization_id, patient_id));
create policy reward_ledger_select on public.reward_ledger for select to authenticated
using (pixelbloom_private.patient_pixel_enabled(organization_id, patient_id));

revoke all on public.patient_pixel_settings, public.patient_avatars, public.rewards_catalog,
  public.patient_inventory, public.reward_ledger from public, anon, authenticated;
grant select on public.patient_pixel_settings, public.patient_avatars, public.rewards_catalog,
  public.patient_inventory, public.reward_ledger to authenticated;
grant insert (organization_id, name, description, price_points, active),
  update (name, description, price_points, active) on public.rewards_catalog to authenticated;

revoke all on function pixelbloom_private.pixel_world_enabled(uuid), pixelbloom_private.patient_pixel_enabled(uuid, uuid),
  public.set_pixel_world_opt_in(uuid, uuid, boolean), public.save_patient_avatar(uuid, uuid, text, text),
  public.grant_reward_points(uuid, uuid, integer, text), public.redeem_reward(uuid, uuid, uuid)
from public, anon, authenticated;
grant execute on function pixelbloom_private.pixel_world_enabled(uuid), pixelbloom_private.patient_pixel_enabled(uuid, uuid),
  public.set_pixel_world_opt_in(uuid, uuid, boolean), public.save_patient_avatar(uuid, uuid, text, text),
  public.grant_reward_points(uuid, uuid, integer, text), public.redeem_reward(uuid, uuid, uuid) to authenticated;

commit;
