-- Pass 2 phase 2: QR order limits (per line, per order, per open tab, people per table), staff
-- "Ampliar límite", the Servicio flags, and the shared rate limiter.
begin;
select no_plan();
-- Test helpers (pg_temp functions) are called as signed-in users; new functions get no EXECUTE by
-- default since P2-2, so this transaction (rolled back below) opts back in.
alter default privileges grant execute on functions to public;

insert into public.restaurants (id, slug, name, qr_max_order_cents, qr_max_line_qty, qr_max_tab_cents, max_people_per_table)
  values ('00000000-0000-4000-8000-00000000cafe', 'test-ol', 'Café Lucía', 1000, 3, 1500, 2);
insert into public.menu_sections (id, restaurant_id, name_es, name_en)
  values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000cafe', 'Café', 'Coffee');
insert into public.menu_items (id, restaurant_id, section_id, name_es, name_en, price_cents) values
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

create function pg_temp.maltas(variadic qtys integer[]) returns jsonb language sql as $$
  select jsonb_agg(jsonb_build_object('itemId', '00000000-0000-4000-8000-0000000000b2', 'qty', q, 'modifierOptionIds', '[]'::jsonb, 'note', 'n' || ord))
  from unnest(qtys) with ordinality as x(q, ord) $$;
create function pg_temp.qr(key text, lines jsonb, source public.order_source default 'qr') returns jsonb language sql as $$
  select public.place_order('00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000e4', key, source, lines) $$;
create function pg_temp.device(n integer) returns text language sql as $$ select lpad(n::text, 64, 'a') $$;
create function pg_temp.guest(key text, device integer) returns jsonb language sql as $$
  select public.place_guest_order('00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000e5', key, pg_temp.maltas(1), 'es', pg_temp.device(device), null) $$;

set local role service_role;

-- Per line and per order.
select is(pg_temp.qr('limit-line-0001', pg_temp.maltas(4)) ->> 'detail', 'line', 'a QR line over the quantity cap is refused');
select is((pg_temp.qr('limit-line-0001', pg_temp.maltas(4)) ->> 'max')::integer, 3, 'and says the cap');
select is(pg_temp.qr('limit-order-0001', pg_temp.maltas(3, 3)) ->> 'detail', 'order', 'a QR order over the $ cap is refused');
select is((select count(*) from public.tabs where table_id = '00000000-0000-4000-8000-0000000000e4'), 0::bigint, 'refused orders open no tab');

-- Per open tab: $6 + $6 fits under $15; another $6 doesn't.
select is(pg_temp.qr('limit-tab-0001', pg_temp.maltas(3)) ->> 'status', 'accepted', 'a QR order within the caps is accepted');
select is((select opened_tab from public.orders where idempotency_key = 'limit-tab-0001'), true, 'the QR order that opened the table is flagged');
select is(pg_temp.qr('limit-tab-0002', pg_temp.maltas(3)) ->> 'status', 'accepted', 'a second order fits the tab cap');
select is((select opened_tab from public.orders where idempotency_key = 'limit-tab-0002'), false, 'later orders are not flagged');
select is(pg_temp.qr('limit-tab-0003', pg_temp.maltas(3)) ->> 'detail', 'tab', 'an order past the tab cap is refused');

-- Staff orders are never capped.
select is(pg_temp.qr('limit-staff-0001', pg_temp.maltas(10), 'staff') ->> 'status', 'accepted', 'staff orders ignore QR limits');
select is((select opened_tab from public.orders where idempotency_key = 'limit-staff-0001'), false, 'staff orders are never flagged as new tables');

-- The staff order counts toward the tab ($12 + $20 > $15), so the table needs a raised cap.
reset role;
create temporary table ids (k text primary key, v uuid);
grant all on ids to authenticated;
insert into ids values ('tab', (select id from public.tabs where table_id = '00000000-0000-4000-8000-0000000000e4' and status <> 'closed'));
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}';
select throws_ok(format('select public.raise_tab_limit(%L)', (select v from ids where k = 'tab')), '42501', null, 'the kitchen cannot raise a limit');
set local request.jwt.claims to '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}';
select is(public.raise_tab_limit((select v from ids where k = 'tab')), 3000, 'a server raises the table''s cap by one more tab cap');
select is(public.raise_tab_limit((select v from ids where k = 'tab')), 4500, 'and again');
reset role;
select is(
  (select count(*) from public.audit_log where target_id = (select v from ids where k = 'tab') and action = 'limit_change'),
  2::bigint, 'each raise is audited');
set local role service_role;
select is(pg_temp.qr('limit-tab-0004', pg_temp.maltas(3)) ->> 'status', 'accepted', 'the raised cap lets the table order again');

-- People per table (2 here): a third phone is refused.
select is(pg_temp.guest('people-0001', 1) ->> 'status', 'accepted', 'first phone joins');
select is(pg_temp.guest('people-0002', 2) ->> 'status', 'accepted', 'second phone joins');
select is(pg_temp.guest('people-0003', 3) ->> 'detail', 'table_full', 'the restaurant''s people cap applies');

-- "Pagó y pidió de nuevo": an order from someone who already has a payment on the tab.
reset role;
insert into public.payments (restaurant_id, tab_id, participant_id, method, amount_cents, status, idempotency_key, paid_at)
select '00000000-0000-4000-8000-00000000cafe', p.tab_id, p.id, 'cash', 200, 'paid', 'pay-people-0001', now()
from public.tab_participants p where p.device_hash = pg_temp.device(1);
set local role service_role;
select pg_temp.guest('people-0004', 1);
select is((select after_payment from public.orders where idempotency_key = 'people-0004'), true, 'an order after paying is flagged');
select is((select after_payment from public.orders where idempotency_key = 'people-0002'), false, 'other orders are not');

-- Rate limiter: fixed windows per key.
select is(public.rate_limit_hit('test:a', 2, 60), true, 'first hit is allowed');
select is(public.rate_limit_hit('test:a', 2, 60), true, 'second hit is allowed');
select is(public.rate_limit_hit('test:a', 2, 60), false, 'third hit in the window is refused');
select is(public.rate_limit_hit('test:b', 2, 60), true, 'keys are independent');
reset role;
update public.rate_limits set window_start = now() - interval '2 minutes' where key = 'test:a';
set local role service_role;
select is(public.rate_limit_hit('test:a', 2, 60), true, 'a new window starts over');
select throws_ok($$ select public.rate_limit_hit(repeat('x', 201), 2, 60) $$, '22023', null, 'keys are bounded');

set local role anon;
select throws_ok($$ select public.rate_limit_hit('test:c', 2, 60) $$, '42501', null, 'browsers cannot touch the limiter');

select * from finish();
rollback;
