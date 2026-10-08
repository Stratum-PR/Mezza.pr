-- P0-2 (issue #5): staff roles change only through server code (Equipo, the setup wizard), which uses
-- the service role after checking who may do what. Signed-in users never write memberships directly,
-- so a manager cannot promote staff or add people, and nobody signed in reads PIN hashes.
begin;
select no_plan();

insert into public.restaurants (id, slug, name) values ('00000000-0000-4000-8000-00000000cafe', 'test-mw', 'Café Lucía');
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000001', 'owner@cafe-lucia.test'),
  ('00000000-0000-4000-8000-000000000002', 'manager@cafe-lucia.test'),
  ('00000000-0000-4000-8000-000000000003', 'server@cafe-lucia.test'),
  ('00000000-0000-4000-8000-000000000004', 'kitchen@cafe-lucia.test'),
  ('00000000-0000-4000-8000-000000000006', 'someone@else.test');
insert into public.memberships (restaurant_id, user_id, role, pin_hash) values
  ('00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-000000000001', 'owner', 'hash-owner'),
  ('00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-000000000002', 'manager', 'hash-manager'),
  ('00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-000000000003', 'server', 'hash-server'),
  ('00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-000000000004', 'kitchen', 'hash-kitchen');
insert into public.profiles (user_id, full_name) values
  ('00000000-0000-4000-8000-000000000003', 'Server')
  on conflict (user_id) do update set full_name = excluded.full_name;

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

create function pg_temp.no_membership_writes(p_who text) returns setof text language plpgsql as $$
declare
  s text;
  r uuid := '00000000-0000-4000-8000-00000000cafe';
begin
  foreach s in array array[
    format('update public.memberships set role = ''manager'' where restaurant_id = %L and role = ''server''', r),
    format('update public.memberships set role = ''owner'' where restaurant_id = %L and user_id = auth.uid()', r),
    format('update public.memberships set active = false where restaurant_id = %L and role <> ''owner''', r),
    format('update public.memberships set pin_hash = ''x'' where restaurant_id = %L', r),
    format('delete from public.memberships where restaurant_id = %L and role = ''kitchen''', r)
  ] loop
    return next is(pg_temp.changed(s), 0::bigint, format('%s changes nothing: %s', p_who, left(s, 70)));
  end loop;
  foreach s in array array[
    format('insert into public.memberships (restaurant_id, user_id, role) values (%L, ''00000000-0000-4000-8000-000000000006'', ''manager'')', r),
    format('insert into public.memberships (restaurant_id, user_id, role) values (%L, ''00000000-0000-4000-8000-000000000006'', ''server'')', r)
  ] loop
    return next throws_ok(s, '42501', null, format('%s cannot add members: %s', p_who, right(s, 50)));
  end loop;
  return next throws_ok('select pin_hash from public.memberships', '42501', null, p_who || ' cannot read PIN hashes');
end $$;

set local role authenticated;
select pg_temp.as_user('00000000-0000-4000-8000-000000000002');
select * from pg_temp.no_membership_writes('manager');
select is((select count(*) from public.memberships), 4::bigint, 'the manager still reads the team');
select is((select role::text from public.memberships where user_id = '00000000-0000-4000-8000-000000000003'), 'server', 'with each role');
select is((select full_name from public.profiles where user_id = '00000000-0000-4000-8000-000000000003'), 'Server', 'and their names');

select pg_temp.as_user('00000000-0000-4000-8000-000000000001');
select * from pg_temp.no_membership_writes('owner');
select is((select count(*) from public.memberships), 4::bigint, 'the owner still reads the team');

select pg_temp.as_user('00000000-0000-4000-8000-000000000003');
select * from pg_temp.no_membership_writes('server');
select is((select role::text from public.memberships where user_id = auth.uid()), 'server', 'the server reads their own role');

select pg_temp.as_user('00000000-0000-4000-8000-000000000004');
select * from pg_temp.no_membership_writes('kitchen');

reset role;
select is((select string_agg(role::text || ':' || active, ',' order by role) from public.memberships
  where restaurant_id = '00000000-0000-4000-8000-00000000cafe'),
  'owner:true,manager:true,server:true,kitchen:true', 'the team is unchanged');
select is((select count(*) from public.memberships
  where restaurant_id = '00000000-0000-4000-8000-00000000cafe' and pin_hash like 'hash-%'), 4::bigint, 'and so are the PINs');

-- The app's path (service role, after its own checks) still works.
set local role service_role;
select lives_ok(
  'insert into public.memberships (restaurant_id, user_id, role) values (''00000000-0000-4000-8000-00000000cafe'', ''00000000-0000-4000-8000-000000000006'', ''server'')',
  'server code adds a member');
select is(pg_temp.changed('update public.memberships set role = ''kitchen'' where user_id = ''00000000-0000-4000-8000-000000000006'''),
  1::bigint, 'and changes their role');
reset role;

select * from finish();
rollback;
