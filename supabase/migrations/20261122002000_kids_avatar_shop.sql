begin;

create table pixelbloom_private.avatar_shop_templates (
  code text primary key,
  name text not null,
  price_points integer not null,
  slot text not null check (slot in ('head','body','legs','feet','face','tool','hair','beard','neck','scene','effect'))
);
revoke all on pixelbloom_private.avatar_shop_templates from public, anon, authenticated;

-- Public-facing Pixel Barber collection. The seven legacy products are hidden in its shop.
insert into pixelbloom_private.avatar_shop_templates (code, name, price_points, slot) values
  ('camisa_vasco', 'Camisa retrô do Vasco', 17, 'body'),
  ('camisa_flamengo', 'Camisa rubro-negra do Flamengo', 17, 'body'),
  ('camisa_boca', 'Camisa azul do Boca Juniors', 17, 'body'),
  ('camisa_gremio', 'Camisa listrada do Grêmio', 17, 'body'),
  ('camisa_brasil', 'Camisa da Seleção Brasileira · anos 90', 29, 'body'),
  ('camisa_river', 'Camisa do River Plate', 18, 'body'),
  ('camiseta_branca', 'Camiseta básica branca', 6, 'body'),
  ('camiseta_oversized', 'Camiseta oversized preta', 8, 'body'),
  ('camiseta_coringa', 'Camiseta streetwear do Coringa', 14, 'body'),
  ('camiseta_batman', 'Camiseta minimalista do Batman', 14, 'body'),
  ('camiseta_tropical', 'Camiseta tropical', 9, 'body'),
  ('camiseta_tiedye', 'Camiseta tie-dye com graffiti', 13, 'body'),
  ('shorts_esportivo', 'Shorts esportivo preto', 7, 'legs'),
  ('shorts_jeans', 'Shorts jeans', 7, 'legs'),
  ('bermuda_cargo', 'Bermuda cargo bege', 9, 'legs'),
  ('shorts_tropical', 'Shorts estampado tropical', 12, 'legs'),
  ('shorts_street', 'Shorts streetwear oversized', 12, 'legs'),
  ('bone_aba_curva', 'Boné preto aba curva', 7, 'head'),
  ('bone_snapback', 'Boné snapback', 8, 'head'),
  ('bone_trucker', 'Boné trucker', 8, 'head'),
  ('bucket_estampado', 'Bucket hat estampado', 12, 'head'),
  ('tenis_branco', 'Tênis branco casual', 8, 'feet'),
  ('tenis_street', 'Tênis streetwear preto', 9, 'feet'),
  ('tenis_retro', 'Tênis colorido estilo retrô', 13, 'feet'),
  ('tenis_corrida', 'Tênis esportivo de corrida', 13, 'feet'),
  ('tenis_cano_alto', 'Tênis cano alto', 14, 'feet'),
  ('vestido_preto', 'Vestido casual preto', 9, 'body'),
  ('vestido_floral', 'Vestido floral', 13, 'body'),
  ('vestido_street', 'Vestido streetwear oversized', 14, 'body'),
  ('vestido_vermelho', 'Vestido elegante vermelho', 28, 'body'),
  ('pente_preto', 'Pente preto clássico', 4, 'tool'),
  ('tesoura_simples', 'Tesoura simples', 5, 'tool'),
  ('navalha_tradicional', 'Navalha tradicional', 6, 'tool'),
  ('maquina_basica', 'Máquina de corte básica', 7, 'tool'),
  ('avental_preto', 'Avental preto', 7, 'body'),
  ('escova_cabelo', 'Escova de cabelo', 5, 'tool'),
  ('toalha_branca', 'Toalha branca', 5, 'body'),
  ('creme_barbear', 'Creme de barbear', 5, 'tool'),
  ('bigode_fino', 'Bigode fino', 5, 'beard'),
  ('barba_curta', 'Barba curta', 7, 'beard'),
  ('maquina_dourada', 'Máquina dourada', 15, 'tool'),
  ('tesoura', 'Tesoura cromada', 13, 'tool'),
  ('navalha_personalizada', 'Navalha com cabo personalizado', 13, 'tool'),
  ('avental_vintage', 'Avental vintage', 16, 'body'),
  ('oculos_retro', 'Óculos retrô de barbeiro', 12, 'face'),
  ('bone_club', 'Boné Barber Club', 12, 'head'),
  ('barba_lenhador', 'Barba lenhador', 14, 'beard'),
  ('pompadour_estilo', 'Pompadour estilizado', 15, 'hair'),
  ('escova_madeira', 'Escova com cabo de madeira', 11, 'tool'),
  ('colar_navalha', 'Colar com pingente de navalha', 14, 'neck'),
  ('maquina_ouro', 'Máquina de corte de ouro', 35, 'tool'),
  ('navalha_flamejante', 'Navalha flamejante', 36, 'tool'),
  ('coroa_barber', 'Coroa Barber King', 38, 'head'),
  ('avental_lendario', 'Avental lendário com detalhes dourados', 33, 'body'),
  ('barba_viking', 'Barba Viking', 30, 'beard'),
  ('cabelo_neon', 'Cabelo neon com degradê', 34, 'hair'),
  ('tesoura_diamante', 'Tesoura de diamante', 40, 'tool'),
  ('cadeira_barbear', 'Cadeira de barbeiro portátil', 43, 'scene'),
  ('aura_laminas', 'Aura de lâminas giratórias', 43, 'effect'),
  ('chapeu_supremo', 'Chapéu Barbeiro Supremo', 39, 'head'),
  ('tesoura_prisma', 'Tesoura Prisma', 55, 'tool'),
  ('chapeu_fundador', 'Chapéu do Fundador', 63, 'head'),
  ('avental_estreia', 'Avental Primeira Edição', 70, 'body'),
  ('trono_inauguracao', 'Trono da Inauguração', 80, 'scene'),
  ('aura_letreiro', 'Aura Letreiro Neon', 93, 'effect');

