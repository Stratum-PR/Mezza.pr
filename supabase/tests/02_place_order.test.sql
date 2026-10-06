-- place_order: re-reads prices and availability, enforces modifiers, numbers orders, and is
-- idempotent on the client order id. Runs as the service role, as server code does.
begin;
select no_plan();

insert into public.restaurants (id, slug, name) values ('00000000-0000-4000-8000-00000000cafe', 'test-po', 'Café Lucía');
insert into public.menu_sections (id, restaurant_id, name_es, name_en)
  values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000cafe', 'Café', 'Coffee');
insert into public.menu_items (id, restaurant_id, section_id, name_es, name_en, price_cents, is_available, sold_out_since) values
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000a1', 'Café con leche', 'Café con leche', 250, true, null),
  ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000a1', 'Flan de queso', 'Cheese flan', 400, false, now()),
  ('00000000-0000-4000-8000-0000000000b3', '00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000a1', 'Malta', 'Malta', 200, true, null);
insert into public.modifier_groups (id, restaurant_id, name_es, name_en, min_select, max_select)
  values ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-00000000cafe', 'Leche', 'Milk', 1, 1);
insert into public.modifier_options (id, restaurant_id, group_id, name_es, name_en, price_cents) values
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000c1', 'Entera', 'Whole', 0),
  ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000c1', 'Avena', 'Oat', 75);
insert into public.item_modifier_groups (restaurant_id, item_id, group_id)
  values ('00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000c1');
insert into public.dining_tables (id, restaurant_id, label) values
  ('00000000-0000-4000-8000-0000000000e4', '00000000-0000-4000-8000-00000000cafe', '4'),
  ('00000000-0000-4000-8000-0000000000e5', '00000000-0000-4000-8000-00000000cafe', '5');

set local role service_role;

create temporary table r (label text primary key, result jsonb);
grant all on r to service_role;

-- Client sends a fake price; the order must use the menu's.
insert into r values ('first', public.place_order(
  '00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000e4', 'client-order-0001', 'qr',
  '[{"itemId":"00000000-0000-4000-8000-0000000000b1","qty":2,"modifierOptionIds":["00000000-0000-4000-8000-0000000000d2"],"priceCents":1,"unitPriceCents":1},
    {"itemId":"00000000-0000-4000-8000-0000000000b3","qty":1,"modifierOptionIds":[],"note":"Bien fría"}]',
  'en'));

select is((select result ->> 'status' from r where label = 'first'), 'accepted', 'a valid order is accepted');
select is((select (result ->> 'number')::integer from r where label = 'first'), 1001, 'order numbers start at 1001');
select is(
  (select unit_price_cents from public.order_items where item_id = '00000000-0000-4000-8000-0000000000b1'),
  325, 'unit price is the menu price plus modifiers, not the client price');
select is(
  (select modifiers_snapshot -> 0 ->> 'name_es' from public.order_items where item_id = '00000000-0000-4000-8000-0000000000b1'),
  'Avena', 'modifiers are snapshotted');
select is(
  (select name_snapshot_en from public.order_items where item_id = '00000000-0000-4000-8000-0000000000b3'),
  'Malta', 'names are snapshotted');
select is(
  (select guest_language::text from public.orders where idempotency_key = 'client-order-0001'), 'en', 'guest language is kept');
select is(
  (select count(*) from public.tabs where table_id = '00000000-0000-4000-8000-0000000000e4' and status = 'open'),
  1::bigint, 'the first order opens a tab');

-- Same key again: same order, nothing new.
insert into r values ('repeat', public.place_order(
  '00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000e4', 'client-order-0001', 'qr',
  '[{"itemId":"00000000-0000-4000-8000-0000000000b3","qty":5,"modifierOptionIds":[]}]', 'es'));
select is(
  (select result ->> 'order_id' from r where label = 'repeat'),
  (select result ->> 'order_id' from r where label = 'first'),
  'a repeated key returns the same order');
