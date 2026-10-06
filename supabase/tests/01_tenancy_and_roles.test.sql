-- Cross-tenant isolation and role limits. Builds two restaurants (Café Lucía and Barra Test) with a
-- row in every tenant table, then checks what each signed-in role can see and change.
begin;
select no_plan();

create schema tests;
grant usage on schema tests to authenticated, service_role;

create function tests.id(p_rid uuid, p_key text) returns uuid
language sql immutable as $$ select md5(p_rid::text || ':' || p_key)::uuid $$;

-- Every tenant table (security definer so the list doesn't depend on the caller's privileges).
create function tests.tenant_tables() returns setof text
language sql stable security definer as $$
  select c.table_name::text
  from information_schema.columns c
  join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
  where c.table_schema = 'public' and c.column_name = 'restaurant_id' and t.table_type = 'BASE TABLE'
  order by 1
$$;

-- Runs as the caller, so row-level security applies.
create function tests.count_rows(p_table text, p_rid uuid) returns bigint
language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from public.%I where restaurant_id = $1', p_table) into n using p_rid;
  return n;
end $$;

create function tests.affected(p_sql text) returns bigint
language plpgsql as $$
declare n bigint;
begin
  execute format('with x as (%s returning 1) select count(*) from x', p_sql) into n;
  return n;
end $$;

