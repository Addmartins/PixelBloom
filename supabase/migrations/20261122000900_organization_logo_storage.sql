begin;

create function pixelbloom_private.logo_organization_id(p_path text)
returns uuid language sql immutable set search_path = '' as $$
  select case
    when p_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-zA-Z0-9_-]{1,100}[.](png|jpeg|jpg|webp)$'
    then split_part(p_path, '/', 1)::uuid
  end;
$$;

alter table public.organizations add constraint organizations_logo_belongs_to_tenant
check (logo_url is null or pixelbloom_private.logo_organization_id(logo_url) is not distinct from id);

revoke all on function pixelbloom_private.logo_organization_id(text) from public, anon, authenticated;
grant execute on function pixelbloom_private.logo_organization_id(text) to authenticated;

do $$
begin
  if to_regclass('storage.objects') is null or to_regclass('storage.buckets') is null then
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('organization-logos', 'organization-logos', false, 2097152, array['image/png', 'image/jpeg', 'image/webp']);

  create policy organization_logos_select on storage.objects for select to authenticated
  using (
    bucket_id = 'organization-logos'
    and pixelbloom_private.role_for(pixelbloom_private.logo_organization_id(name)) is not null
  );

  create policy organization_logos_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'organization-logos'
    and pixelbloom_private.role_for(pixelbloom_private.logo_organization_id(name)) in ('owner', 'admin')
  );

  create policy organization_logos_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'organization-logos'
    and pixelbloom_private.role_for(pixelbloom_private.logo_organization_id(name)) in ('owner', 'admin')
  );
end;
$$;

commit;