select is((select (result ->> 'replayed')::boolean from r where label = 'repeat'), true, 'and says it was replayed');
select is((select count(*) from public.orders where idempotency_key = 'client-order-0001'), 1::bigint, 'only one order exists for the key');
select is((select count(*) from public.order_items where restaurant_id = '00000000-0000-4000-8000-00000000cafe'), 2::bigint, 'and no extra lines were added');

-- Second order on the same table joins the open tab and gets the next number.
insert into r values ('second', public.place_order(
  '00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000e4', 'client-order-0002', 'staff',
  '[{"itemId":"00000000-0000-4000-8000-0000000000b3","qty":1,"modifierOptionIds":[]}]'));
select is((select (result ->> 'number')::integer from r where label = 'second'), 1002, 'the next order is 1002');
select is(
  (select count(distinct tab_id) from public.orders where restaurant_id = '00000000-0000-4000-8000-00000000cafe'),
  1::bigint, 'both orders share the table''s tab');

-- Rejections.
select is(
  public.place_order('00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000e4', 'client-order-0003', 'qr',
    '[{"itemId":"00000000-0000-4000-8000-0000000000b2","qty":1,"modifierOptionIds":[]}]') ->> 'reason',
  'item_unavailable', 'sold-out dishes are rejected');
select is(
  public.place_order('00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000e4', 'client-order-0004', 'qr',
    '[{"itemId":"00000000-0000-4000-8000-0000000000b1","qty":1,"modifierOptionIds":[]}]') ->> 'reason',
  'validation', 'a required modifier group must have a choice');
select is(
  public.place_order('00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000e4', 'client-order-0005', 'qr',
    '[{"itemId":"00000000-0000-4000-8000-0000000000b1","qty":1,"modifierOptionIds":["00000000-0000-4000-8000-0000000000d1","00000000-0000-4000-8000-0000000000d2"]}]') ->> 'reason',
  'validation', 'a group cannot exceed its max');
select is(
  public.place_order('00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000e4', 'client-order-0006', 'qr',
    '[{"itemId":"00000000-0000-4000-8000-0000000000b3","qty":1,"modifierOptionIds":["00000000-0000-4000-8000-0000000000d1"]}]') ->> 'reason',
  'validation', 'options must belong to the dish');
select is(
  public.place_order('00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000e4', 'client-order-0007', 'qr',
    '[{"itemId":"00000000-0000-4000-8000-0000000000b3","qty":0,"modifierOptionIds":[]}]') ->> 'reason',
  'validation', 'quantity must be at least 1');
select is(
  public.place_order('00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000e4', 'client-order-0008', 'qr', '[]') ->> 'reason',
  'validation', 'an order needs at least one line');
select is(
  public.place_order('00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000aa', 'client-order-0009', 'qr',
    '[{"itemId":"00000000-0000-4000-8000-0000000000b3","qty":1,"modifierOptionIds":[]}]') ->> 'reason',
  'invalid_table', 'unknown tables are rejected');
select is(
  (select count(*) from public.orders where restaurant_id = '00000000-0000-4000-8000-00000000cafe'),
  2::bigint, 'rejected orders write nothing');

reset role;
update public.tabs set status = 'paying' where table_id = '00000000-0000-4000-8000-0000000000e4';
set local role service_role;
select is(
  public.place_order('00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000e4', 'client-order-0010', 'qr',
    '[{"itemId":"00000000-0000-4000-8000-0000000000b3","qty":1,"modifierOptionIds":[]}]') ->> 'reason',
  'tab_closed', 'a table that is paying takes no new orders');

-- Summaries.
reset role;
select public.refresh_sales_summaries('00000000-0000-4000-8000-00000000cafe', current_date - 1, current_date + 1);
select is(
  (select sum(orders)::integer from public.daily_sales where restaurant_id = '00000000-0000-4000-8000-00000000cafe'),
  2, 'refresh_sales_summaries counts orders');
select is(
  (select sum(units)::integer from public.item_sales_daily where item_id = '00000000-0000-4000-8000-0000000000b3'),
  2, 'and units per dish');

select * from finish();
rollback;