create function tests.build_restaurant(p_rid uuid, p_slug text, p_name text) returns void
language plpgsql as $$
begin
  insert into public.restaurants (id, slug, name) values (p_rid, p_slug, p_name);
  insert into public.menu_sections (id, restaurant_id, name_es, name_en)
    values (tests.id(p_rid, 'section'), p_rid, 'Café', 'Coffee');
  insert into public.menu_items (id, restaurant_id, section_id, name_es, name_en, price_cents)
    values (tests.id(p_rid, 'item'), p_rid, tests.id(p_rid, 'section'), 'Café con leche', 'Café con leche', 250);
  insert into public.menu_items (id, restaurant_id, section_id, name_es, name_en, price_cents, is_available, sold_out_since)
    values (tests.id(p_rid, 'flan'), p_rid, tests.id(p_rid, 'section'), 'Flan de queso', 'Cheese flan', 400, false, now());
  insert into public.item_availability_events (restaurant_id, item_id, sold_out_at)
    values (p_rid, tests.id(p_rid, 'flan'), now());
  insert into public.modifier_groups (id, restaurant_id, name_es, name_en, min_select, max_select)
    values (tests.id(p_rid, 'milk'), p_rid, 'Leche', 'Milk', 1, 1);
  insert into public.modifier_options (id, restaurant_id, group_id, name_es, name_en, price_cents) values
    (tests.id(p_rid, 'whole'), p_rid, tests.id(p_rid, 'milk'), 'Entera', 'Whole', 0),
    (tests.id(p_rid, 'oat'), p_rid, tests.id(p_rid, 'milk'), 'Avena', 'Oat', 75);
  insert into public.item_modifier_groups (restaurant_id, item_id, group_id)
    values (p_rid, tests.id(p_rid, 'item'), tests.id(p_rid, 'milk'));
  insert into public.menu_themes (restaurant_id, palette, display_font, body_font)
    values (p_rid, '{"ink":"#1F4D3A","paper":"#F3E9D2"}', 'Playfair Display', 'Josefin Sans');
  insert into public.menu_uploads (id, restaurant_id, storage_path, mime_type, status)
    values (tests.id(p_rid, 'upload'), p_rid, p_rid || '/menu.pdf', 'application/pdf', 'review');
  insert into public.original_menu_pages (id, restaurant_id, image_path, width, height, page_number)
    values (tests.id(p_rid, 'page'), p_rid, p_rid || '/page-1.png', 600, 1800, 1);
  insert into public.item_hotspots (restaurant_id, item_id, page_id, x, y, width, height)
    values (p_rid, tests.id(p_rid, 'item'), tests.id(p_rid, 'page'), 0.1, 0.1, 0.8, 0.03);
  insert into public.dining_tables (id, restaurant_id, label, seats) values
    (tests.id(p_rid, 'table'), p_rid, '4', 4),
    (tests.id(p_rid, 'table2'), p_rid, '5', 2);
  insert into public.qr_designs (restaurant_id) values (p_rid);
  insert into public.guests (id, restaurant_id, phone_e164) values (tests.id(p_rid, 'guest'), p_rid, '+17875550100');
  insert into public.tabs (id, restaurant_id, table_id, party_size)
    values (tests.id(p_rid, 'tab'), p_rid, tests.id(p_rid, 'table'), 2);
  insert into public.tab_participants (id, restaurant_id, tab_id, display_name, guest_id)
    values (tests.id(p_rid, 'participant'), p_rid, tests.id(p_rid, 'tab'), 'Ana', tests.id(p_rid, 'guest'));
  insert into public.cart_items (restaurant_id, tab_id, participant_id, item_id, qty)
    values (p_rid, tests.id(p_rid, 'tab'), tests.id(p_rid, 'participant'), tests.id(p_rid, 'item'), 1);
  insert into public.service_requests (restaurant_id, tab_id, kind) values (p_rid, tests.id(p_rid, 'tab'), 'call_server');
  insert into public.devices (id, restaurant_id, name, kind) values (tests.id(p_rid, 'device'), p_rid, 'Tablet', 'kitchen');
  insert into public.orders (id, restaurant_id, tab_id, number, source, idempotency_key)
    values (tests.id(p_rid, 'order'), p_rid, tests.id(p_rid, 'tab'), 900, 'staff', 'fixture-order-0001');
  insert into public.order_items (id, restaurant_id, order_id, item_id, name_snapshot_es, name_snapshot_en, unit_price_cents, qty)
    values (tests.id(p_rid, 'line'), p_rid, tests.id(p_rid, 'order'), tests.id(p_rid, 'item'), 'Café con leche', 'Café con leche', 250, 2);
  insert into public.orders (id, restaurant_id, tab_id, number, source, idempotency_key)
    values (tests.id(p_rid, 'order2'), p_rid, tests.id(p_rid, 'tab'), 901, 'qr', 'fixture-order-0002');
  insert into public.order_items (id, restaurant_id, order_id, item_id, name_snapshot_es, name_snapshot_en, unit_price_cents, qty)
    values (tests.id(p_rid, 'line2'), p_rid, tests.id(p_rid, 'order2'), tests.id(p_rid, 'item'), 'Café con leche', 'Café con leche', 250, 1);
  insert into public.order_item_shares (restaurant_id, order_item_id, participant_id, cents)
    values (p_rid, tests.id(p_rid, 'line2'), tests.id(p_rid, 'participant'), 250);
  insert into public.payments (id, restaurant_id, tab_id, method, amount_cents, tip_cents, ivu_state_cents, ivu_municipal_cents, status, idempotency_key, paid_at)
    values (tests.id(p_rid, 'payment'), p_rid, tests.id(p_rid, 'tab'), 'cash', 500, 90, 53, 5, 'paid', 'fixture-pay-0001', now());
  insert into public.refunds (restaurant_id, payment_id, amount_cents, reason) values (p_rid, tests.id(p_rid, 'payment'), 100, 'Fixture');
  insert into public.payment_allocations (restaurant_id, payment_id, order_item_id, cents)
    values (p_rid, tests.id(p_rid, 'payment'), tests.id(p_rid, 'line'), 500);
  insert into public.write_offs (id, restaurant_id, tab_id, scope, cents, reason)
    values (tests.id(p_rid, 'writeoff'), p_rid, tests.id(p_rid, 'tab'), 'table', 250, 'Fixture');
  insert into public.write_off_allocations (restaurant_id, write_off_id, order_item_id, cents)
    values (p_rid, tests.id(p_rid, 'writeoff'), tests.id(p_rid, 'line2'), 250);
  insert into public.split_plans (id, restaurant_id, tab_id, parts) values (tests.id(p_rid, 'plan'), p_rid, tests.id(p_rid, 'tab'), 2);
  insert into public.split_plan_units (restaurant_id, plan_id, order_item_id)
    values (p_rid, tests.id(p_rid, 'plan'), tests.id(p_rid, 'line2'));
  insert into public.payment_accounts (restaurant_id, provider) values (p_rid, 'stripe');
  insert into public.printers (id, restaurant_id, name, role) values (tests.id(p_rid, 'printer'), p_rid, 'Cocina', 'kitchen');
  insert into public.print_jobs (restaurant_id, order_id, printer_id, kind)
    values (p_rid, tests.id(p_rid, 'order'), tests.id(p_rid, 'printer'), 'kitchen');
  insert into public.daily_sales (restaurant_id, date, hour, sales_cents) values (p_rid, current_date, 9, 500);
  insert into public.item_sales_daily (restaurant_id, item_id, date, units) values (p_rid, tests.id(p_rid, 'item'), current_date, 2);
  insert into public.exports (restaurant_id, kind, period, file_path) values (p_rid, 'sales_csv', '2026-09', p_rid || '/sales.csv');
  insert into public.audit_log (restaurant_id, action, target_table) values (p_rid, 'price_change', 'menu_items');
  insert into public.subscriptions (restaurant_id, plan) values (p_rid, 'A');
  insert into public.usage_fees (restaurant_id, period) values (p_rid, date_trunc('month', current_date)::date);
  insert into public.support_access_grants (restaurant_id, expires_at, reason) values (p_rid, now() + interval '1 day', 'Fixture');
