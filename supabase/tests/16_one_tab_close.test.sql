-- P3-4: one tab-closing path. "Mesa libre" (close_tab), "Cerrado en el POS" (close_tab_on_pos) and
-- the idle housekeeping (close_idle_tabs) keep their own checks, and all three close through
-- close_tab_core: the tab closes once (status, closed_at), its open requests are handled, and the
-- audit row (when the path audits) has one shape. close_tab_core is internal: nobody calls it directly.
begin;
select no_plan();
-- Test helpers (pg_temp functions) are called as signed-in users; new functions get no EXECUTE by
-- default since P2-2, so this transaction (rolled back below) opts back in.
alter default privileges grant execute on functions to public;

insert into public.restaurants (id, slug, name) values ('00000000-0000-4000-8000-00000000cafe', 'test-otc', 'Café Lucía');
insert into public.menu_sections (id, restaurant_id, name_es, name_en)
  values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000cafe', 'Café', 'Coffee');
insert into public.menu_items (id, restaurant_id, section_id, name_es, name_en, price_cents) values
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-0000000000a1', 'Malta', 'Malta', 200);
insert into public.dining_tables (restaurant_id, label)
  select '00000000-0000-4000-8000-00000000cafe', 'm' || n from generate_series(1, 4) as n;
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
create function pg_temp.order(tbl text) returns jsonb language sql as $$
  select public.place_guest_order('00000000-0000-4000-8000-00000000cafe', pg_temp.tbl(tbl), gen_random_uuid()::text,
    jsonb_build_array(jsonb_build_object('itemId', '00000000-0000-4000-8000-0000000000b1', 'qty', 1, 'modifierOptionIds', '[]'::jsonb)),
    'es', encode(sha256(convert_to(tbl, 'utf8')), 'hex'), null) $$;
create function pg_temp.tab(tbl text) returns uuid language sql as $$
  select id from public.tabs where table_id = pg_temp.tbl(tbl) order by opened_at desc limit 1 $$;
create function pg_temp.as_user(id text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, true) $$;
create function pg_temp.audits(p_tab uuid, p_action text) returns bigint language sql as $$
  select count(*) from public.audit_log where target_id = p_tab and action::text = p_action $$;
create function pg_temp.open_requests(p_tab uuid) returns bigint language sql as $$
  select count(*) from public.service_requests where tab_id = p_tab and status = 'open' $$;

-- ---------------------------------------------------------------------------
-- The shared function: internal, SECURITY DEFINER with a fixed search_path, and every path uses it.
-- ---------------------------------------------------------------------------
select is((select count(*) from pg_proc where proname = 'close_tab_core' and pronamespace = 'public'::regnamespace), 1::bigint,
  'public.close_tab_core exists');
select is((select bool_and(prosecdef) from pg_proc where proname = 'close_tab_core' and pronamespace = 'public'::regnamespace), true,
  'close_tab_core is SECURITY DEFINER');
select is((select bool_and(proconfig @> array['search_path=""']) from pg_proc where proname = 'close_tab_core' and pronamespace = 'public'::regnamespace), true,
  'close_tab_core sets an empty search_path');
select is((select bool_or(has_function_privilege(r, p.oid, 'execute'))
  from pg_proc p, unnest(array['anon', 'authenticated', 'public']) as r
  where p.proname = 'close_tab_core' and p.pronamespace = 'public'::regnamespace), false,
  'anon, authenticated and public cannot call close_tab_core');
select is((select count(*) from pg_proc where pronamespace = 'public'::regnamespace
  and proname in ('close_tab', 'close_tab_on_pos', 'close_idle_tabs') and prosrc like '%public.close_tab_core(%'), 3::bigint,
  'close_tab, close_tab_on_pos and close_idle_tabs all close through close_tab_core');
select is((select count(*) from pg_proc where pronamespace = 'public'::regnamespace
  and proname in ('close_tab', 'close_tab_on_pos', 'close_idle_tabs')
  and prosrc ~ 'update public\.tabs\s+set[^;]*status = ''closed'''), 0::bigint,
  'none of them sets the closed status itself');

-- The public RPCs keep their signatures and grants.
select ok(has_function_privilege('authenticated', 'public.close_tab(uuid)', 'execute')
  and has_function_privilege('service_role', 'public.close_tab(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.close_tab(uuid)', 'execute'), 'close_tab: staff and server code, not anon');
select ok(has_function_privilege('authenticated', 'public.close_tab_on_pos(uuid)', 'execute')
  and has_function_privilege('service_role', 'public.close_tab_on_pos(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.close_tab_on_pos(uuid)', 'execute'), 'close_tab_on_pos: staff and server code, not anon');
