-- Pass 2 phase 3: the split engine. create_tab_payment computes every amount from what is owed and
-- covered; even-split plans; IVU by cumulative difference; pending payments hold, expire and release.
-- Ends with a randomized property test over many tables.
begin;
select no_plan();

insert into public.restaurants (id, slug, name, max_people_per_table)
  values ('00000000-0000-4000-8000-00000000cafe', 'test-se', 'Café Lucía', 40);
insert into public.menu_sections (id, restaurant_id, name_es, name_en)
  values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000cafe', 'Café', 'Coffee');
insert into public.menu_items (id, restaurant_id, section_id, name_es, name_en, price_cents) values
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000a1', 'Malta', 'Malta', 200),
  ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000a1', 'Tostones', 'Tostones', 1001),
  ('00000000-0000-4000-8000-0000000000b3', '00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000a1', 'Mofongo', 'Mofongo', 1399),
  ('00000000-0000-4000-8000-0000000000b4', '00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000a1', 'Refresco', 'Soda', 100),
  ('00000000-0000-4000-8000-0000000000b5', '00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000a1', 'Chicle', 'Gum', 50),
  ('00000000-0000-4000-8000-0000000000b6', '00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000a1', 'Cena', 'Dinner', 10000);
insert into public.dining_tables (restaurant_id, label)
  select '00000000-0000-4000-8000-00000000cafe', 't' || n from generate_series(1, 200) as n;
insert into auth.users (id, email) values ('00000000-0000-4000-8000-000000000003', 'server@cafe-lucia.test');
insert into public.memberships (restaurant_id, user_id, role)
  values ('00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-000000000003', 'server');

create function pg_temp.tbl(label text) returns uuid language sql as $$
  select id from public.dining_tables where restaurant_id = '00000000-0000-4000-8000-00000000cafe' and label = $1 $$;
create function pg_temp.item(name text) returns uuid language sql as $$
  select id from public.menu_items where restaurant_id = '00000000-0000-4000-8000-00000000cafe' and name_es = $1 $$;
create function pg_temp.device(tbl text, n integer) returns text language sql as $$ select encode(sha256(convert_to(tbl || ':' || n, 'utf8')), 'hex') $$;
create function pg_temp.order(tbl text, person integer, item text, qty integer default 1, shared boolean default false)
returns jsonb language sql as $$
  select public.place_guest_order('00000000-0000-4000-8000-00000000cafe', pg_temp.tbl(tbl), gen_random_uuid()::text,
    jsonb_build_array(jsonb_build_object('itemId', pg_temp.item(item), 'qty', qty, 'modifierOptionIds', '[]'::jsonb, 'shared', shared)),
    'es', pg_temp.device(tbl, person), null) $$;
create function pg_temp.staff_order(tbl text, item text, qty integer default 1) returns jsonb language sql as $$
  select public.place_order('00000000-0000-4000-8000-00000000cafe', pg_temp.tbl(tbl), gen_random_uuid()::text, 'staff',
    jsonb_build_array(jsonb_build_object('itemId', pg_temp.item(item), 'qty', qty, 'modifierOptionIds', '[]'::jsonb))) $$;
create function pg_temp.tab(tbl text) returns uuid language sql as $$
  select id from public.tabs where table_id = pg_temp.tbl(tbl) and status <> 'closed' $$;
create function pg_temp.who(tbl text, person integer) returns uuid language sql as $$
  select id from public.tab_participants where tab_id = pg_temp.tab(tbl) and device_hash = pg_temp.device(tbl, person) $$;
create function pg_temp.pay(tbl text, option text, payer integer default null, for_person integer default null,
  parts integer default 1, key text default null, tip_percent integer default null, tip_cents integer default null)
returns jsonb language sql as $$
  select public.create_tab_payment(pg_temp.tab(tbl), option, 'cash', coalesce(key, gen_random_uuid()::text),
    case when payer is not null then pg_temp.who(tbl, payer) end,
    case when for_person is not null then pg_temp.who(tbl, for_person) end, parts, tip_percent, tip_cents) $$;
