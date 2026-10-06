-- Pass 2, phase 5: staff tools for split bills. Moving a line to another person or the table, voids
-- that refund each payer from what their payment covered, manager write-offs (covered, never sales),
-- closing a settled table ("Mesa libre", and automatically after 10 idle minutes at $0), and the
-- period's voids and write-offs for reports.

alter type public.audit_action add value 'move_line';
alter type public.audit_action add value 'write_off';
alter type public.audit_action add value 'close_tab';

-- ---------------------------------------------------------------------------
-- Write-offs: a balance nobody will pay, covered by a manager with a reason. Not a payment: reports
-- keep it apart from sales and collected money.
-- ---------------------------------------------------------------------------
create table public.write_offs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  tab_id uuid not null,
  participant_id uuid,
  scope text not null check (scope in ('person', 'table', 'balance')),
  cents integer not null check (cents > 0),
  reason text not null check (length(btrim(reason)) between 3 and 300),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (restaurant_id, id),
  foreign key (restaurant_id, tab_id) references public.tabs (restaurant_id, id) on delete cascade,
  foreign key (restaurant_id, participant_id) references public.tab_participants (restaurant_id, id) on delete set null (participant_id)
);
create index write_offs_restaurant_idx on public.write_offs (restaurant_id, created_at);

create table public.write_off_allocations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  write_off_id uuid not null references public.write_offs (id) on delete cascade,
  order_item_id uuid not null references public.order_items (id) on delete restrict,
  share_id uuid references public.order_item_shares (id) on delete restrict,
  cents integer not null check (cents > 0)
);
create index write_off_allocations_item on public.write_off_allocations (order_item_id);

do $$
declare t text;
begin
  foreach t in array array['write_offs', 'write_off_allocations'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.has_role(restaurant_id, ''{owner}''::public.member_role[])) with check (public.has_role(restaurant_id, ''{owner}''::public.member_role[]))',
      t || '_owner_all', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.has_role(restaurant_id, ''{manager,server}''::public.member_role[]))',
      t || '_select_manager_server', t);
  end loop;
end $$;