alter table public.rewards_catalog add column cosmetic_code text references pixelbloom_private.avatar_shop_templates (code);
alter table public.rewards_catalog add constraint rewards_catalog_cosmetic_kind
  check (cosmetic_code is null or (kind = 'avatar' and avatar_accessory is null));
create unique index rewards_catalog_cosmetic_code on public.rewards_catalog (organization_id, cosmetic_code)
  where cosmetic_code is not null;

alter table public.patient_inventory add column equipped_slot text;
create unique index patient_inventory_equipped_slot on public.patient_inventory (organization_id, patient_id, equipped_slot)
  where equipped_slot is not null;

insert into public.rewards_catalog (organization_id, name, price_points, cosmetic_code)
select organization.id, template.name, template.price_points, template.code
from public.organizations organization cross join pixelbloom_private.avatar_shop_templates template;

create function pixelbloom_private.provision_avatar_shop()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.rewards_catalog (organization_id, name, price_points, cosmetic_code)
  select new.id, name, price_points, code from pixelbloom_private.avatar_shop_templates;
  return null;
end;
$$;

revoke all on function pixelbloom_private.provision_avatar_shop() from public, anon, authenticated;
create trigger provision_avatar_shop after insert on public.organizations
for each row execute function pixelbloom_private.provision_avatar_shop();

-- Follow the Pixel Barber wardrobe rule: only one acquired item per slot can be equipped.
create function public.equip_kids_avatar_item(p_organization_id uuid, p_patient_id uuid, p_reward_id uuid, p_equipped boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  selected_slot text;
begin
  if not pixelbloom_private.is_own_patient(p_organization_id, p_patient_id) then
    raise exception 'Operação sem autorização' using errcode = '42501';
  end if;

  perform 1 from public.patients where organization_id = p_organization_id and id = p_patient_id for update;
  if not pixelbloom_private.patient_pixel_enabled(p_organization_id, p_patient_id) then
    raise exception 'Experiência indisponível' using errcode = '42501';
  end if;

  select template.slot into selected_slot
  from public.patient_inventory inventory
  join public.rewards_catalog reward on reward.organization_id = inventory.organization_id and reward.id = inventory.reward_id
  join pixelbloom_private.avatar_shop_templates template on template.code = reward.cosmetic_code
  where inventory.organization_id = p_organization_id and inventory.patient_id = p_patient_id
    and inventory.reward_id = p_reward_id;

  if not found or p_equipped is null then
    raise exception 'Item indisponível' using errcode = '22023';
  end if;

  if p_equipped then
    update public.patient_inventory set equipped_slot = null where organization_id = p_organization_id
      and patient_id = p_patient_id and equipped_slot = selected_slot and reward_id <> p_reward_id;
  end if;
  update public.patient_inventory set equipped_slot = case when p_equipped then selected_slot end
  where organization_id = p_organization_id and patient_id = p_patient_id and reward_id = p_reward_id;
end;
$$;

revoke all on function public.equip_kids_avatar_item(uuid, uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.equip_kids_avatar_item(uuid, uuid, uuid, boolean) to authenticated;
commit;
