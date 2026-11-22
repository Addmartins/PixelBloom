\set ON_ERROR_STOP on

begin;

-- The fixture only inserts metadata. Let this transaction exercise DELETE RLS
-- without calling the Storage API or changing the database-wide setting.
set local storage.allow_delete_query = 'true';

insert into auth.users (id, email)
values
  ('90000000-0000-4000-8000-000000000001', 'owner-a-storage@example.test'),
  ('90000000-0000-4000-8000-000000000002', 'owner-b-storage@example.test'),
  ('90000000-0000-4000-8000-000000000003', 'patient-a-storage@example.test');

do $$
begin
  if not exists (
    select from storage.buckets where id = 'organization-logos' and not public and file_size_limit = 2097152
  ) then
    raise exception 'Organization logo bucket must be private with a 2 MiB file limit';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000001', true);
select set_config('pixelbloom.test.storage_a', public.create_organization('Clínica Arquivos A', 'fixture-arquivos-a')::text, true);

insert into storage.objects (bucket_id, name)
values ('organization-logos', current_setting('pixelbloom.test.storage_a') || '/logo.png');

update public.organizations
set logo_url = current_setting('pixelbloom.test.storage_a') || '/logo.png'
where id = current_setting('pixelbloom.test.storage_a')::uuid;

select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000002', true);
select set_config('pixelbloom.test.storage_b', public.create_organization('Clínica Arquivos B', 'fixture-arquivos-b')::text, true);

do $$
declare
  org_a text := current_setting('pixelbloom.test.storage_a');
  org_b uuid := current_setting('pixelbloom.test.storage_b')::uuid;
begin
  if exists (select from storage.objects where bucket_id = 'organization-logos' and name = org_a || '/logo.png') then
    raise exception 'Owner B can read the logo of organization A';
  end if;

  delete from storage.objects where bucket_id = 'organization-logos' and name = org_a || '/logo.png';
  if found then raise exception 'Owner B can delete the logo of organization A'; end if;

  begin
    insert into storage.objects (bucket_id, name) values ('organization-logos', org_a || '/invalid.png');
    raise exception 'Owner B can upload into organization A';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.organizations set logo_url = org_a || '/logo.png' where id = org_b;
    raise exception 'Owner B can reference an organization A object as a logo';
  exception when check_violation then null;
  end;

  begin
    insert into storage.objects (bucket_id, name) values ('organization-logos', org_b::text || '/artifact.svg');
    raise exception 'Unsupported file extension was allowed';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
insert into public.organization_memberships (organization_id, profile_id, role)
values (current_setting('pixelbloom.test.storage_a')::uuid, '90000000-0000-4000-8000-000000000003', 'patient');

set local role authenticated;
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000003', true);

do $$
declare
  org_a text := current_setting('pixelbloom.test.storage_a');
begin
  if not exists (select from storage.objects where bucket_id = 'organization-logos' and name = org_a || '/logo.png') then
    raise exception 'Active organization member cannot read the logo';
  end if;

  begin
    insert into storage.objects (bucket_id, name) values ('organization-logos', org_a || '/invalid.png');
    raise exception 'Patient can upload a logo';
  exception when insufficient_privilege then null;
  end;
end;
$$;

rollback;