create function pg_temp.settle(result jsonb, outcome text default 'paid') returns jsonb language sql as $$
  update public.payments set status = outcome::public.payment_status,
    paid_at = case when outcome = 'paid' then now() end
  where id = (result ->> 'payment_id')::uuid returning result $$;
create function pg_temp.sub(result jsonb) returns integer language sql as $$ select (result ->> 'subtotal_cents')::integer $$;
create function pg_temp.ivu(result jsonb) returns integer language sql as $$
  select (result ->> 'ivu_state_cents')::integer + (result ->> 'ivu_municipal_cents')::integer $$;

set local role service_role;

-- ---------------------------------------------------------------------------
-- Mine, another person, the balance, with a locked shared dish.
-- Ana $2.00 malta; Ben shares $10.01 tostones (Ana 501, Ben 500); Cam $13.99 mofongo.
-- ---------------------------------------------------------------------------
select pg_temp.order('t1', 1, 'Malta');
select pg_temp.order('t1', 2, 'Tostones', 1, true);
select pg_temp.order('t1', 3, 'Mofongo');

create temporary table r (k text primary key, v jsonb);
grant all on r to service_role;
insert into r values ('ana', pg_temp.pay('t1', 'mine', 1, null, 1, 'pay-ana-0001'));
select is(pg_temp.sub(v), 701, 'Mis platos: own lines plus locked shares') from r where k = 'ana';
select is((v ->> 'ivu_state_cents')::integer, 74, 'IVU estatal on the first payment') from r where k = 'ana';
select is((v ->> 'ivu_municipal_cents')::integer, 7, 'IVU municipal on the first payment') from r where k = 'ana';
select is((select status::text from public.payments where id = (v ->> 'payment_id')::uuid), 'pending', 'it starts pending') from r where k = 'ana';
select is(pg_temp.pay('t1', 'mine', 1, null, 1, 'pay-ana-0001') ->> 'payment_id', (select v ->> 'payment_id' from r where k = 'ana'), 'a repeated key returns the same payment');
select is(pg_temp.pay('t1', 'mine', 1) ->> 'reason', 'pending_exists', 'one pending payment per person');
select is(pg_temp.pay('t1', 'balance', 2) ->> 'subtotal_cents', '1899', 'a pending payment holds what it covers (the balance skips it)');
select pg_temp.settle(pg_temp.pay('t1', 'balance', 2), 'failed') is not null;
select pg_temp.settle(v) from r where k = 'ana';
select is(pg_temp.pay('t1', 'mine', 1) ->> 'reason', 'nothing_to_pay', 'nothing left to pay for Ana');
insert into r values ('cam', pg_temp.settle(pg_temp.pay('t1', 'person', 2, 3)));
select is(pg_temp.sub(v), 1399, 'Pagar por otra persona: Ben pays Cam''s mofongo') from r where k = 'cam';
select is((select for_participant_id from public.payments where id = (v ->> 'payment_id')::uuid), pg_temp.who('t1', 3), 'recorded as for Cam') from r where k = 'cam';
insert into r values ('ben', pg_temp.settle(pg_temp.pay('t1', 'balance', 2)));
select is(pg_temp.sub(v), 500, 'the balance is what is left: Ben''s share') from r where k = 'ben';
select is(
  (select sum(ivu_state_cents)::integer from public.payments where tab_id = pg_temp.tab('t1') and status <> 'failed'),
  public.ivu_cents(2600, 1050), 'table IVU estatal equals the one-check IVU');
select is(
  (select sum(ivu_municipal_cents)::integer from public.payments where tab_id = pg_temp.tab('t1') and status <> 'failed'),
  public.ivu_cents(2600, 100), 'table IVU municipal equals the one-check IVU');
select is(pg_temp.pay('t1', 'balance') ->> 'reason', 'nothing_to_pay', 'a paid table has nothing to pay');

