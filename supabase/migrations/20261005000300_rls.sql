-- Row-level security. Every table in public has RLS on. Staff policies only: guests never query
-- the database from the browser in pass 1, so anon gets no policies (and no table privileges).
--
-- Role permissions:
--   owner   everything
--   manager menu, tables, voids, refunds, staff, reports (not payment setup or plan)
--   server  orders, tabs, service requests, cash confirmation, reading the menu
--   kitchen reading orders, order status and sold-out (through set_order_status / set_item_availability)

do $$
declare
  t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end;
$$;

revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

-- Helper: one policy per command for a table, given the roles allowed.
create function pg_temp.staff_policy(p_table text, p_command text, p_roles text)
returns void
language plpgsql
as $$
declare
  v_name text := format('%s_%s_%s', p_table, lower(p_command), replace(replace(replace(p_roles, ',', '_'), '{', ''), '}', ''));
  v_check text := format('public.has_role(restaurant_id, %L::public.member_role[])', p_roles);
begin
  if p_command = 'SELECT' or p_command = 'DELETE' then
    execute format('create policy %I on public.%I for %s to authenticated using (%s)', v_name, p_table, p_command, v_check);
  elsif p_command = 'INSERT' then
    execute format('create policy %I on public.%I for insert to authenticated with check (%s)', v_name, p_table, v_check);
  else
    execute format('create policy %I on public.%I for %s to authenticated using (%s) with check (%s)', v_name, p_table, p_command, v_check, v_check);
  end if;
end;
$$;

-- Owner: everything on every tenant table.
do $$
declare
  t record;
begin
  for t in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public' and c.column_name = 'restaurant_id' and tb.table_type = 'BASE TABLE'
  loop
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.has_role(restaurant_id, ''{owner}''::public.member_role[])) with check (public.has_role(restaurant_id, ''{owner}''::public.member_role[]))',
      t.table_name || '_owner_all', t.table_name
    );
  end loop;
end;
$$;

-- Menu: everyone reads; managers write.
do $$
declare
  t text;
begin
  foreach t in array array[
    'menu_uploads', 'menu_themes', 'menu_sections', 'menu_items', 'item_availability_events', 'modifier_groups',
    'modifier_options', 'item_modifier_groups', 'original_menu_pages', 'item_hotspots', 'dining_tables', 'qr_designs',
    'printers'
  ] loop
    perform pg_temp.staff_policy(t, 'SELECT', '{manager,server,kitchen}');
    perform pg_temp.staff_policy(t, 'INSERT', '{manager}');
    perform pg_temp.staff_policy(t, 'UPDATE', '{manager}');
    perform pg_temp.staff_policy(t, 'DELETE', '{manager}');
  end loop;
end;
$$;

-- Floor: tabs and requests are read by everyone (the kitchen shows table labels); servers and managers write.
select pg_temp.staff_policy('tabs', 'SELECT', '{manager,server,kitchen}');
select pg_temp.staff_policy('tabs', 'INSERT', '{manager,server}');
select pg_temp.staff_policy('tabs', 'UPDATE', '{manager,server}');

select pg_temp.staff_policy('tab_participants', 'SELECT', '{manager,server}');
select pg_temp.staff_policy('tab_participants', 'INSERT', '{manager,server}');
select pg_temp.staff_policy('tab_participants', 'UPDATE', '{manager,server}');

select pg_temp.staff_policy('cart_items', 'SELECT', '{manager,server}');
select pg_temp.staff_policy('cart_items', 'INSERT', '{manager,server}');
select pg_temp.staff_policy('cart_items', 'UPDATE', '{manager,server}');
select pg_temp.staff_policy('cart_items', 'DELETE', '{manager,server}');

select pg_temp.staff_policy('service_requests', 'SELECT', '{manager,server}');
select pg_temp.staff_policy('service_requests', 'INSERT', '{manager,server}');
select pg_temp.staff_policy('service_requests', 'UPDATE', '{manager,server}');

select pg_temp.staff_policy('guests', 'SELECT', '{manager,server}');
select pg_temp.staff_policy('guests', 'INSERT', '{manager,server}');

-- Orders: everyone reads. Orders are created by place_order and changed by set_order_status / void_order.
select pg_temp.staff_policy('orders', 'SELECT', '{manager,server,kitchen}');
select pg_temp.staff_policy('order_items', 'SELECT', '{manager,server,kitchen}');

