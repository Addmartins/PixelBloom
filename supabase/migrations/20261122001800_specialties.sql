begin;

create table public.specialties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  name text not null check (char_length(btrim(name)) between 2 and 100),
  description text check (char_length(description) <= 1000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, id)
);
create unique index specialties_name_per_organization
  on public.specialties (organization_id, lower(btrim(name)));

create table public.professional_specialties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  professional_id uuid not null,
  specialty_id uuid not null,
  created_at timestamptz not null default now(),
  unique (organization_id, professional_id, specialty_id),
  foreign key (organization_id, professional_id) references public.professionals (organization_id, id),
  foreign key (organization_id, specialty_id) references public.specialties (organization_id, id)
);
create index professional_specialties_by_specialty on public.professional_specialties (organization_id, specialty_id);

alter table public.services add column specialty_id uuid;
alter table public.services add constraint services_specialty_same_organization
  foreign key (organization_id, specialty_id) references public.specialties (organization_id, id);
create index services_by_specialty on public.services (organization_id, specialty_id) where specialty_id is not null;

create trigger audit_specialties after insert or update on public.specialties
for each row execute function pixelbloom_private.audit_change();
create trigger audit_professional_specialties after insert or delete on public.professional_specialties
for each row execute function pixelbloom_private.audit_change();

alter table public.specialties enable row level security;
alter table public.professional_specialties enable row level security;

create policy specialties_select on public.specialties for select to authenticated
using (pixelbloom_private.role_for(organization_id) in ('owner', 'admin', 'manager', 'reception', 'professional'));
create policy specialties_insert on public.specialties for insert to authenticated
with check (pixelbloom_private.role_for(organization_id) in ('owner', 'admin'));
create policy specialties_update on public.specialties for update to authenticated
using (pixelbloom_private.role_for(organization_id) in ('owner', 'admin'))
with check (pixelbloom_private.role_for(organization_id) in ('owner', 'admin'));

create policy professional_specialties_select on public.professional_specialties for select to authenticated
using (
  pixelbloom_private.role_for(organization_id) in ('owner', 'admin', 'manager', 'reception')
  or pixelbloom_private.is_own_professional(organization_id, professional_id)
);
create policy professional_specialties_insert on public.professional_specialties for insert to authenticated
with check (pixelbloom_private.role_for(organization_id) in ('owner', 'admin'));
create policy professional_specialties_delete on public.professional_specialties for delete to authenticated
using (pixelbloom_private.role_for(organization_id) in ('owner', 'admin'));

revoke all on public.specialties, public.professional_specialties from public, anon, authenticated;
grant select on public.specialties, public.professional_specialties to authenticated;
grant insert (organization_id, name, description, active), update (name, description, active)
on public.specialties to authenticated;
grant insert (organization_id, professional_id, specialty_id), delete on public.professional_specialties to authenticated;
grant insert (specialty_id), update (specialty_id) on public.services to authenticated;

commit;
