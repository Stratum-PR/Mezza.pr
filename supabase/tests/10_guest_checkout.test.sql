-- Pass 2 phase 4: the checkout summary matches what create_tab_payment charges; a phone that pays
-- without ordering becomes a person; a pending payment is cancelled by its own phone or by staff.
begin;
select no_plan();

insert into public.restaurants (id, slug, name, max_people_per_table)
  values ('00000000-0000-4000-8000-00000000cafe', 'test-gc', 'Café Lucía', 3);
insert into public.menu_sections (id, restaurant_id, name_es, name_en)
  values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000cafe', 'Café', 'Coffee');
insert into public.menu_items (id, restaurant_id, section_id, name_es, name_en, price_cents) values
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000a1', 'Malta', 'Malta', 200),
  ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000a1', 'Tostones', 'Tostones', 1001),
  ('00000000-0000-4000-8000-0000000000b6', '00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000a1', 'Cena', 'Dinner', 10000);
insert into public.dining_tables (id, restaurant_id, label) values
  ('00000000-0000-4000-8000-0000000000e4', '00000000-0000-4000-8000-00000000cafe', '4');

create function pg_temp.device(n integer) returns text language sql as $$ select lpad(n::text, 64, 'c') $$;
create function pg_temp.order(person integer, item uuid, shared boolean default false) returns jsonb language sql as $$
  select public.place_guest_order('00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000e4', gen_random_uuid()::text,
    jsonb_build_array(jsonb_build_object('itemId', item, 'qty', 1, 'modifierOptionIds', '[]'::jsonb, 'shared', shared)), 'es', pg_temp.device(person), null) $$;
create function pg_temp.tab() returns uuid language sql as $$
  select id from public.tabs where table_id = '00000000-0000-4000-8000-0000000000e4' and status <> 'closed' $$;
create function pg_temp.who(n integer) returns uuid language sql as $$
  select id from public.tab_participants where tab_id = pg_temp.tab() and device_hash = pg_temp.device(n) $$;
create function pg_temp.summary() returns jsonb language sql as $$ select public.tab_checkout(pg_temp.tab()) $$;
create function pg_temp.owed(n integer) returns integer language sql as $$
  select (p ->> 'owed_cents')::integer from jsonb_array_elements(pg_temp.summary() -> 'people') p where (p ->> 'id')::uuid = pg_temp.who(n) $$;

set local role service_role;

-- Ana $2.00; Ben shares $10.01 tostones (Ana 501, Ben 500); staff adds $100 for the table.
select pg_temp.order(1, '00000000-0000-4000-8000-0000000000b1');
select pg_temp.order(2, '00000000-0000-4000-8000-0000000000b2', true);
select public.place_order('00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000e4', 'staff-cena-0001', 'staff',
  '[{"itemId":"00000000-0000-4000-8000-0000000000b6","qty":1,"modifierOptionIds":[]}]');

select is(pg_temp.owed(1), 701, 'Ana owes her malta and her share');
select is(pg_temp.owed(2), 500, 'Ben owes his share');
select is((pg_temp.summary() ->> 'table_cents')::integer, 10000, 'the table''s line is separate');
select is((pg_temp.summary() ->> 'balance_cents')::integer, 11201, 'the balance is everything');
select is(
  (public.create_tab_payment(pg_temp.tab(), 'mine', 'cash', 'gc-ana-0001', pg_temp.who(1)) ->> 'subtotal_cents')::integer,
  701, 'what Ana is charged matches what she was shown');
select is(pg_temp.owed(1), 0, 'a pending payment holds her charges');
select is((pg_temp.summary() ->> 'paid_before_cents')::integer, 701, 'and counts as paid for the IVU preview');

-- Cancelling: only Ana's phone or staff; what it held is owed again.
select is(public.cancel_pending_payment((select id from public.payments where idempotency_key = 'gc-ana-0001'), pg_temp.device(2)), false, 'another phone cannot cancel it');
select is(public.cancel_pending_payment((select id from public.payments where idempotency_key = 'gc-ana-0001'), pg_temp.device(1)), true, 'the payer''s phone can');
select is(pg_temp.owed(1), 701, 'her charges are owed again');
select is(public.cancel_pending_payment((select id from public.payments where idempotency_key = 'gc-ana-0001')), false, 'a payment already cancelled stays as it is');
select public.create_tab_payment(pg_temp.tab(), 'mine', 'cash', 'gc-ana-0002', pg_temp.who(1));
select is(public.cancel_pending_payment((select id from public.payments where idempotency_key = 'gc-ana-0002')), true, 'staff (no device) can cancel');

-- A phone that never ordered becomes person #3 when it pays; a fourth is refused (cap 3).
select public.ensure_participant(pg_temp.tab(), pg_temp.device(3));
select is((select guest_number from public.tab_participants where id = pg_temp.who(3)), 3, 'a paying phone joins as the next person');
select is(public.ensure_participant(pg_temp.tab(), pg_temp.device(3)), pg_temp.who(3), 'and stays the same person');
select is(public.ensure_participant(pg_temp.tab(), pg_temp.device(4)), null, 'a full table refuses a new phone');

-- The plan in the summary matches the share charged.
select public.start_split_plan(pg_temp.tab(), 3, pg_temp.who(3));
select is((pg_temp.summary() -> 'plan' ->> 'next_share_cents')::integer, 3734, '$112.01 in three: the next share');
select is(pg_temp.owed(1), 0, 'charges inside the plan are not owed per person');
select is(
  (public.create_tab_payment(pg_temp.tab(), 'plan', 'cash', 'gc-plan-0001', pg_temp.who(3)) ->> 'subtotal_cents')::integer,
  3734, 'the share charged matches the summary');
select is((pg_temp.summary() -> 'plan' ->> 'parts_left')::integer, 2, 'two shares left');

-- Every share pending (or paid): the summary still answers, with no plan left to pay.
select public.create_tab_payment(pg_temp.tab(), 'plan', 'cash', 'gc-plan-0002', pg_temp.who(1), null, 2);
select is(pg_temp.summary() -> 'plan', 'null'::jsonb, 'a fully covered plan shows no shares left');
select is((pg_temp.summary() ->> 'balance_cents')::integer, 0, 'and nothing left at the table');
update public.payments set status = 'paid', paid_at = now() where tab_id = pg_temp.tab();
select is((pg_temp.summary() ->> 'balance_cents')::integer, 0, 'once paid, the summary still answers');

set local role anon;
select throws_ok($$ select public.ensure_participant(gen_random_uuid(), repeat('a', 64)) $$, '42501', null, 'guests cannot call it directly');

select * from finish();
rollback;