-- Charges count write-offs as covered (so a written-off table can close).
create or replace function public.tab_charges(p_tab_id uuid)
returns table (c_item uuid, c_share uuid, c_owner uuid, c_cents integer, c_covered integer, c_plan uuid, c_created timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  with live as (
    select i.* from public.order_items i join public.orders o on o.id = i.order_id
    where o.tab_id = p_tab_id and o.status <> 'void' and i.voided_at is null
  ), units as (
    select l.id as item, s.id as share, s.participant_id as owner, s.cents, l.created_at
    from live l join public.order_item_shares s on s.order_item_id = l.id
    where l.shared
    union all
    select l.id, null, case when l.shared then null else l.participant_id end, l.qty * l.unit_price_cents, l.created_at
    from live l
    where not (l.shared and exists (select 1 from public.order_item_shares s where s.order_item_id = l.id))
  )
  select u.item, u.share, u.owner, u.cents,
    coalesce((
      select sum(a.cents) from public.payment_allocations a join public.payments p on p.id = a.payment_id
      where a.order_item_id = u.item and a.share_id is not distinct from u.share and p.status <> 'failed'
    ), 0)::integer + coalesce((
      select sum(w.cents) from public.write_off_allocations w
      where w.order_item_id = u.item and w.share_id is not distinct from u.share
    ), 0)::integer,
    (
      select pu.plan_id from public.split_plan_units pu join public.split_plans sp on sp.id = pu.plan_id
      where sp.status = 'active' and pu.order_item_id = u.item and pu.share_id is not distinct from u.share
    ),
    u.created_at
  from units u
$$;

-- ---------------------------------------------------------------------------
-- move_order_item: "Mover a otra persona" / "a la mesa" (p_participant_id null). Only lines no money
-- has touched (no payment that hasn't failed, no write-off, not in an active even split). A shared
-- line moved to one person (or the table) stops being shared. Staff; audited.
-- ---------------------------------------------------------------------------
create function public.move_order_item(p_order_item_id uuid, p_participant_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item record;
begin
  select i.id, i.restaurant_id, i.participant_id, i.shared, i.voided_at, o.tab_id, t.status as tab_status into v_item
  from public.order_items i join public.orders o on o.id = i.order_id join public.tabs t on t.id = o.tab_id
  where i.id = p_order_item_id;
  if not found or not public.has_role(v_item.restaurant_id, array['owner', 'manager', 'server']::public.member_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  perform 1 from public.tabs where id = v_item.tab_id for update;
  if v_item.voided_at is not null or v_item.tab_status = 'closed' then
    raise exception 'line cannot move' using errcode = '22023';
  end if;
  if p_participant_id is not null and not exists (
    select 1 from public.tab_participants where id = p_participant_id and tab_id = v_item.tab_id
  ) then
    raise exception 'participants must be at this table' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.payment_allocations a join public.payments p on p.id = a.payment_id
    where a.order_item_id = p_order_item_id and p.status <> 'failed'
  ) or exists (select 1 from public.write_off_allocations w where w.order_item_id = p_order_item_id)
    or exists (
      select 1 from public.split_plan_units u join public.split_plans sp on sp.id = u.plan_id
      where u.order_item_id = p_order_item_id and sp.status = 'active'
    ) then
    raise exception 'line has payments' using errcode = '22023';
  end if;

  delete from public.order_item_shares where order_item_id = p_order_item_id;
  update public.order_items set participant_id = p_participant_id, shared = false where id = p_order_item_id;
  insert into public.audit_log (restaurant_id, actor_id, action, target_table, target_id, before, after)
  values (v_item.restaurant_id, (select auth.uid()), 'move_line', 'order_items', p_order_item_id,
    jsonb_build_object('participant_id', v_item.participant_id, 'shared', v_item.shared),
    jsonb_build_object('participant_id', p_participant_id, 'shared', false));
end;
$$;

-- Voids: a line held by a pending payment can't be voided (the old path checks too).
create or replace function public.void_order(p_order_id uuid, p_reason text, p_order_item_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_actor uuid := (select auth.uid());
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or not public.has_role(v_order.restaurant_id, array['owner', 'manager']::public.member_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_reason is null or length(btrim(p_reason)) = 0 then
    raise exception 'a reason is required' using errcode = '22023';
  end if;
  -- A line a pending payment is holding waits until that payment is confirmed or cancelled.
  if exists (
    select 1 from public.payment_allocations a join public.payments p on p.id = a.payment_id
    join public.order_items i on i.id = a.order_item_id
    where p.status = 'pending' and i.order_id = p_order_id and i.voided_at is null
      and (p_order_item_id is null or i.id = p_order_item_id)
  ) then
    raise exception 'held by a pending payment' using errcode = '22023';
  end if;

  if p_order_item_id is null then
    update public.order_items
    set status = 'void', voided_at = now(), voided_by = v_actor, void_reason = p_reason
    where order_id = p_order_id and voided_at is null;
    update public.orders set status = 'void' where id = p_order_id;
  else
    update public.order_items
    set status = 'void', voided_at = now(), voided_by = v_actor, void_reason = p_reason
    where id = p_order_item_id and order_id = p_order_id and voided_at is null;
    if not found then
      raise exception 'line not found or already void' using errcode = 'P0002';
    end if;
    if not exists (select 1 from public.order_items where order_id = p_order_id and voided_at is null) then
      update public.orders set status = 'void' where id = p_order_id;
    end if;
  end if;

  insert into public.audit_log (restaurant_id, actor_id, action, target_table, target_id, before, after)
  values (
    v_order.restaurant_id, v_actor, 'void',
    case when p_order_item_id is null then 'orders' else 'order_items' end,
    coalesce(p_order_item_id, p_order_id),
    jsonb_build_object('status', v_order.status),
    jsonb_build_object('status', 'void', 'reason', p_reason)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- void_line: void a line (or the whole order) and refund each payer for what their payment covered
-- of it, plus that part's share of the payment's IVU (record_refund, so it is audited and capped at
-- what was paid). Managers and owners. Returns the refunds, so staff know whom to pay back.
-- ---------------------------------------------------------------------------
create function public.void_line(p_order_id uuid, p_reason text, p_order_item_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_restaurant uuid;
  v_pay record;
  v_refund integer;
  v_refunds jsonb := '[]'::jsonb;
  v_lines uuid[];
begin
  select o.restaurant_id into v_restaurant from public.orders o where o.id = p_order_id;
  if not found or not public.has_role(v_restaurant, array['owner', 'manager']::public.member_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select array_agg(i.id) into v_lines from public.order_items i
  where i.order_id = p_order_id and i.voided_at is null and (p_order_item_id is null or i.id = p_order_item_id);

  perform public.void_order(p_order_id, p_reason, p_order_item_id);

  for v_pay in
    select p.id, p.participant_id, p.amount_cents, p.ivu_state_cents + p.ivu_municipal_cents as ivu,
      p.amount_cents + p.ivu_state_cents + p.ivu_municipal_cents + p.tip_cents
        - coalesce((select sum(f.amount_cents) from public.refunds f where f.payment_id = p.id), 0) as refundable,
      sum(a.cents) as covered
    from public.payment_allocations a join public.payments p on p.id = a.payment_id
    where a.order_item_id = any (coalesce(v_lines, '{}')) and p.status in ('paid', 'partially_refunded')
    group by p.id
  loop
    v_refund := least(v_pay.refundable, v_pay.covered + (v_pay.ivu * v_pay.covered / greatest(v_pay.amount_cents, 1))::integer);
    if v_refund > 0 then
      perform public.record_refund(v_pay.id, v_refund, p_reason);
      v_refunds := v_refunds || jsonb_build_object('payment_id', v_pay.id, 'participant_id', v_pay.participant_id, 'amount_cents', v_refund);
    end if;
  end loop;
  return jsonb_build_object('refunds', v_refunds);
end;
$$;

-- ---------------------------------------------------------------------------
-- write_off: a manager covers what nobody will pay: one person's charges, the table's lines (no
-- person, outside the even split), or the whole remaining balance. Pending payments keep what they
-- hold. Reason required; audited.
-- ---------------------------------------------------------------------------
create function public.write_off(p_tab_id uuid, p_scope text, p_reason text, p_participant_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tab public.tabs%rowtype;
  v_id uuid;
  v_cents bigint;
  v_units jsonb;
begin
  select * into v_tab from public.tabs where id = p_tab_id for update;
  if not found or not public.has_role(v_tab.restaurant_id, array['owner', 'manager']::public.member_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if v_tab.status = 'closed' then
    raise exception 'tab is closed' using errcode = '22023';
  end if;
  if p_reason is null or length(btrim(p_reason)) not between 3 and 300 then
    raise exception 'a reason is required' using errcode = '22023';
  end if;
  if p_scope not in ('person', 'table', 'balance') or (p_scope = 'person') <> (p_participant_id is not null) then
    raise exception 'invalid scope' using errcode = '22023';
  end if;

  -- The charges it covers (a list, not a scratch table: the Data API refuses DELETE without WHERE).
  select coalesce(jsonb_agg(jsonb_build_object('item', c.c_item, 'share', c.c_share, 'cents', c.c_cents - c.c_covered)), '[]'::jsonb),
    coalesce(sum(c.c_cents - c.c_covered), 0)
  into v_units, v_cents
  from public.tab_charges(p_tab_id) c
  where c.c_cents > c.c_covered
    and (p_scope = 'balance'
      or (p_scope = 'person' and c.c_owner = p_participant_id and c.c_plan is null)
      or (p_scope = 'table' and c.c_owner is null and c.c_plan is null));
  if v_cents = 0 then
    raise exception 'nothing to write off' using errcode = '22023';
  end if;

  insert into public.write_offs (restaurant_id, tab_id, participant_id, scope, cents, reason, created_by)
  values (v_tab.restaurant_id, p_tab_id, p_participant_id, p_scope, v_cents, btrim(p_reason), (select auth.uid()))
  returning id into v_id;
  insert into public.write_off_allocations (restaurant_id, write_off_id, order_item_id, share_id, cents)
  select v_tab.restaurant_id, v_id, (u ->> 'item')::uuid, (u ->> 'share')::uuid, (u ->> 'cents')::integer
  from jsonb_array_elements(v_units) as u;
  insert into public.audit_log (restaurant_id, actor_id, action, target_table, target_id, after)
  values (v_tab.restaurant_id, (select auth.uid()), 'write_off', 'tabs', p_tab_id,
    jsonb_build_object('write_off_id', v_id, 'scope', p_scope, 'participant_id', p_participant_id, 'cents', v_cents, 'reason', btrim(p_reason)));
  return jsonb_build_object('write_off_id', v_id, 'cents', v_cents);
end;
$$;

-- What's left and pending at a tab (for closing).
create function public.tab_settled(p_tab_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select not exists (select 1 from public.tab_charges(p_tab_id) c where c.c_cents > c.c_covered)
    and not exists (select 1 from public.payments p where p.tab_id = p_tab_id and p.status = 'pending')
$$;

-- ---------------------------------------------------------------------------
-- close_tab: "Mesa libre". Only a settled tab (nothing owed, nothing pending). Closing ends the
-- phones' sessions: the next order at the table starts a new tab with new people. The "Cerrado en el
-- POS" reminder (pos_closed_at) is separate and stays until staff tap it. Staff; audited.
-- ---------------------------------------------------------------------------
create function public.close_tab(p_tab_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tab public.tabs%rowtype;
begin
  select * into v_tab from public.tabs where id = p_tab_id for update;
  if not found or not public.has_role(v_tab.restaurant_id, array['owner', 'manager', 'server']::public.member_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if v_tab.status = 'closed' then return; end if;
  if not public.tab_settled(p_tab_id) then
    raise exception 'tab is not settled' using errcode = '22023';
  end if;
  update public.tabs set status = 'closed', closed_at = now() where id = p_tab_id;
  update public.service_requests set status = 'handled', handled_at = now(), handled_by = (select auth.uid())
  where tab_id = p_tab_id and status = 'open';
  insert into public.audit_log (restaurant_id, actor_id, action, target_table, target_id)
  values (v_tab.restaurant_id, (select auth.uid()), 'close_tab', 'tabs', p_tab_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- close_idle_tabs: housekeeping as staff screens and guest pages load. Pending payments nobody
-- finished in 15 minutes are abandoned (what they held is owed again; the phone can pay again and the
-- cash alert goes away), then settled tabs with orders and no activity (orders or payments) for 10
-- minutes close on their own, so a paid table doesn't carry into the next party. Staff may only tidy
-- their own restaurant. Returns how many tabs closed.
-- ---------------------------------------------------------------------------
create function public.close_idle_tabs(p_restaurant_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tab record;
  v_closed integer := 0;
begin
  if (select auth.uid()) is not null
     and not public.has_role(p_restaurant_id, array['owner', 'manager', 'server', 'kitchen']::public.member_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.payments set status = 'failed'
  where restaurant_id = p_restaurant_id and status = 'pending' and created_at < now() - interval '15 minutes';
  for v_tab in
    select t.id from public.tabs t
    where t.restaurant_id = p_restaurant_id and t.status <> 'closed'
      and exists (select 1 from public.orders o where o.tab_id = t.id and o.status <> 'void')
      and greatest(
        (select max(o.created_at) from public.orders o where o.tab_id = t.id),
        coalesce((select max(coalesce(p.paid_at, p.created_at)) from public.payments p where p.tab_id = t.id and p.status <> 'failed'), '-infinity')
      ) < now() - interval '10 minutes'
    for update skip locked
  loop
    if public.tab_settled(v_tab.id) then
      update public.tabs set status = 'closed', closed_at = now() where id = v_tab.id;
      update public.service_requests set status = 'handled', handled_at = now()
      where tab_id = v_tab.id and status = 'open';
      v_closed := v_closed + 1;
    end if;
  end loop;
  return v_closed;
end;
$$;

-- ---------------------------------------------------------------------------
-- period_adjustments: voids and write-offs in a date range (restaurant time), next to sales, tips and
-- refunds in reports. Owners and managers.
-- ---------------------------------------------------------------------------
create function public.period_adjustments(p_restaurant_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_start timestamptz;
  v_end timestamptz;
begin
  if not public.has_role(p_restaurant_id, array['owner', 'manager']::public.member_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then
    raise exception 'invalid range' using errcode = '22023';
  end if;
  select r.timezone into v_tz from public.restaurants r where r.id = p_restaurant_id;
  v_start := p_from::timestamp at time zone v_tz;
  v_end := (p_to + 1)::timestamp at time zone v_tz;
  return jsonb_build_object(
    'voidsCents', coalesce((select sum(i.qty * i.unit_price_cents) from public.order_items i
      where i.restaurant_id = p_restaurant_id and i.voided_at >= v_start and i.voided_at < v_end), 0),
    'voidsCount', (select count(*) from public.order_items i
      where i.restaurant_id = p_restaurant_id and i.voided_at >= v_start and i.voided_at < v_end),
    'writeOffsCents', coalesce((select sum(w.cents) from public.write_offs w
      where w.restaurant_id = p_restaurant_id and w.created_at >= v_start and w.created_at < v_end), 0),
    'writeOffsCount', (select count(*) from public.write_offs w
      where w.restaurant_id = p_restaurant_id and w.created_at >= v_start and w.created_at < v_end)
  );
end;
$$;

revoke all on function public.move_order_item(uuid, uuid), public.void_line(uuid, text, uuid),
  public.write_off(uuid, text, text, uuid), public.close_tab(uuid), public.close_idle_tabs(uuid),
  public.period_adjustments(uuid, date, date) from public, anon;
grant execute on function public.move_order_item(uuid, uuid), public.void_line(uuid, text, uuid),
  public.write_off(uuid, text, text, uuid), public.close_tab(uuid), public.close_idle_tabs(uuid),
  public.period_adjustments(uuid, date, date) to authenticated, service_role;
revoke all on function public.tab_settled(uuid) from public, anon;
grant execute on function public.tab_settled(uuid) to authenticated, service_role;