-- Money: servers record and confirm cash; the kitchen never sees payments.
select pg_temp.staff_policy('payments', 'SELECT', '{manager,server}');
select pg_temp.staff_policy('payments', 'INSERT', '{manager,server}');
select pg_temp.staff_policy('payments', 'UPDATE', '{manager,server}');
select pg_temp.staff_policy('refunds', 'SELECT', '{manager}');
-- refunds are written by record_refund; payment_accounts, subscriptions and usage_fees are owner-only.

-- Devices and printing: every staff browser registers itself and logs print jobs.
select pg_temp.staff_policy('devices', 'SELECT', '{manager,server,kitchen}');
select pg_temp.staff_policy('devices', 'INSERT', '{manager,server,kitchen}');
select pg_temp.staff_policy('devices', 'UPDATE', '{manager,server,kitchen}');
select pg_temp.staff_policy('devices', 'DELETE', '{manager}');
select pg_temp.staff_policy('print_jobs', 'SELECT', '{manager,server,kitchen}');
select pg_temp.staff_policy('print_jobs', 'INSERT', '{manager,server,kitchen}');
select pg_temp.staff_policy('print_jobs', 'UPDATE', '{manager,server,kitchen}');

-- Reports.
select pg_temp.staff_policy('daily_sales', 'SELECT', '{manager}');
select pg_temp.staff_policy('item_sales_daily', 'SELECT', '{manager}');
select pg_temp.staff_policy('exports', 'SELECT', '{manager}');
select pg_temp.staff_policy('exports', 'INSERT', '{manager}');
select pg_temp.staff_policy('audit_log', 'SELECT', '{manager}');

-- Restaurants: members read their restaurant; only the owner edits it.
create policy restaurants_select_members on public.restaurants for select to authenticated
  using (public.has_role(id, '{owner,manager,server,kitchen}'::public.member_role[]));
create policy restaurants_update_owner on public.restaurants for update to authenticated
  using (public.has_role(id, '{owner}'::public.member_role[]))
  with check (public.has_role(id, '{owner}'::public.member_role[]));

-- Memberships: everyone sees their own; managers see the team and manage non-owner members.
create policy memberships_select_self on public.memberships for select to authenticated
  using (user_id = (select auth.uid()));
create policy memberships_select_manager on public.memberships for select to authenticated
  using (public.has_role(restaurant_id, '{manager}'::public.member_role[]));
create policy memberships_insert_manager on public.memberships for insert to authenticated
  with check (public.has_role(restaurant_id, '{manager}'::public.member_role[]) and role <> 'owner');
create policy memberships_update_manager on public.memberships for update to authenticated
  using (public.has_role(restaurant_id, '{manager}'::public.member_role[]) and role <> 'owner')
  with check (public.has_role(restaurant_id, '{manager}'::public.member_role[]) and role <> 'owner');

-- Support access: the owner reads and approves grants (owner_all covers it).

-- Profiles: your own, plus the profiles of your team if you manage it.
create policy profiles_select_self on public.profiles for select to authenticated
  using (user_id = (select auth.uid()));
create policy profiles_select_team on public.profiles for select to authenticated
  using (exists (
    select 1 from public.memberships m
    where m.user_id = profiles.user_id
      and public.has_role(m.restaurant_id, '{owner,manager}'::public.member_role[])
  ));
create policy profiles_insert_self on public.profiles for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy profiles_update_self on public.profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Platform admins can see that they are one.
create policy platform_admins_select_self on public.platform_admins for select to authenticated
  using (user_id = (select auth.uid()));

-- webhook_events and demo_requests: no policies (service role only).

-- ---------------------------------------------------------------------------
-- Reporting views (run with the caller's rights, so RLS applies)
-- ---------------------------------------------------------------------------
create view public.tab_totals with (security_invoker = true) as
select
  t.id as tab_id,
  t.restaurant_id,
  t.table_id,
  t.status,
  coalesce(sum(oi.qty * oi.unit_price_cents) filter (where oi.voided_at is null and o.status <> 'void'), 0)::integer
    as subtotal_cents,
  count(oi.id) filter (where oi.voided_at is null and o.status <> 'void')::integer as line_count
from public.tabs t
left join public.orders o on o.tab_id = t.id
left join public.order_items oi on oi.order_id = o.id
group by t.id;

create view public.ivu_monthly with (security_invoker = true) as
select
  d.restaurant_id,
  date_trunc('month', d.date)::date as month,
  sum(d.sales_cents)::bigint as sales_cents,
  sum(d.ivu_state_cents)::bigint as ivu_state_cents,
  sum(d.ivu_municipal_cents)::bigint as ivu_municipal_cents,
  sum(d.tips_cents)::bigint as tips_cents
from public.daily_sales d
group by d.restaurant_id, date_trunc('month', d.date);

revoke all on public.tab_totals, public.ivu_monthly from anon;
