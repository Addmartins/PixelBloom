\set ON_ERROR_STOP on

begin;

insert into auth.users(id, email)
values ('93000000-0000-4000-8000-000000000001', 'capacity-owner@example.test');
update public.plans set limits = '{"active_professionals": 1}' where code = 'starter';

set local role authenticated;
select set_config('request.jwt.claim.sub', '93000000-0000-4000-8000-000000000001', true);

do $$
declare
  clinic uuid := public.create_organization('Clínica de capacidade', 'fixture-capacity');
  original uuid;
begin
  insert into public.professionals (organization_id, display_name) values (clinic, 'Profissional Um')
    returning id into original;

  begin
    insert into public.professionals (organization_id, display_name) values (clinic, 'Profissional Dois');
    raise exception 'Configured active professional limit was ignored';
  exception when sqlstate 'PBL01' then
    null;
  end;

  update public.professionals set active = false where id = original;
  insert into public.professionals (organization_id, display_name) values (clinic, 'Profissional Dois');

  begin
    update public.professionals set active = true where id = original;
    raise exception 'Reactivation bypassed the plan limit';
  exception when sqlstate 'PBL01' then
    null;
  end;
end;
$$;

rollback;