-- Tips: a whole percent of the subtotal, or cents; never both; bounded.
select pg_temp.order('t2', 1, 'Malta', 3);
select is(pg_temp.pay('t2', 'mine', 1, null, 1, null, 18) ->> 'tip_cents', '108', '18% of $6.00');
update public.payments set status = 'failed' where tab_id = pg_temp.tab('t2');
select is(pg_temp.pay('t2', 'mine', 1, null, 1, null, null, 250) ->> 'tip_cents', '250', 'a tip in cents');
update public.payments set status = 'failed' where tab_id = pg_temp.tab('t2');
select is(pg_temp.pay('t2', 'mine', 1, null, 1, null, 10, 100) ->> 'detail', 'tip', 'percent and cents together are refused');
select is(pg_temp.pay('t2', 'mine', 1, null, 1, null, 101) ->> 'detail', 'tip', 'over 100% is refused');

-- A pending payment left for 15 minutes is abandoned and frees what it held.
insert into r values ('old', pg_temp.pay('t2', 'mine', 1));
update public.payments set created_at = now() - interval '16 minutes' where id = (select (v ->> 'payment_id')::uuid from r where k = 'old');
select is(pg_temp.sub(pg_temp.pay('t2', 'mine', 1)), 600, 'after 15 minutes the person can pay again');
select is((select status::text from public.payments where id = (select (v ->> 'payment_id')::uuid from r where k = 'old')), 'failed', 'the abandoned payment failed');

-- ---------------------------------------------------------------------------
-- Even-split plan: $100 whole-table dinner, four shares; a late order stays outside the plan.
-- ---------------------------------------------------------------------------
select pg_temp.order('t3', 1, 'Refresco');
select pg_temp.order('t3', 2, 'Refresco');
update public.payments set status = 'paid', paid_at = now() where false;
select pg_temp.settle(pg_temp.pay('t3', 'mine', 1));
select pg_temp.settle(pg_temp.pay('t3', 'mine', 2));
select pg_temp.staff_order('t3', 'Cena');
select is(public.start_split_plan(pg_temp.tab('t3'), 4, pg_temp.who('t3', 1)) ->> 'status', 'accepted', 'Dividir en 4 starts a plan');
select is(public.start_split_plan(pg_temp.tab('t3'), 4) ->> 'existing', 'true', 'asking again for 4 returns the same plan');
select is(public.start_split_plan(pg_temp.tab('t3'), 3) ->> 'reason', 'plan_exists', 'a different split is refused while one is active');
select is(pg_temp.sub(pg_temp.settle(pg_temp.pay('t3', 'plan', 1))), 2500, 'one share is a quarter');
select is(public.cancel_split_plan(pg_temp.tab('t3')) ->> 'reason', 'plan_started', 'a started plan cannot be cancelled');
select pg_temp.order('t3', 2, 'Malta');
select is(pg_temp.sub(pg_temp.settle(pg_temp.pay('t3', 'mine', 2))), 200, 'an order after the plan is the orderer''s own, outside the plan');
select is(pg_temp.sub(pg_temp.settle(pg_temp.pay('t3', 'plan', 1, null, 2))), 5000, 'two shares at once');
select is(pg_temp.pay('t3', 'plan', 1, null, 2) ->> 'detail', 'parts', 'no more shares than are left');
insert into r values ('last', pg_temp.settle(pg_temp.pay('t3', 'balance')));
select is(pg_temp.sub(v), 2500, 'the balance pays the last share') from r where k = 'last';
select is((v ->> 'plan_parts')::integer, 1, 'and counts as that share') from r where k = 'last';
select is(public.start_split_plan(pg_temp.tab('t3'), 2) ->> 'reason', 'nothing_to_pay', 'a finished plan ends; nothing is left to split');
select is((select status from public.split_plans where tab_id = pg_temp.tab('t3')), 'done', 'the plan is done');

-- Odd cents: $100.01 in three shares is 33.34, 33.34, 33.33 whoever pays first.
select pg_temp.staff_order('t4', 'Cena');
select pg_temp.staff_order('t4', 'Chicle');
select public.start_split_plan(pg_temp.tab('t4'), 3);
select is(
  array[pg_temp.sub(pg_temp.settle(pg_temp.pay('t4', 'plan'))), pg_temp.sub(pg_temp.settle(pg_temp.pay('t4', 'plan'))), pg_temp.sub(pg_temp.settle(pg_temp.pay('t4', 'plan')))],
  array[3350, 3350, 3350], '$100.50 in three equal shares');