end $$;

-- Everything the signed-in user must NOT be able to do to restaurant p_other.
create function tests.assert_isolated(p_who text, p_other uuid) returns setof text
language plpgsql as $$
declare
  t text;
  s text;
begin
  for t in select * from tests.tenant_tables() loop
    return next extensions.is(tests.count_rows(t, p_other), 0::bigint, format('%s reads no %s rows of the other restaurant', p_who, t));
  end loop;

  foreach s in array array[
    format('insert into public.menu_sections (restaurant_id, name_es, name_en) values (%L, ''x'', ''x'')', p_other),
    format('insert into public.menu_items (restaurant_id, section_id, name_es, name_en, price_cents) values (%L, %L, ''x'', ''x'', 1)', p_other, tests.id(p_other, 'section')),
    format('insert into public.dining_tables (restaurant_id, label) values (%L, ''99'')', p_other),
    format('insert into public.tabs (restaurant_id, table_id) values (%L, %L)', p_other, tests.id(p_other, 'table2')),
    format('insert into public.service_requests (restaurant_id, tab_id, kind) values (%L, %L, ''bring_check'')', p_other, tests.id(p_other, 'tab')),
    format('insert into public.orders (restaurant_id, tab_id, number, source, idempotency_key) values (%L, %L, 1, ''staff'', ''intruder-0001'')', p_other, tests.id(p_other, 'tab')),
    format('insert into public.payments (restaurant_id, tab_id, method, amount_cents, idempotency_key) values (%L, %L, ''cash'', 1, ''intruder-0001'')', p_other, tests.id(p_other, 'tab')),
    format('insert into public.payment_accounts (restaurant_id, provider) values (%L, ''ath'')', p_other),
    format('insert into public.devices (restaurant_id, name, kind) values (%L, ''x'', ''server'')', p_other),
    format('insert into public.print_jobs (restaurant_id, order_id, kind) values (%L, %L, ''kitchen'')', p_other, tests.id(p_other, 'order')),
    format('insert into public.memberships (restaurant_id, user_id, role) values (%L, auth.uid(), ''owner'')', p_other),
    format('insert into public.audit_log (restaurant_id, action, target_table) values (%L, ''void'', ''orders'')', p_other)
  ] loop
    return next extensions.throws_ok(s, '42501', null, format('%s cannot insert: %s', p_who, left(s, 60)));
  end loop;

  foreach s in array array[
    format('update public.menu_items set price_cents = 1 where restaurant_id = %L', p_other),
    format('update public.restaurants set name = ''x'' where id = %L', p_other),
    format('update public.dining_tables set label = ''x'' where restaurant_id = %L', p_other),
    format('update public.tabs set party_size = 9 where restaurant_id = %L', p_other),
    format('update public.orders set status = ''void'' where restaurant_id = %L', p_other),
    format('update public.payments set tip_cents = 1 where restaurant_id = %L', p_other),
    format('update public.memberships set active = false where restaurant_id = %L', p_other),
    format('update public.service_requests set status = ''handled'' where restaurant_id = %L', p_other),
    format('delete from public.menu_sections where restaurant_id = %L', p_other),
    format('delete from public.payments where restaurant_id = %L', p_other)
  ] loop
    return next extensions.is(tests.affected(s), 0::bigint, format('%s changes nothing: %s', p_who, left(s, 60)));
  end loop;

  return next extensions.throws_ok(format('select public.set_item_availability(%L, false)', tests.id(p_other, 'item')), '42501', null, p_who || ' cannot mark the other restaurant''s dish sold out');
  return next extensions.throws_ok(format('select public.set_order_status(%L, ''ready'')', tests.id(p_other, 'order')), '42501', null, p_who || ' cannot advance the other restaurant''s order');
  return next extensions.throws_ok(format('select public.void_order(%L, ''x'')', tests.id(p_other, 'order')), '42501', null, p_who || ' cannot void the other restaurant''s order');
  return next extensions.throws_ok(format('select public.record_refund(%L, 1, ''x'')', tests.id(p_other, 'payment')), '42501', null, p_who || ' cannot refund the other restaurant''s payment');
