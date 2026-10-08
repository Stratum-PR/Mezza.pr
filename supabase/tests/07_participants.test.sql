-- Pass 2 phase 1: people at a table. place_guest_order creates a participant per phone on its first
-- order, numbers them in join order, attributes orders, and splits shared dishes into locked shares.
begin;
select no_plan();
-- Test helpers (pg_temp functions) are called as signed-in users; new functions get no EXECUTE by
-- default since P2-2, so this transaction (rolled back below) opts back in.
alter default privileges grant execute on functions to public;

insert into public.restaurants (id, slug, name) values ('00000000-0000-4000-8000-00000000cafe', 'test-pp', 'Café Lucía');
insert into public.menu_sections (id, restaurant_id, name_es, name_en)
  values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000cafe', 'Café', 'Coffee');
insert into public.menu_items (id, restaurant_id, section_id, name_es, name_en, price_cents) values
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000a1', 'Tostones', 'Tostones', 1001),
  ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000a1', 'Malta', 'Malta', 200);
insert into public.dining_tables (id, restaurant_id, label) values
  ('00000000-0000-4000-8000-0000000000e4', '00000000-0000-4000-8000-00000000cafe', '4'),
  ('00000000-0000-4000-8000-0000000000e5', '00000000-0000-4000-8000-00000000cafe', '5');
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000003', 'server@cafe-lucia.test'),
  ('00000000-0000-4000-8000-000000000004', 'kitchen@cafe-lucia.test');
insert into public.memberships (restaurant_id, user_id, role) values
  ('00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-000000000003', 'server'),
  ('00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-000000000004', 'kitchen');

create function pg_temp.device(n integer) returns text language sql as $$ select lpad(n::text, 64, 'a') $$;
create function pg_temp.malta(qty integer default 1, shared boolean default false) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('itemId', '00000000-0000-4000-8000-0000000000b2', 'qty', qty, 'modifierOptionIds', '[]'::jsonb, 'shared', shared)) $$;
create function pg_temp.tostones(qty integer default 1) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('itemId', '00000000-0000-4000-8000-0000000000b1', 'qty', qty, 'modifierOptionIds', '[]'::jsonb, 'shared', true)) $$;
create function pg_temp.place(key text, device integer, lines jsonb, name text default null, tbl text default '00000000-0000-4000-8000-0000000000e4')
returns jsonb language sql as $$
  select public.place_guest_order('00000000-0000-4000-8000-00000000cafe', tbl::uuid, key, lines, 'es', pg_temp.device(device), name) $$;
create function pg_temp.pid(device integer) returns uuid language sql as $$
  select p.id from public.tab_participants p join public.tabs t on t.id = p.tab_id
  where t.table_id = '00000000-0000-4000-8000-0000000000e4' and t.status <> 'closed' and p.device_hash = pg_temp.device(device) $$;

set local role service_role;

-- First phone: becomes participant #1 with its name; the order and its lines are attributed.
select is(pg_temp.place('order-ana-0001', 1, pg_temp.malta(), 'Ana') ->> 'status', 'accepted', 'a guest order is accepted');
select is((select guest_number from public.tab_participants where id = pg_temp.pid(1)), 1, 'the first phone is #1');
select is((select display_name from public.tab_participants where id = pg_temp.pid(1)), 'Ana', 'with the name it gave');
select is((select participant_id from public.orders where idempotency_key = 'order-ana-0001'), pg_temp.pid(1), 'the order is attributed');
select is(
  (select i.participant_id from public.order_items i join public.orders o on o.id = i.order_id where o.idempotency_key = 'order-ana-0001'),
  pg_temp.pid(1), 'and so are its lines');

-- Same phone again: same participant, no new person.
select is(pg_temp.place('order-ana-0002', 1, pg_temp.malta()) ->> 'participant_id', pg_temp.pid(1)::text, 'a phone keeps its participant');
select is((select count(*) from public.tab_participants where restaurant_id = '00000000-0000-4000-8000-00000000cafe'), 1::bigint, 'still one person');

-- A replay returns the original participant even from another phone.
select is(pg_temp.place('order-ana-0001', 9, pg_temp.malta()) ->> 'participant_id', pg_temp.pid(1)::text, 'a replay returns its participant');
select is((select count(*) from public.tab_participants where restaurant_id = '00000000-0000-4000-8000-00000000cafe'), 1::bigint, 'and creates nobody');

-- Second phone, no name: #2 with no name ("Invitado #2" in the UI). Third phone tries a taken name.
select pg_temp.place('order-ben-0001', 2, pg_temp.malta());
select is((select guest_number from public.tab_participants where id = pg_temp.pid(2)), 2, 'the second phone is #2');
select is((select display_name from public.tab_participants where id = pg_temp.pid(2)), null, 'without a name');
select pg_temp.place('order-cam-0001', 3, pg_temp.malta(), 'ANA');
select is((select display_name from public.tab_participants where id = pg_temp.pid(3)), null, 'a taken name (any case) falls back to none');

-- A phone that only browsed never orders, so it is never a participant and never shares.
-- Shared tostones ($10.01) from phone 2: split among the three who ordered, leftover cent to #1.
select pg_temp.place('order-ben-0002', 2, pg_temp.tostones());
select is(
  (select array_agg(s.cents order by p.guest_number) from public.order_item_shares s join public.tab_participants p on p.id = s.participant_id where s.restaurant_id = '00000000-0000-4000-8000-00000000cafe'),
  array[334, 334, 333], 'a shared dish is split in locked shares among people who have ordered');