select pg_temp.staff_order('t5', 'Cena');
select pg_temp.staff_order('t5', 'Refresco');
select public.start_split_plan(pg_temp.tab('t5'), 3);
select is(
  array[pg_temp.sub(pg_temp.settle(pg_temp.pay('t5', 'plan'))), pg_temp.sub(pg_temp.settle(pg_temp.pay('t5', 'plan'))), pg_temp.sub(pg_temp.settle(pg_temp.pay('t5', 'plan')))],
  array[3367, 3367, 3366], '$101.00 in three shares: leftover cents to the first');

-- A failed share is open again; cancelling before any share is paid frees the charges.
select pg_temp.staff_order('t6', 'Cena');
select public.start_split_plan(pg_temp.tab('t6'), 2);
select pg_temp.settle(pg_temp.pay('t6', 'plan'), 'failed');
select is(public.cancel_split_plan(pg_temp.tab('t6')) ->> 'status', 'accepted', 'a plan whose only share failed can be cancelled');
select is(pg_temp.sub(pg_temp.pay('t6', 'balance')), 10000, 'its charges are free again');

-- A void inside a plan shrinks what is left of it. Orders come in separate requests in real use, so
-- give the second order a later time (inside this test both would share one timestamp).
select pg_temp.staff_order('t7', 'Cena');
select pg_temp.staff_order('t7', 'Mofongo');
reset role;
update public.order_items set created_at = now() + interval '1 second'
where item_id = pg_temp.item('Mofongo') and order_id in (select id from public.orders where tab_id = pg_temp.tab('t7'));
set local role service_role;
select public.start_split_plan(pg_temp.tab('t7'), 2);
select is(pg_temp.sub(pg_temp.settle(pg_temp.pay('t7', 'plan'))), 5700, 'first share of $113.99 (covers the dinner first)');
reset role;
update public.order_items set voided_at = now(), void_reason = 'devuelto'
where item_id = pg_temp.item('Mofongo') and order_id in (select id from public.orders where tab_id = pg_temp.tab('t7'));
set local role service_role;
select is(pg_temp.sub(pg_temp.settle(pg_temp.pay('t7', 'plan'))), 4300, 'the last share is what is left after the void');

-- IVU is never negative, even when many small payments round up before a tiny last one.
do $$ begin
  for n in 1..21 loop perform pg_temp.order('t8', n, 'Refresco'); end loop;
  perform pg_temp.order('t8', 22, 'Chicle');
  for n in 1..22 loop perform pg_temp.settle(pg_temp.pay('t8', 'mine', n)); end loop;
end $$;
select is((select min(ivu_state_cents) >= 0 and min(ivu_municipal_cents) >= 0 from public.payments where tab_id = pg_temp.tab('t8')), true, 'no payment has negative IVU');
select is(
  (select sum(ivu_state_cents)::integer from public.payments where tab_id = pg_temp.tab('t8')),
  public.ivu_cents(2150, 1050), 'and the table total is exact');

-- Staff can't re-share a dish once money touches it.
reset role;
create temporary table ids (k text primary key, v uuid);
grant all on ids to authenticated;
insert into ids values ('line', (select i.id from public.order_items i join public.orders o on o.id = i.order_id
  where o.tab_id = pg_temp.tab('t1') and i.shared));
insert into ids values ('ana', pg_temp.who('t1', 1));
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}';
select throws_ok(format('select public.set_item_shares(%L, array[%L]::uuid[])', (select v from ids where k = 'line'), (select v from ids where k = 'ana')),
  '22023', null, 'a paid shared dish keeps its shares');
select throws_ok($$ select public.create_tab_payment(gen_random_uuid(), 'balance', 'cash', 'staff-direct-0001') $$,
  '42501', null, 'staff browsers cannot create payments directly');
set local role anon;
select throws_ok($$ select public.start_split_plan(gen_random_uuid(), 2) $$, '42501', null, 'guests cannot start plans directly');

