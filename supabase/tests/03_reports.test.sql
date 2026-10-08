-- report_summary: owners and managers only, local-date ranges, and the lost-sales estimate.
begin;
select no_plan();
-- Test helpers (pg_temp functions) are called as signed-in users; new functions get no EXECUTE by
-- default since P2-2, so this transaction (rolled back below) opts back in.
alter default privileges grant execute on functions to public;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000001', 'owner@rep.test'),
  ('00000000-0000-4000-8000-000000000002', 'manager@rep.test'),
  ('00000000-0000-4000-8000-000000000003', 'server@rep.test'),
  ('00000000-0000-4000-8000-000000000005', 'owner@other.test');

insert into public.restaurants (id, slug, name) values
  ('00000000-0000-4000-8000-00000000cafe', 'test-rep', 'Café Lucía'),
  ('00000000-0000-4000-8000-00000000ba22', 'test-rep-other', 'Barra Test');
insert into public.memberships (restaurant_id, user_id, role) values
  ('00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-000000000001', 'owner'),
  ('00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-000000000002', 'manager'),
  ('00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-000000000003', 'server'),
  ('00000000-0000-4000-8000-00000000ba22', '00000000-0000-4000-8000-000000000005', 'owner');

insert into public.menu_sections (id, restaurant_id, name_es, name_en)
  values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000cafe', 'Postres', 'Desserts');
insert into public.menu_items (id, restaurant_id, section_id, name_es, name_en, price_cents) values
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000a1', 'Flan de queso', 'Cheese flan', 400),
  ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000a1', 'Tembleque', 'Tembleque', 350);
insert into public.dining_tables (id, restaurant_id, label)
  values ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-00000000cafe', '4');

-- History, in Puerto Rico time (UTC-4). One tab per order, each paid.
create function pg_temp.sale(p_key int, p_local timestamp, p_qty int, p_method public.payment_method, p_source public.order_source, p_lang public.app_locale)
returns void language plpgsql as $$
declare
  v_at timestamptz := p_local at time zone 'America/Puerto_Rico';
  v_tab uuid := md5('tab' || p_key)::uuid;
  v_order uuid := md5('order' || p_key)::uuid;
begin
  insert into public.tabs (id, restaurant_id, table_id, status, party_size, opened_at, closed_at)
    values (v_tab, '00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000e1', 'closed', 2, v_at, v_at + interval '40 minutes');
  insert into public.orders (id, restaurant_id, tab_id, number, source, idempotency_key, guest_language, status, created_at)
    values (v_order, '00000000-0000-4000-8000-00000000cafe', v_tab, 1000 + p_key, p_source, 'rep-' || p_key, p_lang, 'served', v_at);
  insert into public.order_items (restaurant_id, order_id, item_id, name_snapshot_es, name_snapshot_en, unit_price_cents, qty)
    values ('00000000-0000-4000-8000-00000000cafe', v_order, '00000000-0000-4000-8000-0000000000b1', 'Flan de queso', 'Cheese flan', 400, p_qty);
  insert into public.payments (restaurant_id, tab_id, method, amount_cents, tip_cents, ivu_state_cents, ivu_municipal_cents, status, idempotency_key, paid_at)
    values ('00000000-0000-4000-8000-00000000cafe', v_tab, p_method, 400 * p_qty, 80 * p_qty, 42 * p_qty, 4 * p_qty, 'paid', 'rep-pay-' || p_key, v_at + interval '30 minutes');
end $$;

select pg_temp.sale(1, '2026-09-14 15:10', 4, 'card', 'qr', 'en');   -- before the range: only feeds the estimate
select pg_temp.sale(2, '2026-09-21 14:30', 2, 'ath', 'qr', 'es');
select pg_temp.sale(3, '2026-09-22 21:30', 1, 'cash', 'staff', 'es'); -- 01:30 UTC next day: still the 22nd locally
-- Flan sold out on Monday the 28th from 14:00 to 16:00 local.
insert into public.item_availability_events (restaurant_id, item_id, sold_out_at, back_at) values (
  '00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000b1',
  '2026-09-28 14:00'::timestamp at time zone 'America/Puerto_Rico', '2026-09-28 16:00'::timestamp at time zone 'America/Puerto_Rico');
-- Extras: a required free choice doesn't count; a paid upgrade or an optional pick does.
insert into public.menu_items (id, restaurant_id, section_id, name_es, name_en, price_cents)
  values ('00000000-0000-4000-8000-0000000000b3', '00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000a1', 'Café con leche', 'Café con leche', 250);
insert into public.modifier_groups (id, restaurant_id, name_es, name_en, min_select, max_select) values
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-00000000cafe', 'Leche', 'Milk', 1, 1),
  ('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-00000000cafe', 'Canela', 'Cinnamon', 0, 1);
