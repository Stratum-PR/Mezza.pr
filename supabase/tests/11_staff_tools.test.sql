-- Pass 2 phase 5: staff tools. Moving unpaid lines, voids that refund each payer, write-offs that
-- cover without being sales, closing a settled table, and closing idle settled tables.
begin;
select no_plan();
-- Test helpers (pg_temp functions) are called as signed-in users; new functions get no EXECUTE by
-- default since P2-2, so this transaction (rolled back below) opts back in.
alter default privileges grant execute on functions to public;

insert into public.restaurants (id, slug, name) values ('00000000-0000-4000-8000-00000000cafe', 'test-st', 'Café Lucía');
insert into public.menu_sections (id, restaurant_id, name_es, name_en)
  values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000cafe', 'Café', 'Coffee');
insert into public.menu_items (id, restaurant_id, section_id, name_es, name_en, price_cents) values
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000a1', 'Malta', 'Malta', 200),
  ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000a1', 'Mofongo', 'Mofongo', 1400);
insert into public.dining_tables (restaurant_id, label)
  select '00000000-0000-4000-8000-00000000cafe', 't' || n from generate_series(1, 6) as n;
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000002', 'manager@cafe-lucia.test'),
  ('00000000-0000-4000-8000-000000000003', 'server@cafe-lucia.test'),
  ('00000000-0000-4000-8000-000000000004', 'kitchen@cafe-lucia.test');
insert into public.memberships (restaurant_id, user_id, role) values
  ('00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-000000000002', 'manager'),
  ('00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-000000000003', 'server'),
  ('00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-000000000004', 'kitchen');

create function pg_temp.tbl(label text) returns uuid language sql as $$
  select id from public.dining_tables where restaurant_id = '00000000-0000-4000-8000-00000000cafe' and label = $1 $$;
create function pg_temp.device(tbl text, n integer) returns text language sql as $$ select encode(sha256(convert_to(tbl || ':' || n, 'utf8')), 'hex') $$;
create function pg_temp.order(tbl text, person integer, item uuid) returns jsonb language sql as $$
  select public.place_guest_order('00000000-0000-4000-8000-00000000cafe', pg_temp.tbl(tbl), gen_random_uuid()::text,
    jsonb_build_array(jsonb_build_object('itemId', item, 'qty', 1, 'modifierOptionIds', '[]'::jsonb)), 'es', pg_temp.device(tbl, person), null) $$;
create function pg_temp.tab(tbl text) returns uuid language sql as $$
  select id from public.tabs where table_id = pg_temp.tbl(tbl) and status <> 'closed' $$;
create function pg_temp.who(tbl text, person integer) returns uuid language sql as $$
  select id from public.tab_participants where tab_id = pg_temp.tab(tbl) and device_hash = pg_temp.device(tbl, person) $$;
create function pg_temp.line(tbl text, person integer) returns uuid language sql as $$
  select i.id from public.order_items i join public.orders o on o.id = i.order_id
  where o.tab_id = pg_temp.tab(tbl) and o.participant_id = pg_temp.who(tbl, person) and i.voided_at is null order by i.created_at limit 1 $$;
create function pg_temp.owed(tbl text) returns integer language sql as $$
  select coalesce(sum(c_cents - c_covered), 0)::integer from public.tab_charges(pg_temp.tab(tbl)) $$;
create function pg_temp.as_user(id text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, true) $$;

create temporary table ids (k text primary key, v uuid);
grant all on ids to authenticated, service_role;

-- t1: Ana (malta $2) and Ben (mofongo $14).
set local role service_role;
select pg_temp.order('t1', 1, '00000000-0000-4000-8000-0000000000b1');
select pg_temp.order('t1', 2, '00000000-0000-4000-8000-0000000000b2');
insert into ids values ('t1', pg_temp.tab('t1')), ('ana', pg_temp.who('t1', 1)), ('ben', pg_temp.who('t1', 2)),
  ('malta', pg_temp.line('t1', 1)), ('mofongo', pg_temp.line('t1', 2));
reset role;

-- Moving an unpaid line: to Ben, then to the table.
set local role authenticated;
select pg_temp.as_user('00000000-0000-4000-8000-000000000003');
select lives_ok(format('select public.move_order_item(%L, %L)', (select v from ids where k = 'malta'), (select v from ids where k = 'ben')), 'a server moves Ana''s malta to Ben');
select is((select participant_id from public.order_items where id = (select v from ids where k = 'malta')), (select v from ids where k = 'ben'), 'it is Ben''s now');
select lives_ok(format('select public.move_order_item(%L)', (select v from ids where k = 'malta')), 'and to the table');
select is((select participant_id from public.order_items where id = (select v from ids where k = 'malta')), null, 'it is the table''s now');
select throws_ok(format('select public.move_order_item(%L, gen_random_uuid())', (select v from ids where k = 'malta')), '22023', null, 'only to people at this table');
select pg_temp.as_user('00000000-0000-4000-8000-000000000004');
select throws_ok(format('select public.move_order_item(%L)', (select v from ids where k = 'malta')), '42501', null, 'the kitchen cannot move lines');

