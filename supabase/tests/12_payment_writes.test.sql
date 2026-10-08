-- P0-1 (issue #4): nobody signed in writes money rows directly. Payments, what they cover, refunds and
-- write-offs change only through server code (service role) and SECURITY DEFINER functions; staff
-- confirm cash with confirm_cash_payment, which checks the role and the payment and audits it.
begin;
select no_plan();

insert into public.restaurants (id, slug, name) values
  ('00000000-0000-4000-8000-00000000cafe', 'test-pw', 'Café Lucía'),
  ('00000000-0000-4000-8000-00000000ba22', 'test-pw-barra', 'Barra Test');
insert into public.menu_sections (id, restaurant_id, name_es, name_en)
  values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000cafe', 'Café', 'Coffee');
insert into public.menu_items (id, restaurant_id, section_id, name_es, name_en, price_cents)
  values ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000a1', 'Mofongo', 'Mofongo', 1400);
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

create function pg_temp.as_user(id text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, true) $$;
-- Rows a statement changed; a statement the role may not run at all changed none.
create function pg_temp.changed(p_sql text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute format('with x as (%s returning 1) select count(*) from x', p_sql) into n;
  return n;
exception when insufficient_privilege then
  return 0;
end $$;
create temporary table ids (k text primary key, v uuid);
grant all on ids to anon, authenticated, service_role;

-- Two tables order a mofongo; table 1 asks to pay cash, table 2 by card (both pending).
set local role service_role;
select public.place_guest_order('00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000e1', 'pw-order-1',
  '[{"itemId":"00000000-0000-4000-8000-0000000000b1","qty":1,"modifierOptionIds":[]}]', 'es', repeat('a', 64), null);
select public.place_guest_order('00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000e2', 'pw-order-2',
  '[{"itemId":"00000000-0000-4000-8000-0000000000b1","qty":1,"modifierOptionIds":[]}]', 'es', repeat('b', 64), null);
insert into ids select 'tab1', id from public.tabs where table_id = '00000000-0000-4000-8000-0000000000e1';
insert into ids select 'tab2', id from public.tabs where table_id = '00000000-0000-4000-8000-0000000000e2';
insert into ids values
  ('cash', (public.create_tab_payment((select v from ids where k = 'tab1'), 'balance', 'cash', 'pw-cash-0001') ->> 'payment_id')::uuid),
  ('card', (public.create_tab_payment((select v from ids where k = 'tab2'), 'balance', 'card', 'pw-card-0001') ->> 'payment_id')::uuid);
reset role;
insert into public.refunds (restaurant_id, payment_id, amount_cents, reason)
  values ('00000000-0000-4000-8000-00000000cafe', (select v from ids where k = 'cash'), 1, 'Fixture');
insert into public.write_offs (restaurant_id, tab_id, scope, cents, reason)
  values ('00000000-0000-4000-8000-00000000cafe', (select v from ids where k = 'tab2'), 'table', 1, 'Fixture');

-- No signed-in role writes money rows, the owner included. ----------------------------------------
create function pg_temp.no_money_writes(p_who text) returns setof text language plpgsql as $$
declare
  s text;
  r uuid := '00000000-0000-4000-8000-00000000cafe';
  tab uuid := (select v from ids where k = 'tab1');
  pay uuid := (select v from ids where k = 'cash');
begin
  foreach s in array array[
    format('update public.payments set amount_cents = 1 where id = %L', pay),
    format('update public.payments set status = ''paid'', paid_at = now() where id = %L', pay),
    format('update public.payments set tip_cents = 50000 where restaurant_id = %L', r),
    format('delete from public.payments where restaurant_id = %L', r),
    format('update public.payment_allocations set cents = 1 where restaurant_id = %L', r),
    format('delete from public.payment_allocations where restaurant_id = %L', r),
    format('update public.refunds set amount_cents = 2 where restaurant_id = %L', r),
    format('delete from public.refunds where restaurant_id = %L', r),
    format('update public.write_offs set cents = 2 where restaurant_id = %L', r),
    format('delete from public.write_offs where restaurant_id = %L', r)
  ] loop
    return next is(pg_temp.changed(s), 0::bigint, format('%s changes nothing: %s', p_who, left(s, 70)));
  end loop;
  foreach s in array array[
    format('insert into public.payments (restaurant_id, tab_id, method, amount_cents, status, paid_at, idempotency_key) values (%L, %L, ''card'', 999999, ''paid'', now(), %L)', r, tab, 'forged-' || p_who),
    format('insert into public.refunds (restaurant_id, payment_id, amount_cents, reason) values (%L, %L, 1, ''x'')', r, pay),
    format('insert into public.write_offs (restaurant_id, tab_id, scope, cents, reason) values (%L, %L, ''table'', 1, ''x'')', r, tab)
  ] loop
    return next throws_ok(s, '42501', null, format('%s cannot insert: %s', p_who, left(s, 60)));
  end loop;
end $$;

set local role authenticated;
select pg_temp.as_user('00000000-0000-4000-8000-000000000001');
select * from pg_temp.no_money_writes('owner');
select ok((select count(*) from public.payments) = 2, 'the owner still reads payments');
select ok((select count(*) from public.refunds) = 1, 'the owner still reads refunds');
select pg_temp.as_user('00000000-0000-4000-8000-000000000002');
select * from pg_temp.no_money_writes('manager');
select ok((select count(*) from public.payments) = 2, 'the manager still reads payments');
select pg_temp.as_user('00000000-0000-4000-8000-000000000003');
select * from pg_temp.no_money_writes('server');
select ok((select count(*) from public.payments) = 2, 'the server still reads payments');

reset role;
select is((select status::text from public.payments where id = (select v from ids where k = 'cash')), 'pending', 'the cash payment is still pending');
select is((select count(*) from public.payments where restaurant_id = '00000000-0000-4000-8000-00000000cafe'), 2::bigint, 'no payment was added or removed');

-- Confirming cash goes through confirm_cash_payment. ------------------------------------------------
set local role authenticated;
select pg_temp.as_user('00000000-0000-4000-8000-000000000004');
select throws_ok(format('select public.confirm_cash_payment(%L)', (select v from ids where k = 'cash')), '42501', null, 'the kitchen cannot confirm cash');
select pg_temp.as_user('00000000-0000-4000-8000-000000000005');
select throws_ok(format('select public.confirm_cash_payment(%L)', (select v from ids where k = 'cash')), '42501', null, 'another restaurant''s owner cannot confirm it');
select throws_ok('select public.confirm_cash_payment(gen_random_uuid())', '42501', null, 'an unknown payment is not allowed');
select pg_temp.as_user('00000000-0000-4000-8000-000000000003');
select throws_ok(format('select public.confirm_cash_payment(%L)', (select v from ids where k = 'card')), '22023', null, 'only cash payments are confirmed by staff');
select is(public.confirm_cash_payment((select v from ids where k = 'cash')), (select v from ids where k = 'tab1'), 'the server confirms the cash and gets the tab back');
select is(public.confirm_cash_payment((select v from ids where k = 'cash')), null, 'confirming again changes nothing');

reset role;
select is((select status::text from public.payments where id = (select v from ids where k = 'cash')), 'paid', 'the cash payment is paid');
select ok((select paid_at is not null from public.payments where id = (select v from ids where k = 'cash')), 'with a paid time');
select is((select confirmed_by from public.payments where id = (select v from ids where k = 'cash')),
  '00000000-0000-4000-8000-000000000003'::uuid, 'and who confirmed it');
select is((select count(*) from public.audit_log where action = 'confirm_cash' and target_id = (select v from ids where k = 'cash')
  and actor_id = '00000000-0000-4000-8000-000000000003'), 1::bigint, 'confirming is audited once');
select ok(public.tab_settled((select v from ids where k = 'tab1')), 'the table is settled');

-- Anonymous callers cannot confirm anything.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok(format('select public.confirm_cash_payment(%L)', (select v from ids where k = 'card')), '42501', null, 'anon cannot call confirm_cash_payment');
reset role;

select * from finish();
rollback;