insert into public.modifier_options (id, restaurant_id, group_id, name_es, name_en, price_cents) values
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000c1', 'Entera', 'Whole', 0),
  ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000c1', 'Avena', 'Oat', 75),
  ('00000000-0000-4000-8000-0000000000d3', '00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000c2', 'Canela', 'Cinnamon', 0);
insert into public.item_modifier_groups (restaurant_id, item_id, group_id) values
  ('00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000b3', '00000000-0000-4000-8000-0000000000c1'),
  ('00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000b3', '00000000-0000-4000-8000-0000000000c2');
insert into public.order_items (restaurant_id, order_id, item_id, name_snapshot_es, name_snapshot_en, unit_price_cents, qty, modifiers_snapshot)
select '00000000-0000-4000-8000-00000000cafe', md5('order2')::uuid, '00000000-0000-4000-8000-0000000000b3', 'Café con leche', 'Café con leche', 250, x.qty, x.snap::jsonb
from (values
  (1, '[{"option_id":"00000000-0000-4000-8000-0000000000d1","price_cents":0}]'),
  (2, '[{"option_id":"00000000-0000-4000-8000-0000000000d2","price_cents":75}]'),
  (3, '[{"option_id":"00000000-0000-4000-8000-0000000000d1","price_cents":0},{"option_id":"00000000-0000-4000-8000-0000000000d3","price_cents":0}]')
) as x(qty, snap);
select public.refresh_sales_summaries('00000000-0000-4000-8000-00000000cafe', '2026-09-01', '2026-09-30');

create temp table r as select null::jsonb as v;
grant all on r to authenticated;

-- Owner ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';
update r set v = public.report_summary('00000000-0000-4000-8000-00000000cafe', '2026-09-20', '2026-09-30');

select is((select (v->'totals'->>'sales')::int from r), 1200, 'totals count sales in the range by local date');
select is((select (v->'totals'->>'orders')::int from r), 2, 'orders in the range');
select is((select (v->'totals'->>'ath')::int from r), 800, 'ATH share of sales');
select is((select (v->'totals'->>'cash')::int from r), 400, 'a 21:30 local sale counts on its local day');
select is((select jsonb_array_length(v->'daily') from r), 3, 'daily rows start a week before the range (the 14th is included)');
select is(
  (select (x->>'sales')::int from r, jsonb_array_elements(v->'heat') x where (x->>'dow')::int = 1 and (x->>'hour')::int = 15),
  800, 'heat map buckets Monday 15:00 local (paid at 15:00)');
select is((select v->'tables'->0->>'tabs' from r), '2', 'tabs per table');
select is((select v->'tables'->0->>'covers' from r), '4', 'covers per table');
select is(
  (select (x->>'count')::int from r, jsonb_array_elements(v->'sources') x where x->>'source' = 'qr'),
  1, 'QR orders in the range');
select is((select v->'soldOut'->0->>'hours' from r), '2.00', 'hours sold out');
-- 14:00 slot: 2 units four weeks running → (2+0+0+0)/4 = 0.5; 15:00 slot: (0+4+0+0)/4 = 1. Total 1.5 units at $4.00.
select is((select v->'soldOut'->0->>'lostUnits' from r), '1.50', 'estimated lost units use the same weekday-hour over 4 weeks');
select is((select (v->'soldOut'->0->>'lostRevenue')::int from r), 600, 'estimated lost sales at the dish price');
select is(
  (select x->>'withModifiers' from r, jsonb_array_elements(v->'items') x where x->>'nameEs' = 'Café con leche'),
  '5', 'extras count paid upgrades and optional picks, not required free choices');
select is(
  (select (x->>'units')::int from r, jsonb_array_elements(v->'items') x where x->>'nameEs' = 'Tembleque'),
  0, 'unsold dishes still appear, for worst sellers');

-- Manager -------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok($$ select public.report_summary('00000000-0000-4000-8000-00000000cafe', '2026-09-01', '2026-09-30') $$, 'managers can read reports');

-- Server, other owner, bad ranges ---------------------------------------------------
set local request.jwt.claims to '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}';
select throws_ok($$ select public.report_summary('00000000-0000-4000-8000-00000000cafe', '2026-09-01', '2026-09-30') $$, '42501', null, 'servers cannot read reports');
set local request.jwt.claims to '{"sub":"00000000-0000-4000-8000-000000000005","role":"authenticated"}';
select throws_ok($$ select public.report_summary('00000000-0000-4000-8000-00000000cafe', '2026-09-01', '2026-09-30') $$, '42501', null, 'another restaurant''s owner cannot read reports');
select throws_ok($$ select public.report_summary('00000000-0000-4000-8000-00000000ba22', '2026-09-30', '2026-09-01') $$, '22023', null, 'a reversed range is rejected');
select throws_ok($$ select public.report_summary('00000000-0000-4000-8000-00000000ba22', '2025-01-01', '2026-09-30') $$, '22023', null, 'ranges over 400 days are rejected');

select * from finish();
rollback;