-- Ben pays his mofongo (pending): it can't move or be voided until the payment resolves.
reset role;
set local role service_role;
insert into ids values ('ben-pay', (public.create_tab_payment((select v from ids where k = 't1'), 'mine', 'cash', 'st-ben-0001', (select v from ids where k = 'ben')) ->> 'payment_id')::uuid);
reset role;
set local role authenticated;
select pg_temp.as_user('00000000-0000-4000-8000-000000000003');
select throws_ok(format('select public.move_order_item(%L)', (select v from ids where k = 'mofongo')), '22023', null, 'a line with a payment cannot move');
select pg_temp.as_user('00000000-0000-4000-8000-000000000002');
select throws_ok(
  format('select public.void_line((select order_id from public.order_items where id = %L), %L, %L)', (select v from ids where k = 'mofongo'), 'devuelto', (select v from ids where k = 'mofongo')),
  '22023', null, 'a line held by a pending payment cannot be voided');
select throws_ok(
  format('select public.void_order((select order_id from public.order_items where id = %L), %L, %L)', (select v from ids where k = 'mofongo'), 'devuelto', (select v from ids where k = 'mofongo')),
  '22023', null, 'not through the old path either');

-- Paid, then voided: Ben is refunded his mofongo plus its IVU.
reset role;
update public.payments set status = 'paid', paid_at = now() where id = (select v from ids where k = 'ben-pay');
set local role authenticated;
select pg_temp.as_user('00000000-0000-4000-8000-000000000003');
select throws_ok(
  format('select public.void_line((select order_id from public.order_items where id = %L), %L, %L)', (select v from ids where k = 'mofongo'), 'devuelto', (select v from ids where k = 'mofongo')),
  '42501', null, 'servers cannot void');
select pg_temp.as_user('00000000-0000-4000-8000-000000000002');
create temporary table v (r jsonb);
grant all on v to authenticated;
insert into v select public.void_line((select order_id from public.order_items where id = (select v from ids where k = 'mofongo')), 'devuelto', (select v from ids where k = 'mofongo'));
select is((select (r -> 'refunds' -> 0 ->> 'amount_cents')::integer from v), 1400 + 147 + 14, 'the refund is his part plus its IVU');
select is((select (r -> 'refunds' -> 0 ->> 'participant_id')::uuid from v), (select v from ids where k = 'ben'), 'to Ben, who paid it');
select is((select status::text from public.payments where id = (select v from ids where k = 'ben-pay')), 'refunded', 'his payment is fully refunded');
select is(pg_temp.owed('t1'), 200, 'only the malta is left');

-- Voiding an unpaid line just lowers what's owed (no refund).
reset role;
set local role service_role;
select pg_temp.order('t1', 1, '00000000-0000-4000-8000-0000000000b1');
reset role;
set local role authenticated;
select pg_temp.as_user('00000000-0000-4000-8000-000000000002');
select is(
  public.void_line((select order_id from public.order_items where id = (select i.id from public.order_items i join public.orders o on o.id = i.order_id
    where o.tab_id = (select v from ids where k = 't1') and i.participant_id = (select v from ids where k = 'ana') and i.voided_at is null limit 1)), 'no lo quiso') -> 'refunds',
  '[]'::jsonb, 'an unpaid void refunds nobody');
select is(pg_temp.owed('t1'), 200, 'and lowers what is owed');

-- Write-offs: managers only, with a reason; covered, not sales.
select pg_temp.as_user('00000000-0000-4000-8000-000000000003');
select throws_ok(format('select public.write_off(%L, %L, %L)', (select v from ids where k = 't1'), 'balance', 'se fue'), '42501', null, 'servers cannot write off');
select pg_temp.as_user('00000000-0000-4000-8000-000000000002');
select throws_ok(format('select public.write_off(%L, %L, %L)', (select v from ids where k = 't1'), 'balance', 'x'), '22023', null, 'a reason is required');
select throws_ok(format('select public.write_off(%L, %L, %L)', (select v from ids where k = 't1'), 'person', 'se fue'), '22023', null, 'a person write-off names the person');
select is((public.write_off((select v from ids where k = 't1'), 'table', 'se fue sin pagar') ->> 'cents')::integer, 200, 'the table''s malta is written off');
select is(pg_temp.owed('t1'), 0, 'nothing is owed');
select is((select count(*) from public.payments where tab_id = (select v from ids where k = 't1') and status <> 'failed'), 1::bigint, 'a write-off is not a payment');
select throws_ok(format('select public.write_off(%L, %L, %L)', (select v from ids where k = 't1'), 'balance', 'otra vez'), '22023', null, 'nothing left to write off');
reset role;
set local role service_role;
select is(public.create_tab_payment((select v from ids where k = 't1'), 'balance', 'cash', 'st-after-wo-0001') ->> 'reason', 'nothing_to_pay', 'and nothing left to pay');
reset role;

