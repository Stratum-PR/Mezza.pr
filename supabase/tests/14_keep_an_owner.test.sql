-- P0-3 (issue #6): every restaurant keeps at least one active owner, whoever writes memberships
-- (server code uses the service role, so this is the database's rule, not the app's). Checked at
-- commit, so an ownership transfer inside one transaction works.
begin;
select no_plan();

insert into public.restaurants (id, slug, name) values
  ('00000000-0000-4000-8000-00000000cafe', 'test-ko', 'Café Lucía'),
  ('00000000-0000-4000-8000-00000000ba22', 'test-ko-barra', 'Barra Test');
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000001', 'owner@cafe-lucia.test'),
  ('00000000-0000-4000-8000-000000000002', 'manager@cafe-lucia.test'),
  ('00000000-0000-4000-8000-000000000005', 'owner@barra-test.test');
insert into public.memberships (restaurant_id, user_id, role) values
  ('00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-000000000001', 'owner'),
  ('00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-000000000002', 'manager'),
  ('00000000-0000-4000-8000-00000000ba22', '00000000-0000-4000-8000-000000000005', 'owner');

set local role service_role;

-- What the setup wizard's upsert did when the owner typed their own email as staff.
savepoint s;
select throws_ok($$
  insert into public.memberships (restaurant_id, user_id, role, active)
  values ('00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-000000000001', 'server', true)
  on conflict (user_id, restaurant_id) do update set role = excluded.role, active = excluded.active;
  set constraints all immediate $$,
  '23514', null, 'the only owner cannot be turned into staff');
rollback to savepoint s;

savepoint s;
select throws_ok($$
  update public.memberships set active = false where user_id = '00000000-0000-4000-8000-000000000001';
  set constraints all immediate $$,
  '23514', null, 'the only owner cannot be deactivated');
rollback to savepoint s;

savepoint s;
select throws_ok($$
  delete from public.memberships where user_id = '00000000-0000-4000-8000-000000000001';
  set constraints all immediate $$,
  '23514', null, 'the only owner cannot be removed');
rollback to savepoint s;

savepoint s;
select throws_ok($$
  update public.memberships set restaurant_id = '00000000-0000-4000-8000-00000000ba22'
  where user_id = '00000000-0000-4000-8000-000000000001';
  set constraints all immediate $$,
  '23514', null, 'the only owner cannot be moved to another restaurant');
rollback to savepoint s;

-- Allowed: a transfer (the new owner arrives in the same transaction), a second owner stepping down,
-- staff changes, and deleting the whole restaurant.
savepoint s;
select lives_ok($$
  update public.memberships set role = 'manager' where user_id = '00000000-0000-4000-8000-000000000001';
  update public.memberships set role = 'owner' where user_id = '00000000-0000-4000-8000-000000000002';
  set constraints all immediate $$,
  'ownership can be handed over in one transaction');
rollback to savepoint s;

savepoint s;
select lives_ok($$
  update public.memberships set role = 'owner' where user_id = '00000000-0000-4000-8000-000000000002';
  update public.memberships set active = false where user_id = '00000000-0000-4000-8000-000000000001';
  set constraints all immediate $$,
  'with a second owner, one can be deactivated');
rollback to savepoint s;

savepoint s;
select lives_ok($$
  update public.memberships set role = 'server' where user_id = '00000000-0000-4000-8000-000000000002';
  delete from public.memberships where user_id = '00000000-0000-4000-8000-000000000002';
  set constraints all immediate $$,
  'staff memberships change freely');
rollback to savepoint s;

reset role;
savepoint s;
select lives_ok($$
  delete from public.restaurants where id = '00000000-0000-4000-8000-00000000ba22';
  set constraints all immediate $$,
  'deleting a restaurant removes its owner with it');
rollback to savepoint s;

select is((select count(*) from public.memberships where role = 'owner' and active
  and restaurant_id in ('00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-00000000ba22')),
  2::bigint, 'both restaurants still have their owner');

select * from finish();
rollback;
