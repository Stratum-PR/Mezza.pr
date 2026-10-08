-- P0-4 (issue #7): tabs change only through server code (guest pages, service role) and SECURITY
-- DEFINER functions (close_tab, raise_tab_limit, ...). "Cerrado en el POS" goes through
-- close_tab_on_pos, which checks the role and audits it. Signed-in staff never write tabs directly.
begin;
select no_plan();

insert into public.restaurants (id, slug, name) values
  ('00000000-0000-4000-8000-00000000cafe', 'test-tw', 'Café Lucía'),
  ('00000000-0000-4000-8000-00000000ba22', 'test-tw-barra', 'Barra Test');
insert into public.dining_tables (id, restaurant_id, label) values
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-00000000cafe', '1'),
  ('00000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-00000000cafe', '2');
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000001', 'owner@cafe-lucia.test'),
  ('00000000-0000-4000-8000-000000000002', 'manager@cafe-lucia.test'),
  ('00000000-0000-4000-8000-000000000003', 'server@cafe-lucia.test'),
  ('00000000-0000-4000-8000-000000000004', 'kitchen@cafe-lucia.test'),
  ('00000000-0000-4000-8000-000000000005', 'owner@barra-test.test');
insert into public.memberships (restaurant_id, user_id, role) values
  ('00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-000000000001', 'owner'),
  ('00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-000000000002', 'manager'),
  ('00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-000000000003', 'server'),
  ('00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-000000000004', 'kitchen'),
  ('00000000-0000-4000-8000-00000000ba22', '00000000-0000-4000-8000-000000000005', 'owner');
insert into public.tabs (id, restaurant_id, table_id) values
  ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000e1');

create function pg_temp.as_user(id text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, true) $$;
create function pg_temp.changed(p_sql text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute format('with x as (%s returning 1) select count(*) from x', p_sql) into n;
  return n;
exception when insufficient_privilege then
  return 0;
end $$;

create function pg_temp.no_tab_writes(p_who text) returns setof text language plpgsql as $$
declare
  s text;
  r uuid := '00000000-0000-4000-8000-00000000cafe';
begin
  foreach s in array array[
    format('update public.tabs set status = ''closed'', closed_at = now() where restaurant_id = %L', r),
    format('update public.tabs set pos_closed_at = now() where restaurant_id = %L', r),
    format('update public.tabs set qr_limit_extra_cents = 999999 where restaurant_id = %L', r),
    format('update public.tabs set party_size = 9 where restaurant_id = %L', r),
    format('delete from public.tabs where restaurant_id = %L', r)
  ] loop
    return next is(pg_temp.changed(s), 0::bigint, format('%s changes nothing: %s', p_who, left(s, 70)));
  end loop;
  return next throws_ok(
    format('insert into public.tabs (restaurant_id, table_id) values (%L, ''00000000-0000-4000-8000-0000000000e2'')', r),
    '42501', null, p_who || ' cannot open a tab directly');
end $$;

set local role authenticated;
select pg_temp.as_user('00000000-0000-4000-8000-000000000001');
select * from pg_temp.no_tab_writes('owner');
select pg_temp.as_user('00000000-0000-4000-8000-000000000002');
select * from pg_temp.no_tab_writes('manager');
select pg_temp.as_user('00000000-0000-4000-8000-000000000003');
select * from pg_temp.no_tab_writes('server');
select is((select count(*) from public.tabs), 1::bigint, 'the server still reads tabs');
select pg_temp.as_user('00000000-0000-4000-8000-000000000004');
select * from pg_temp.no_tab_writes('kitchen');
select is((select count(*) from public.tabs), 1::bigint, 'the kitchen still reads tabs');

reset role;
select is((select status::text from public.tabs where id = '00000000-0000-4000-8000-0000000000f1'), 'open', 'the tab is still open');
select is((select count(*) from public.tabs where restaurant_id = '00000000-0000-4000-8000-00000000cafe'), 1::bigint, 'no tab was added or removed');

-- "Cerrado en el POS" through close_tab_on_pos.
set local role authenticated;
select pg_temp.as_user('00000000-0000-4000-8000-000000000004');
select throws_ok('select public.close_tab_on_pos(''00000000-0000-4000-8000-0000000000f1'')', '42501', null, 'the kitchen cannot close on the POS');
select pg_temp.as_user('00000000-0000-4000-8000-000000000005');
select throws_ok('select public.close_tab_on_pos(''00000000-0000-4000-8000-0000000000f1'')', '42501', null, 'another restaurant''s owner cannot');
select throws_ok('select public.close_tab_on_pos(gen_random_uuid())', '42501', null, 'an unknown tab is not allowed');
select pg_temp.as_user('00000000-0000-4000-8000-000000000003');
select lives_ok('select public.close_tab_on_pos(''00000000-0000-4000-8000-0000000000f1'')', 'the server closes the tab on the POS');
reset role;
select is((select status::text from public.tabs where id = '00000000-0000-4000-8000-0000000000f1'), 'closed', 'the tab is closed');
select ok((select pos_closed_at is not null and closed_at is not null from public.tabs where id = '00000000-0000-4000-8000-0000000000f1'),
  'with the POS and close times');
select is((select pos_closed_by from public.tabs where id = '00000000-0000-4000-8000-0000000000f1'),
  '00000000-0000-4000-8000-000000000003'::uuid, 'and who closed it');
create temporary table first_close as select pos_closed_at from public.tabs where id = '00000000-0000-4000-8000-0000000000f1';
grant all on first_close to authenticated;
set local role authenticated;
select lives_ok('select public.close_tab_on_pos(''00000000-0000-4000-8000-0000000000f1'')', 'closing again is harmless');
reset role;
select is((select pos_closed_at from public.tabs where id = '00000000-0000-4000-8000-0000000000f1'), (select pos_closed_at from first_close),
  'and keeps the first POS time');
select is((select count(*) from public.audit_log where action = 'pos_close' and target_id = '00000000-0000-4000-8000-0000000000f1'
  and actor_id = '00000000-0000-4000-8000-000000000003'), 1::bigint, 'the POS close is audited once');

-- Server code (guest pages) still opens tabs with the service role.
set local role service_role;
select lives_ok($$insert into public.tabs (restaurant_id, table_id) values ('00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000e2')$$,
  'server code opens a tab');
reset role;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok('select public.close_tab_on_pos(''00000000-0000-4000-8000-0000000000f1'')', '42501', null, 'anon cannot call close_tab_on_pos');
reset role;

select * from finish();
rollback;