-- Reports see the voids and write-offs apart.
set local role authenticated;
select pg_temp.as_user('00000000-0000-4000-8000-000000000002');
select is((public.period_adjustments('00000000-0000-4000-8000-00000000cafe', current_date - 1, current_date + 1) ->> 'writeOffsCents')::integer, 200, 'write-offs in the period');
select is((public.period_adjustments('00000000-0000-4000-8000-00000000cafe', current_date - 1, current_date + 1) ->> 'voidsCents')::integer, 1600, 'voids in the period');
select pg_temp.as_user('00000000-0000-4000-8000-000000000003');
select throws_ok($$ select public.period_adjustments('00000000-0000-4000-8000-00000000cafe', current_date, current_date) $$, '42501', null, 'servers do not see report adjustments');

-- Closing: only a settled table; the next order starts a new tab with new people.
select lives_ok(format('select public.close_tab(%L)', (select v from ids where k = 't1')), '"Mesa libre" closes a settled table');
reset role;
set local role service_role;
select pg_temp.order('t1', 1, '00000000-0000-4000-8000-0000000000b1');
select isnt(pg_temp.tab('t1'), (select v from ids where k = 't1'), 'the next order opens a new tab');
select isnt(pg_temp.who('t1', 1), (select v from ids where k = 'ana'), 'and the same phone is a new person');
reset role;
set local role authenticated;
select pg_temp.as_user('00000000-0000-4000-8000-000000000003');
select throws_ok(format('select public.close_tab(%L)', pg_temp.tab('t1')), '22023', null, 'a table that still owes cannot close');

-- Idle tables: settled and quiet for 10 minutes close on their own; others stay.
reset role;
set local role service_role;
select pg_temp.order('t2', 1, '00000000-0000-4000-8000-0000000000b1');
select pg_temp.order('t3', 1, '00000000-0000-4000-8000-0000000000b1');
select pg_temp.order('t4', 1, '00000000-0000-4000-8000-0000000000b1');
select public.create_tab_payment(pg_temp.tab('t2'), 'balance', 'cash', 'st-t2-0001');
select public.create_tab_payment(pg_temp.tab('t4'), 'balance', 'cash', 'st-t4-0001');
update public.payments set status = 'paid', paid_at = now() where idempotency_key in ('st-t2-0001', 'st-t4-0001');
reset role;
-- t2 settled and quiet; t3 quiet but owes; t4 settled but paid just now.
update public.orders set created_at = now() - interval '30 minutes' where tab_id in (pg_temp.tab('t2'), pg_temp.tab('t3'), pg_temp.tab('t4'));
update public.payments set paid_at = now() - interval '15 minutes', created_at = now() - interval '15 minutes' where tab_id = pg_temp.tab('t2');
insert into ids values ('t2', pg_temp.tab('t2'));
set local role service_role;
select is(public.close_idle_tabs('00000000-0000-4000-8000-00000000cafe'), 1, 'one idle settled table closes');
select is((select status::text from public.tabs where id = (select v from ids where k = 't2')), 'closed', 'the paid, quiet table');
select isnt(pg_temp.tab('t3'), null, 'a quiet table that owes stays open');
select isnt(pg_temp.tab('t4'), null, 'a table paid just now stays open');

-- A pending payment left for 15 minutes is abandoned by the same housekeeping (the phone can pay again).
select pg_temp.order('t5', 1, '00000000-0000-4000-8000-0000000000b1');
select public.create_tab_payment(pg_temp.tab('t5'), 'balance', 'cash', 'st-t5-0001');
reset role;
update public.payments set created_at = now() - interval '16 minutes' where idempotency_key = 'st-t5-0001';
set local role service_role;
select public.close_idle_tabs('00000000-0000-4000-8000-00000000cafe');
select is((select status::text from public.payments where idempotency_key = 'st-t5-0001'), 'failed', 'a lapsed pending payment is abandoned');
select is(pg_temp.owed('t5'), 200, 'and what it held is owed again');
reset role;
set local role authenticated;
select pg_temp.as_user('00000000-0000-4000-8000-000000000003');
select throws_ok($$ select public.close_idle_tabs(gen_random_uuid()) $$, '42501', null, 'staff only close their own restaurant''s tables');

select * from finish();
rollback;