end $$;

grant execute on all functions in schema tests to authenticated;

-- Fixture -------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000001', 'owner@cafe-lucia.test'),
  ('00000000-0000-4000-8000-000000000002', 'manager@cafe-lucia.test'),
  ('00000000-0000-4000-8000-000000000003', 'server@cafe-lucia.test'),
  ('00000000-0000-4000-8000-000000000004', 'kitchen@cafe-lucia.test'),
  ('00000000-0000-4000-8000-000000000005', 'owner@barra-test.test');

select tests.build_restaurant('00000000-0000-4000-8000-00000000cafe', 'test-cafe-lucia', 'Café Lucía');
select tests.build_restaurant('00000000-0000-4000-8000-00000000ba22', 'test-barra', 'Barra Test');

insert into public.memberships (restaurant_id, user_id, role) values
  ('00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-000000000001', 'owner'),
  ('00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-000000000002', 'manager'),
  ('00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-000000000003', 'server'),
  ('00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-000000000004', 'kitchen'),
  ('00000000-0000-4000-8000-00000000ba22', '00000000-0000-4000-8000-000000000005', 'owner');

-- Café Lucía owner -------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';

select extensions.ok(tests.count_rows(t, '00000000-0000-4000-8000-00000000cafe') > 0, 'owner reads own ' || t)
from tests.tenant_tables() t;
select * from tests.assert_isolated('Café owner', '00000000-0000-4000-8000-00000000ba22');

-- Café Lucía manager -----------------------------------------------------------
set local request.jwt.claims to '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}';
select * from tests.assert_isolated('Café manager', '00000000-0000-4000-8000-00000000ba22');

select extensions.throws_ok(
  'insert into public.payment_accounts (restaurant_id, provider) values (''00000000-0000-4000-8000-00000000cafe'', ''ath'')',
  '42501', null, 'manager cannot add a payment account');
select extensions.is(
  tests.affected('update public.payment_accounts set status = ''connected'' where restaurant_id = ''00000000-0000-4000-8000-00000000cafe'''),
  0::bigint, 'manager cannot edit payment accounts');
select extensions.is(
  tests.affected('update public.subscriptions set plan = ''B'' where restaurant_id = ''00000000-0000-4000-8000-00000000cafe'''),
  0::bigint, 'manager cannot change the plan');
select extensions.is(
  tests.affected(format('update public.menu_items set price_cents = 275 where id = %L', tests.id('00000000-0000-4000-8000-00000000cafe', 'item'))),
  1::bigint, 'manager can change a price');
select extensions.lives_ok(
  format('select public.record_refund(%L, 50, ''Café frío'')', tests.id('00000000-0000-4000-8000-00000000cafe', 'payment')),
  'manager can refund');
select extensions.throws_ok(
  format('select public.record_refund(%L, 100000, ''Too much'')', tests.id('00000000-0000-4000-8000-00000000cafe', 'payment')),
  '22023', null, 'a refund cannot exceed what was paid');
select extensions.lives_ok(
  format('select public.void_order(%L, ''Cliente cambió de idea'', %L)',
    tests.id('00000000-0000-4000-8000-00000000cafe', 'order2'), tests.id('00000000-0000-4000-8000-00000000cafe', 'line2')),
  'manager can void a line');
select extensions.is(
  (select status::text from public.orders where id = tests.id('00000000-0000-4000-8000-00000000cafe', 'order2')),
  'void', 'voiding the last line voids the order');