select ok(has_function_privilege('authenticated', 'public.close_idle_tabs(uuid)', 'execute')
  and has_function_privilege('service_role', 'public.close_idle_tabs(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.close_idle_tabs(uuid)', 'execute'), 'close_idle_tabs: staff and server code, not anon');
select is(pg_get_function_result('public.close_tab(uuid)'::regprocedure), 'void', 'close_tab returns void');
select is(pg_get_function_result('public.close_tab_on_pos(uuid)'::regprocedure), 'void', 'close_tab_on_pos returns void');
select is(pg_get_function_result('public.close_idle_tabs(uuid)'::regprocedure), 'integer', 'close_idle_tabs returns how many closed');

-- Tabs: m1 empty (settled), m2 owes, m3 empty (settled), m4 paid and quiet (idle). Each has an open request.
insert into public.tabs (restaurant_id, table_id) select '00000000-0000-4000-8000-00000000cafe', pg_temp.tbl(l) from unnest(array['m1', 'm3']) as l;
set local role service_role;
select pg_temp.order('m2');
select pg_temp.order('m4');
select public.create_tab_payment(pg_temp.tab('m4'), 'balance', 'cash', 'otc-m4-0001');
reset role;
update public.payments set status = 'paid', paid_at = now() - interval '15 minutes', created_at = now() - interval '15 minutes'
  where idempotency_key = 'otc-m4-0001';
update public.orders set created_at = now() - interval '30 minutes' where tab_id = pg_temp.tab('m4');
insert into public.service_requests (restaurant_id, tab_id, kind)
  select '00000000-0000-4000-8000-00000000cafe', pg_temp.tab(l), 'bring_check' from unnest(array['m1', 'm2', 'm3', 'm4']) as l;

create temporary table ids (k text primary key, v uuid);
grant all on ids to authenticated, service_role;
insert into ids select l, pg_temp.tab(l) from unnest(array['m1', 'm2', 'm3', 'm4']) as l;

-- Nobody signed in can call the internal function.
set local role authenticated;
select pg_temp.as_user('00000000-0000-4000-8000-000000000002');
select throws_ok(format('select public.close_tab_core(%L, null, null, null)', (select v from ids where k = 'm1')), '42501', null,
  'a manager cannot call close_tab_core directly');
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok(format('select public.close_tab_core(%L, null, null, null)', (select v from ids where k = 'm1')), '42501', null,
  'anon cannot call close_tab_core');
reset role;
select is((select status::text from public.tabs where id = (select v from ids where k = 'm1')), 'open', 'm1 is still open');

-- ---------------------------------------------------------------------------
-- "Mesa libre" (close_tab): staff only, settled only, audited once as close_tab.
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.as_user('00000000-0000-4000-8000-000000000004');
select throws_ok(format('select public.close_tab(%L)', (select v from ids where k = 'm1')), '42501', null, 'the kitchen cannot free a table');
select pg_temp.as_user('00000000-0000-4000-8000-000000000003');
select throws_ok(format('select public.close_tab(%L)', (select v from ids where k = 'm2')), '22023', null, 'a table that owes cannot be freed');
select lives_ok(format('select public.close_tab(%L)', (select v from ids where k = 'm1')), 'a server frees a settled table');
select lives_ok(format('select public.close_tab(%L)', (select v from ids where k = 'm1')), 'freeing it again is harmless');
reset role;
select ok((select status = 'closed' and closed_at = now() and pos_closed_at is null from public.tabs where id = (select v from ids where k = 'm1')),
  'm1 is closed now; the POS reminder stays');
select is(pg_temp.open_requests((select v from ids where k = 'm1')), 0::bigint, 'its open request is handled');
select is((select handled_by from public.service_requests where tab_id = (select v from ids where k = 'm1')),
  '00000000-0000-4000-8000-000000000003'::uuid, 'by the server who freed it');
select is(pg_temp.audits((select v from ids where k = 'm1'), 'close_tab'), 1::bigint, 'audited once as close_tab');
select ok((select actor_id = '00000000-0000-4000-8000-000000000003' and target_table = 'tabs' and before is null and after is null
  and restaurant_id = '00000000-0000-4000-8000-00000000cafe'
  from public.audit_log where target_id = (select v from ids where k = 'm1') and action = 'close_tab'), 'the close_tab row: actor, tabs, no before/after');
select is((select status::text from public.tabs where id = (select v from ids where k = 'm2')), 'open', 'm2 (owes) stays open');