select is((select sum(cents) from public.order_item_shares where restaurant_id = '00000000-0000-4000-8000-00000000cafe')::integer, 1001, 'shares sum to the line');

-- A fourth phone whose first order is shared: included in its own split.
select pg_temp.place('order-dee-0001', 4, pg_temp.tostones(2));
select is(
  (select count(*) from public.order_item_shares s join public.order_items i on i.id = s.order_item_id
   join public.orders o on o.id = i.order_id where o.idempotency_key = 'order-dee-0001'),
  4::bigint, 'the orderer is in the split of its own first order');
select is(
  (select sum(s.cents) from public.order_item_shares s join public.order_items i on i.id = s.order_item_id
   join public.orders o on o.id = i.order_id where o.idempotency_key = 'order-dee-0001')::integer,
  2002, 'a multi-quantity shared line splits its full amount');
-- Earlier shares are locked: the newcomer didn't join the first split.
select is(
  (select count(*) from public.order_item_shares s join public.order_items i on i.id = s.order_item_id
   join public.orders o on o.id = i.order_id where o.idempotency_key = 'order-ben-0002'),
  3::bigint, 'earlier shares stay as they were');

-- Rename: own participant only; a taken name is refused.
select is(public.rename_participant((select tab_id from public.tab_participants where id = pg_temp.pid(2)), pg_temp.device(2), 'Ben'), 'ok', 'a phone renames itself');
select is(public.rename_participant((select tab_id from public.tab_participants where id = pg_temp.pid(3)), pg_temp.device(3), 'ben'), 'name_taken', 'a taken name is refused');
select throws_ok(
  format('select public.rename_participant(%L, %L, %L)', (select tab_id from public.tab_participants where id = pg_temp.pid(1)), pg_temp.device(7), 'X'),
  '42501', null, 'an unknown phone cannot rename anyone');

-- The table caps at 20 people; a 21st phone is refused, existing ones keep ordering.
do $$ begin
  for n in 5..20 loop
    perform pg_temp.place('order-fill-' || lpad(n::text, 4, '0'), n, pg_temp.malta());
  end loop;
end $$;
select is((select count(*) from public.tab_participants where restaurant_id = '00000000-0000-4000-8000-00000000cafe')::integer, 20, 'twenty people at the table');
select is(pg_temp.place('order-full-0001', 21, pg_temp.malta()) ->> 'detail', 'table_full', 'a 21st phone is refused');
select is(pg_temp.place('order-ana-0003', 1, pg_temp.malta()) ->> 'status', 'accepted', 'people already at the table still order');

-- A new tab (next party) means new participants, even for the same phone.
select pg_temp.place('order-other-0001', 1, pg_temp.malta(), null, '00000000-0000-4000-8000-0000000000e5');
select is((select count(*) from public.tab_participants where restaurant_id = '00000000-0000-4000-8000-00000000cafe' and device_hash = pg_temp.device(1)), 2::bigint, 'the same phone is a new person on another tab');

-- Bad device hashes are refused.
select is(
  public.place_guest_order('00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000e4', 'order-bad-0001', pg_temp.malta(), 'es', 'short', null) ->> 'detail',
  'device', 'a malformed device hash is refused');

-- Staff: attribute a staff order and re-share a line.
reset role;
create temporary table ids (k text primary key, v uuid);
grant all on ids to authenticated;
insert into ids values
  ('order', (public.place_order('00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000e4', 'order-staff-0001', 'staff', pg_temp.malta(1, true)) ->> 'order_id')::uuid),
  ('ana', pg_temp.pid(1)), ('ben', pg_temp.pid(2)),
  ('line', (select i.id from public.order_items i join public.orders o on o.id = i.order_id where o.idempotency_key = 'order-ben-0002'));
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}';

select lives_ok(format('select public.attribute_staff_order(%L, %L)', (select v from ids where k = 'order'), (select v from ids where k = 'ana')), 'a server attributes a staff order');
select is((select participant_id from public.orders where id = (select v from ids where k = 'order')), (select v from ids where k = 'ana'), 'to one person');
select is(
  (select count(*) from public.order_item_shares s join public.order_items i on i.id = s.order_item_id where i.order_id = (select v from ids where k = 'order'))::integer,
  20, 'its shared lines are split among everyone who has ordered');
select lives_ok(
  format('select public.set_item_shares(%L, array[%L, %L]::uuid[])', (select v from ids where k = 'line'), (select v from ids where k = 'ana'), (select v from ids where k = 'ben')),
  'a server re-shares a line');
select is(
  (select array_agg(cents order by cents desc) from public.order_item_shares where order_item_id = (select v from ids where k = 'line')),
  array[501, 500], 'evenly among the chosen people');
select throws_ok(
  format('select public.set_item_shares(%L, array[gen_random_uuid()])', (select v from ids where k = 'line')),
  '22023', null, 'shares go only to people at the table');

set local request.jwt.claims to '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}';
select throws_ok(
  format('select public.set_item_shares(%L, array[%L]::uuid[])', (select v from ids where k = 'line'), (select v from ids where k = 'ana')),
  '42501', null, 'the kitchen cannot change shares');

-- Guests never call these from the browser.
set local role anon;
select throws_ok(
  format('select public.place_guest_order(%L, %L, %L, %L, %L, %L, null)', '00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000e4', 'order-anon-0001', pg_temp.malta(), 'es', pg_temp.device(1)),
  '42501', null, 'anon cannot place guest orders directly');

select * from finish();
rollback;