select extensions.is(
  (select count(*) from public.audit_log where restaurant_id = '00000000-0000-4000-8000-00000000cafe' and action in ('void', 'refund')),
  2::bigint, 'the void and the refund are audited');
select extensions.is(
  (select count(*) from public.audit_log where restaurant_id = '00000000-0000-4000-8000-00000000cafe' and action = 'price_change'
     and actor_id = '00000000-0000-4000-8000-000000000002'),
  1::bigint, 'the price change is audited with its author');
select extensions.throws_ok(
  format('select public.void_order(%L, ''  '')', tests.id('00000000-0000-4000-8000-00000000cafe', 'order')),
  '22023', null, 'a void needs a reason');
select extensions.throws_ok(
  'insert into public.memberships (restaurant_id, user_id, role) values (''00000000-0000-4000-8000-00000000cafe'', ''00000000-0000-4000-8000-000000000005'', ''owner'')',
  '42501', null, 'manager cannot add an owner');

-- Café Lucía server ------------------------------------------------------------
set local request.jwt.claims to '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}';
select * from tests.assert_isolated('Café server', '00000000-0000-4000-8000-00000000ba22');

select extensions.is(
  tests.affected('update public.menu_items set price_cents = 1 where restaurant_id = ''00000000-0000-4000-8000-00000000cafe'''),
  0::bigint, 'server cannot change prices');
select extensions.ok(
  (select count(*) from public.menu_items where restaurant_id = '00000000-0000-4000-8000-00000000cafe') = 2,
  'server reads the menu');
select extensions.is(
  tests.affected(format('update public.payments set status = ''paid'', paid_at = now() where id = %L', tests.id('00000000-0000-4000-8000-00000000cafe', 'payment'))),
  1::bigint, 'server can confirm a cash payment');
select extensions.throws_ok(
  format('select public.void_order(%L, ''x'')', tests.id('00000000-0000-4000-8000-00000000cafe', 'order')),
  '42501', null, 'server cannot void');
select extensions.is(
  tests.count_rows('refunds', '00000000-0000-4000-8000-00000000cafe'), 0::bigint, 'server cannot read refunds');

-- Café Lucía kitchen -----------------------------------------------------------
set local request.jwt.claims to '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}';
select * from tests.assert_isolated('Café kitchen', '00000000-0000-4000-8000-00000000ba22');

select extensions.is(tests.count_rows('payments', '00000000-0000-4000-8000-00000000cafe'), 0::bigint, 'kitchen cannot read payments');
select extensions.is(tests.count_rows('refunds', '00000000-0000-4000-8000-00000000cafe'), 0::bigint, 'kitchen cannot read refunds');
select extensions.ok(tests.count_rows('orders', '00000000-0000-4000-8000-00000000cafe') = 2, 'kitchen reads orders');
select extensions.is(
  tests.affected('update public.menu_items set price_cents = 1 where restaurant_id = ''00000000-0000-4000-8000-00000000cafe'''),
  0::bigint, 'kitchen cannot change prices');
select extensions.lives_ok(
  format('select public.set_item_availability(%L, false)', tests.id('00000000-0000-4000-8000-00000000cafe', 'item')),
  'kitchen can mark a dish sold out');
select extensions.lives_ok(
  format('select public.set_order_status(%L, ''in_kitchen'')', tests.id('00000000-0000-4000-8000-00000000cafe', 'order')),
  'kitchen can advance an order');

reset role;
select extensions.is(
  (select count(*) from public.item_availability_events
   where item_id = tests.id('00000000-0000-4000-8000-00000000cafe', 'item') and back_at is null),
  1::bigint, 'sold out opens an availability event');

-- Barra Test owner, the other way round -------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-4000-8000-000000000005","role":"authenticated"}';
select * from tests.assert_isolated('Barra owner', '00000000-0000-4000-8000-00000000cafe');

-- Anonymous ---------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select extensions.throws_ok('select count(*) from public.menu_items', '42501', null, 'anon cannot read tenant tables');
select extensions.throws_ok(
  'select public.place_order(''00000000-0000-4000-8000-00000000cafe'', null, ''anon-0001'', ''qr'', ''[]'', ''es'')',
  '42501', null, 'anon cannot call place_order');
reset role;

select * from finish();
rollback;