-- ---------------------------------------------------------------------------
-- Property: random tables (people, shared dishes, whole-table orders), random payments that succeed
-- or fail, plans started and cancelled, then the balance. Every table ends fully covered, every cent
-- once, with exact IVU and no negative amount.
-- ---------------------------------------------------------------------------
reset role;
set local role service_role;
create temporary table prop (tables integer, payments integer, violations integer);
grant all on prop to service_role;
do $$
declare
  v_tables integer := 0;
  v_pays integer := 0;
  v_bad integer := 0;
  v_tbl text;
  v_people integer;
  v_res jsonb;
  v_r float;
  v_items text[] := array['Malta', 'Tostones', 'Mofongo', 'Refresco', 'Chicle'];
  v_tab uuid;
  v_total bigint;
  v_paid bigint;
begin
  perform setseed(0.42);
  for t in 1..150 loop
    v_tbl := 't' || (t + 50);
    v_people := 2 + floor(random() * 4)::integer;
    for p in 1..v_people loop
      for k in 1..(1 + floor(random() * 3)::integer) loop
        perform pg_temp.order(v_tbl, p, v_items[1 + floor(random() * 5)::integer], 1 + floor(random() * 3)::integer, random() < 0.3);
      end loop;
    end loop;
    if random() < 0.4 then perform pg_temp.staff_order(v_tbl, v_items[1 + floor(random() * 5)::integer], 1 + floor(random() * 2)::integer); end if;
    v_tab := pg_temp.tab(v_tbl);

    for a in 1..(3 + floor(random() * 6)::integer) loop
      v_r := random();
      if v_r < 0.3 then
        v_res := pg_temp.pay(v_tbl, 'mine', 1 + floor(random() * v_people)::integer);
      elsif v_r < 0.45 then
        v_res := pg_temp.pay(v_tbl, 'person', 1 + floor(random() * v_people)::integer, 1 + floor(random() * v_people)::integer);
      elsif v_r < 0.6 then
        perform public.start_split_plan(v_tab, 2 + floor(random() * 3)::integer);
        v_res := null;
      elsif v_r < 0.85 then
        v_res := pg_temp.pay(v_tbl, 'plan', null, null, 1);
      else
        perform public.cancel_split_plan(v_tab);
        v_res := null;
      end if;
      if v_res ->> 'status' = 'accepted' then
        perform pg_temp.settle(v_res, case when random() < 0.7 then 'paid' else 'failed' end);
      end if;
    end loop;
    perform pg_temp.settle(pg_temp.pay(v_tbl, 'balance'));

    select coalesce(sum(c_cents), 0) into v_total from public.tab_charges(v_tab);
    select coalesce(sum(amount_cents), 0) into v_paid from public.payments where tab_id = v_tab and status <> 'failed';
    if exists (select 1 from public.tab_charges(v_tab) where c_covered <> c_cents)
       or v_paid <> v_total
       or (select coalesce(sum(ivu_state_cents), 0) from public.payments where tab_id = v_tab and status <> 'failed') <> public.ivu_cents(v_total, 1050)
       or (select coalesce(sum(ivu_municipal_cents), 0) from public.payments where tab_id = v_tab and status <> 'failed') <> public.ivu_cents(v_total, 100)
       or exists (select 1 from public.payments where tab_id = v_tab and (amount_cents < 0 or ivu_state_cents < 0 or ivu_municipal_cents < 0))
       or exists (select 1 from public.payment_allocations a join public.payments p on p.id = a.payment_id
                  where p.tab_id = v_tab and p.status <> 'failed'
                  group by a.payment_id having sum(a.cents) <> max(p.amount_cents)) then
      v_bad := v_bad + 1;
    end if;
    v_tables := v_tables + 1;
    v_pays := v_pays + (select count(*) from public.payments where tab_id = v_tab);
  end loop;
  insert into prop values (v_tables, v_pays, v_bad);
end $$;
select is((select tables from prop), 150, '150 random tables were settled');
select diag('random tables: ' || tables || ', payments: ' || payments || ', failed: ' || (select count(*) from public.payments p join public.tabs t on t.id = p.tab_id where p.status = 'failed' and t.restaurant_id = '00000000-0000-4000-8000-00000000cafe')) from prop;
select ok((select payments from prop) > 300, 'with hundreds of payments, some of them failed');
select is((select violations from prop), 0, 'every table conserves every cent, with exact IVU and nothing negative');

select * from finish();
rollback;