-- ---------------------------------------------------------------------------
-- "Cerrado en el POS" (close_tab_on_pos): closes even an unsettled tab, sets the POS columns once,
-- audited as pos_close with what the tab was before.
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.as_user('00000000-0000-4000-8000-000000000004');
select throws_ok(format('select public.close_tab_on_pos(%L)', (select v from ids where k = 'm2')), '42501', null, 'the kitchen cannot close on the POS');
select pg_temp.as_user('00000000-0000-4000-8000-000000000002');
select lives_ok(format('select public.close_tab_on_pos(%L)', (select v from ids where k = 'm2')), 'a manager closes m2 on the POS');
select lives_ok(format('select public.close_tab_on_pos(%L)', (select v from ids where k = 'm2')), 'closing it again is harmless');
reset role;
select ok((select status = 'closed' and closed_at = now() and pos_closed_at = now() and pos_closed_by = '00000000-0000-4000-8000-000000000002'
  from public.tabs where id = (select v from ids where k = 'm2')), 'm2 is closed, with the POS time and who');
select is(pg_temp.open_requests((select v from ids where k = 'm2')), 0::bigint, 'its open request is handled (like every other close)');
select is((select handled_by from public.service_requests where tab_id = (select v from ids where k = 'm2')),
  '00000000-0000-4000-8000-000000000002'::uuid, 'by the manager who closed it');
select is(pg_temp.audits((select v from ids where k = 'm2'), 'pos_close'), 1::bigint, 'audited once as pos_close');
select is(pg_temp.audits((select v from ids where k = 'm2'), 'close_tab'), 0::bigint, 'and not as close_tab');
select is((select before from public.audit_log where target_id = (select v from ids where k = 'm2') and action = 'pos_close'),
  jsonb_build_object('status', 'open', 'closed_at', null, 'settled', false), 'the pos_close row keeps what the tab was before');
select ok((select actor_id = '00000000-0000-4000-8000-000000000002' and target_table = 'tabs' and after is null
  from public.audit_log where target_id = (select v from ids where k = 'm2') and action = 'pos_close'), 'with the actor, on tabs, no after');

-- A table freed first and entered on the POS later keeps the time it was freed.
set local role authenticated;
select pg_temp.as_user('00000000-0000-4000-8000-000000000003');
select lives_ok(format('select public.close_tab(%L)', (select v from ids where k = 'm3')), 'm3 is freed');
reset role;
update public.tabs set closed_at = now() - interval '1 hour' where id = (select v from ids where k = 'm3');
set local role authenticated;
select pg_temp.as_user('00000000-0000-4000-8000-000000000003');
select lives_ok(format('select public.close_tab_on_pos(%L)', (select v from ids where k = 'm3')), 'then closed on the POS');
reset role;
select ok((select status = 'closed' and closed_at = now() - interval '1 hour' and pos_closed_at = now()
  from public.tabs where id = (select v from ids where k = 'm3')), 'm3 keeps its close time and gets the POS time');
select is((select before ->> 'status' from public.audit_log where target_id = (select v from ids where k = 'm3') and action = 'pos_close'),
  'closed', 'the pos_close row says it was already closed');
select is(pg_temp.audits((select v from ids where k = 'm3'), 'close_tab'), 1::bigint, 'one close_tab row');
select is(pg_temp.audits((select v from ids where k = 'm3'), 'pos_close'), 1::bigint, 'one pos_close row');

-- ---------------------------------------------------------------------------
-- Idle close (close_idle_tabs): settled and quiet for 10 minutes; not audited, requests handled by nobody.
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.as_user('00000000-0000-4000-8000-000000000003');
select throws_ok($$ select public.close_idle_tabs(gen_random_uuid()) $$, '42501', null, 'staff only tidy their own restaurant');
reset role;
set local role service_role;
select is(public.close_idle_tabs('00000000-0000-4000-8000-00000000cafe'), 1, 'one idle settled table closes');
select is(public.close_idle_tabs('00000000-0000-4000-8000-00000000cafe'), 0, 'and only once');
reset role;
select ok((select status = 'closed' and closed_at = now() and pos_closed_at is null from public.tabs where id = (select v from ids where k = 'm4')),
  'm4 is closed now; the POS reminder stays');
select is(pg_temp.open_requests((select v from ids where k = 'm4')), 0::bigint, 'its open request is handled');
select is((select handled_by from public.service_requests where tab_id = (select v from ids where k = 'm4')), null::uuid, 'by nobody in particular');
select is((select count(*) from public.audit_log where target_id = (select v from ids where k = 'm4')), 0::bigint, 'the idle close is not audited');

select * from finish();
rollback;
