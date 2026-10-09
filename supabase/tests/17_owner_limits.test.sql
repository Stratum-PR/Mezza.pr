-- P2-1 (issue #13): the audit log is append-only from the app's point of view (written by server code
-- and SECURITY DEFINER functions, never edited by signed-in users), and owners edit their
-- restaurant's settings but not its billing state (plan, status, trial, order numbering, onboarding,
-- fiscal mode) or its subscription and usage-fee rows.
begin;
select no_plan();
-- Test helpers (pg_temp functions) are called as signed-in users; new functions get no EXECUTE by
-- default since P2-2, so this transaction (rolled back below) opts back in.
alter default privileges grant execute on functions to public;

insert into public.restaurants (id, slug, name, trial_ends_at) values
  ('00000000-0000-4000-8000-00000000cafe', 'test-ol', 'Café Lucía', now() + interval '30 days');
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000001', 'owner@cafe-lucia.test'),
  ('00000000-0000-4000-8000-000000000002', 'manager@cafe-lucia.test');
insert into public.memberships (restaurant_id, user_id, role) values
  ('00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-000000000001', 'owner'),
  ('00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-000000000002', 'manager');
insert into public.audit_log (restaurant_id, actor_id, action, target_table)
  values ('00000000-0000-4000-8000-00000000cafe', '00000000-0000-4000-8000-000000000002', 'void', 'orders');
insert into public.subscriptions (restaurant_id, plan) values ('00000000-0000-4000-8000-00000000cafe', 'A');
insert into public.usage_fees (restaurant_id, period) values ('00000000-0000-4000-8000-00000000cafe', date_trunc('month', current_date)::date);

create function pg_temp.as_user(id text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, true) $$;
create function pg_temp.changed(p_sql text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute format('with x as (%s returning 1) select count(*) from x', p_sql) into n;
  return n;
exception when insufficient_privilege then
  return 0;
end $$;

set local role authenticated;
select pg_temp.as_user('00000000-0000-4000-8000-000000000001');

-- Billing state stays with Mezza.
select is(pg_temp.changed($$update public.restaurants set plan = 'Z' where slug = 'test-ol'$$), 0::bigint, 'the owner cannot change the plan');
select is(pg_temp.changed($$update public.restaurants set status = 'active' where slug = 'test-ol'$$), 0::bigint, 'nor the account status');
select is(pg_temp.changed($$update public.restaurants set trial_ends_at = '2099-01-01' where slug = 'test-ol'$$), 0::bigint, 'nor the trial end');
select is(pg_temp.changed($$update public.restaurants set next_order_number = 1001 where slug = 'test-ol'$$), 0::bigint, 'nor the order numbering');
select is(pg_temp.changed($$update public.restaurants set onboarding_step = 7 where slug = 'test-ol'$$), 0::bigint, 'nor the onboarding step');
select is(pg_temp.changed($$update public.restaurants set fiscal_mode = 'processor' where slug = 'test-ol'$$), 0::bigint, 'nor the fiscal mode');
select is(pg_temp.changed($$update public.subscriptions set plan = 'B', status = 'active' where restaurant_id = '00000000-0000-4000-8000-00000000cafe'$$), 0::bigint, 'nor the subscription');
select is(pg_temp.changed($$delete from public.subscriptions where restaurant_id = '00000000-0000-4000-8000-00000000cafe'$$), 0::bigint, 'nor delete it');
select is(pg_temp.changed($$delete from public.usage_fees where restaurant_id = '00000000-0000-4000-8000-00000000cafe'$$), 0::bigint, 'nor delete usage fees');
select throws_ok($$insert into public.subscriptions (restaurant_id, plan, status) values ('00000000-0000-4000-8000-00000000cafe', 'B', 'active')$$,
  '42501', null, 'nor add a subscription');
select ok((select count(*) from public.subscriptions) = 1, 'the owner still reads the subscription');

-- The settings the app edits (Ajustes) still work.
select is(pg_temp.changed($$update public.restaurants set name = 'Café Lucía 2', timezone = 'America/Puerto_Rico',
  default_language = 'en', default_menu_style = 'simple' where slug = 'test-ol'$$), 1::bigint, 'the owner edits the profile');
select is(pg_temp.changed($$update public.restaurants set ivu_state_bps = 1050, ivu_municipal_bps = 100 where slug = 'test-ol'$$), 1::bigint, 'and the IVU rates');
select is(pg_temp.changed($$update public.restaurants set qr_max_order_cents = 40000, qr_max_line_qty = 10, qr_max_tab_cents = 200000,
  max_people_per_table = 12 where slug = 'test-ol'$$), 1::bigint, 'and the QR limits');
select is(pg_temp.changed($$update public.restaurants set brand_color = '#123456', cover_path = null where slug = 'test-ol'$$), 1::bigint, 'and the brand');
select is(pg_temp.changed($$update public.restaurants set slug = 'test-ol-2' where slug = 'test-ol'$$), 1::bigint, 'and the link (slug)');

-- The audit log: read, never edited.
select is(pg_temp.changed($$delete from public.audit_log where restaurant_id = '00000000-0000-4000-8000-00000000cafe'$$), 0::bigint, 'the owner cannot delete audit entries');
select is(pg_temp.changed($$update public.audit_log set after = '{}' where restaurant_id = '00000000-0000-4000-8000-00000000cafe'$$), 0::bigint, 'nor edit them');
select throws_ok($$insert into public.audit_log (restaurant_id, action, target_table) values ('00000000-0000-4000-8000-00000000cafe', 'void', 'orders')$$,
  '42501', null, 'nor write them directly');
select ok((select count(*) from public.audit_log) = 1, 'the owner reads the audit log');
select pg_temp.as_user('00000000-0000-4000-8000-000000000002');
select ok((select count(*) from public.audit_log) = 1, 'so does the manager');
select is(pg_temp.changed($$delete from public.audit_log where restaurant_id = '00000000-0000-4000-8000-00000000cafe'$$), 0::bigint, 'who cannot delete it either');

reset role;
select is((select plan || '/' || status from public.restaurants where id = '00000000-0000-4000-8000-00000000cafe'), 'A/trial', 'the billing state is unchanged');
select is((select count(*) from public.audit_log where restaurant_id = '00000000-0000-4000-8000-00000000cafe'), 1::bigint, 'and the audit entry is still there');

select * from finish();
rollback;
