-- Pass 2, phase 3: the split engine. Every amount a guest or server pays is computed here, under
-- the tab's row lock, from what is owed and what is already covered; the browser only says which
-- option (mine, another person, the balance, or shares of the table's even split).
--
-- Charges at a table (tab_charges): each person's own lines, each locked share of a shared dish, and
-- the table's lines (staff orders for the whole table, shared dishes nobody has a share of). A charge
-- is covered by payment_allocations of payments that haven't failed; a pending payment holds what it
-- covers until it is paid or fails (abandoned after 15 minutes).

-- IVU on cents, half-up to the cent, like applyBps in src/lib/money.
create function public.ivu_cents(p_cents bigint, p_bps integer)
returns integer
language sql
immutable
set search_path = ''
as $$ select ((p_cents * p_bps + 5000) / 10000)::integer $$;

-- ---------------------------------------------------------------------------
-- Even split: one plan per table. Its charges are fixed when it starts; each share is computed from
-- what is left when it is paid (an even split of the remaining amount over the remaining shares), so
-- later orders stay outside the plan and voids shrink the remaining shares evenly.
-- ---------------------------------------------------------------------------
create table public.split_plans (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  tab_id uuid not null,
  parts integer not null check (parts between 2 and 20),
  status text not null default 'active' check (status in ('active', 'cancelled', 'done')),
  created_by_participant uuid,
  created_by_user uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, id),
  foreign key (restaurant_id, tab_id) references public.tabs (restaurant_id, id) on delete cascade,
  foreign key (restaurant_id, created_by_participant) references public.tab_participants (restaurant_id, id) on delete set null (created_by_participant)
);
create unique index split_plans_one_active on public.split_plans (tab_id) where status = 'active';

create table public.split_plan_units (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  plan_id uuid not null references public.split_plans (id) on delete cascade,
  order_item_id uuid not null references public.order_items (id) on delete cascade,
  share_id uuid references public.order_item_shares (id) on delete cascade
);
create unique index split_plan_units_unit on public.split_plan_units
  (plan_id, order_item_id, coalesce(share_id, '00000000-0000-0000-0000-000000000000'));
create index split_plan_units_item on public.split_plan_units (order_item_id);

alter table public.payments
  add column split_option text check (split_option in ('mine', 'person', 'balance', 'plan')),
  add column for_participant_id uuid,
  add column plan_id uuid,
  add column plan_parts integer check (plan_parts between 1 and 20),
  add foreign key (restaurant_id, for_participant_id) references public.tab_participants (restaurant_id, id) on delete set null (for_participant_id),
  add foreign key (restaurant_id, plan_id) references public.split_plans (restaurant_id, id) on delete set null (plan_id);

-- What each payment covered. Shares can't be deleted from under a payment (restrict).
create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  payment_id uuid not null references public.payments (id) on delete cascade,
  order_item_id uuid not null references public.order_items (id) on delete restrict,
  share_id uuid references public.order_item_shares (id) on delete restrict,
  cents integer not null check (cents > 0),
  created_at timestamptz not null default now()
);
create unique index payment_allocations_unit on public.payment_allocations
  (payment_id, order_item_id, coalesce(share_id, '00000000-0000-0000-0000-000000000000'));
create index payment_allocations_item on public.payment_allocations (order_item_id);

do $$
declare t text;
begin
  foreach t in array array['split_plans', 'split_plan_units', 'payment_allocations'] loop
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

-- ---------------------------------------------------------------------------
-- tab_charges: what is owed at a tab, charge by charge, with what is covered and the active plan.
-- Security invoker: staff read it under RLS; server code reads it as the service role.
-- ---------------------------------------------------------------------------
create function public.tab_charges(p_tab_id uuid)
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
    ), 0)::integer,
    (
      select pu.plan_id from public.split_plan_units pu join public.split_plans sp on sp.id = pu.plan_id
      where sp.status = 'active' and pu.order_item_id = u.item and pu.share_id is not distinct from u.share
    ),
    u.created_at
  from units u
$$;

-- What's left of the active plan: its remaining amount and remaining shares.
create function public.split_plan_left(p_plan_id uuid, out amount_left bigint, out parts_left integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce((select sum(c.c_cents - c.c_covered) from public.tab_charges(sp.tab_id) c where c.c_plan = sp.id), 0),
    sp.parts - coalesce((
      select sum(p.plan_parts) from public.payments p where p.plan_id = sp.id and p.status <> 'failed'
    ), 0)::integer
  from public.split_plans sp where sp.id = p_plan_id
$$;

-- Ends an active plan that has nothing left to pay. Returns the plan that is still active, if any.
create function public.active_split_plan(p_tab_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan uuid;
  v_left record;
begin
  select id into v_plan from public.split_plans where tab_id = p_tab_id and status = 'active';
  if v_plan is null then return null; end if;
  select * into v_left from public.split_plan_left(v_plan);
  if v_left.amount_left > 0 and v_left.parts_left > 0 then return v_plan; end if;
  update public.split_plans set status = 'done', updated_at = now() where id = v_plan;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- start_split_plan: "Dividir en partes iguales". The first person (or staff) sets the number of
-- shares over everything unpaid now. Asking again with the same number returns the same plan.
-- ---------------------------------------------------------------------------
create function public.start_split_plan(
  p_tab_id uuid,
  p_parts integer,
  p_by_participant uuid default null,
  p_by_user uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tab public.tabs%rowtype;
  v_plan uuid;
  v_existing public.split_plans%rowtype;
begin
  select * into v_tab from public.tabs where id = p_tab_id for update;
  if not found or v_tab.status = 'closed' then
    return jsonb_build_object('status', 'rejected', 'reason', 'tab_closed');
  end if;
  if p_parts is null or p_parts not between 2 and 20 then
    return jsonb_build_object('status', 'rejected', 'reason', 'validation', 'detail', 'parts');
  end if;
  if p_by_participant is not null and not exists (
    select 1 from public.tab_participants where id = p_by_participant and tab_id = p_tab_id
  ) then
    return jsonb_build_object('status', 'rejected', 'reason', 'validation', 'detail', 'participant');
  end if;

  v_plan := public.active_split_plan(p_tab_id);
  if v_plan is not null then
    select * into v_existing from public.split_plans where id = v_plan;
    if v_existing.parts = p_parts then
      return jsonb_build_object('status', 'accepted', 'plan_id', v_plan, 'parts', p_parts, 'existing', true);
    end if;
    return jsonb_build_object('status', 'rejected', 'reason', 'plan_exists', 'plan_id', v_plan, 'parts', v_existing.parts);
  end if;

  if not exists (select 1 from public.tab_charges(p_tab_id) c where c.c_cents > c.c_covered) then
    return jsonb_build_object('status', 'rejected', 'reason', 'nothing_to_pay');
  end if;
  insert into public.split_plans (restaurant_id, tab_id, parts, created_by_participant, created_by_user)
  values (v_tab.restaurant_id, p_tab_id, p_parts, p_by_participant, p_by_user)
  returning id into v_plan;
  insert into public.split_plan_units (restaurant_id, plan_id, order_item_id, share_id)
  select v_tab.restaurant_id, v_plan, c.c_item, c.c_share
  from public.tab_charges(p_tab_id) c where c.c_cents > c.c_covered;
  return jsonb_build_object('status', 'accepted', 'plan_id', v_plan, 'parts', p_parts, 'existing', false);
end;
$$;

-- cancel_split_plan: only before any share is paid or pending.
create function public.cancel_split_plan(p_tab_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan uuid;
begin
  perform 1 from public.tabs where id = p_tab_id for update;
  v_plan := public.active_split_plan(p_tab_id);
  if v_plan is null then
    return jsonb_build_object('status', 'rejected', 'reason', 'no_plan');
  end if;
  if exists (select 1 from public.payments where plan_id = v_plan and status <> 'failed') then
    return jsonb_build_object('status', 'rejected', 'reason', 'plan_started');
  end if;
  update public.split_plans set status = 'cancelled', updated_at = now() where id = v_plan;
  return jsonb_build_object('status', 'accepted', 'plan_id', v_plan);
end;
$$;

-- ---------------------------------------------------------------------------
-- create_tab_payment: the one place a payable amount is computed. Inserts a pending payment and what
-- it covers, or returns the existing payment for a repeated idempotency key.
--   p_option  'mine' (p_payer's own charges and shares), 'person' (p_for's), 'balance' (everything
--             unpaid, including what's left of an even-split plan), 'plan' (p_parts shares of it)
--   p_payer   the paying participant, or null (staff, or a phone that isn't at the table)
--   tip       p_tip_percent (whole percent of the subtotal) or p_tip_cents, never both
-- IVU per payment = IVU(everything paid including it) − IVU(everything paid before), per component,
-- so it is never negative; the payment that clears the tab absorbs any drift left by failed payments.
-- ---------------------------------------------------------------------------
create function public.create_tab_payment(
  p_tab_id uuid,
  p_option text,
  p_method public.payment_method,
  p_idempotency_key text,
  p_payer uuid default null,
  p_for uuid default null,
  p_parts integer default 1,
  p_tip_percent integer default null,
  p_tip_cents integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tab public.tabs%rowtype;
  v_existing public.payments%rowtype;
  v_rates record;
  v_plan uuid;
  v_left record;
  v_for uuid;
  v_charge record;
  v_alloc jsonb := '[]'::jsonb;
  v_sub bigint := 0;
  v_take bigint;
  v_need bigint;
  v_parts integer;
  v_before bigint;
  v_prev_s bigint;
  v_prev_m bigint;
  v_after bigint;
  v_s integer;
  v_m integer;
  v_tip integer := 0;
  v_pid uuid;
begin
  if p_idempotency_key is null or length(p_idempotency_key) not between 8 and 100 then
    return jsonb_build_object('status', 'rejected', 'reason', 'validation', 'detail', 'idempotency_key');
  end if;
  select * into v_tab from public.tabs where id = p_tab_id for update;
  if not found then
    return jsonb_build_object('status', 'rejected', 'reason', 'validation', 'detail', 'tab');
  end if;

  -- A repeated key returns the payment it already created.
  select * into v_existing from public.payments
  where restaurant_id = v_tab.restaurant_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.tab_id <> p_tab_id then
      return jsonb_build_object('status', 'rejected', 'reason', 'validation', 'detail', 'idempotency_key');
    end if;
    return jsonb_build_object('status', 'accepted', 'replayed', true, 'payment_id', v_existing.id,
      'subtotal_cents', v_existing.amount_cents, 'ivu_state_cents', v_existing.ivu_state_cents,
      'ivu_municipal_cents', v_existing.ivu_municipal_cents, 'tip_cents', v_existing.tip_cents,
      'total_cents', v_existing.amount_cents + v_existing.ivu_state_cents + v_existing.ivu_municipal_cents + v_existing.tip_cents,
      'payment_status', v_existing.status);
  end if;
  if v_tab.status = 'closed' then
    return jsonb_build_object('status', 'rejected', 'reason', 'tab_closed');
  end if;

  -- Pending payments nobody finished in 15 minutes are abandoned; what they held is free again.
  update public.payments set status = 'failed'
  where tab_id = p_tab_id and status = 'pending' and created_at < now() - interval '15 minutes';

  if p_payer is not null then
    if not exists (select 1 from public.tab_participants where id = p_payer and tab_id = p_tab_id) then
      return jsonb_build_object('status', 'rejected', 'reason', 'validation', 'detail', 'payer');
    end if;
    select * into v_existing from public.payments
    where tab_id = p_tab_id and participant_id = p_payer and status = 'pending' limit 1;
    if found then
      return jsonb_build_object('status', 'rejected', 'reason', 'pending_exists', 'payment_id', v_existing.id);
    end if;
  end if;
  if (p_tip_percent is not null and p_tip_cents is not null)
     or (p_tip_percent is not null and p_tip_percent not between 0 and 100)
     or (p_tip_cents is not null and p_tip_cents not between 0 and 100000) then
    return jsonb_build_object('status', 'rejected', 'reason', 'validation', 'detail', 'tip');
  end if;

  v_plan := public.active_split_plan(p_tab_id);

  if p_option in ('mine', 'person') then
    v_for := case when p_option = 'mine' then p_payer else p_for end;
    if v_for is null or not exists (select 1 from public.tab_participants where id = v_for and tab_id = p_tab_id) then
      return jsonb_build_object('status', 'rejected', 'reason', 'validation', 'detail', 'person');
    end if;
    -- Their own charges and shares, outside the even-split plan.
    for v_charge in
      select * from public.tab_charges(p_tab_id) c
      where c.c_owner = v_for and c.c_plan is null and c.c_cents > c.c_covered
      order by c.c_created, c.c_item, c.c_share
    loop
      v_alloc := v_alloc || jsonb_build_object('item', v_charge.c_item, 'share', v_charge.c_share, 'cents', v_charge.c_cents - v_charge.c_covered);
      v_sub := v_sub + v_charge.c_cents - v_charge.c_covered;
    end loop;

  elsif p_option = 'balance' then
    for v_charge in
      select * from public.tab_charges(p_tab_id) c where c.c_cents > c.c_covered
      order by c.c_created, c.c_item, c.c_share
    loop
      v_alloc := v_alloc || jsonb_build_object('item', v_charge.c_item, 'share', v_charge.c_share, 'cents', v_charge.c_cents - v_charge.c_covered);
      v_sub := v_sub + v_charge.c_cents - v_charge.c_covered;
    end loop;
    -- Paying the balance pays every share left in the plan.
    if v_plan is not null then
      select * into v_left from public.split_plan_left(v_plan);
      v_parts := nullif(greatest(v_left.parts_left, 0), 0);
      if v_parts is null then v_plan := null; end if;
    end if;

  elsif p_option = 'plan' then
    if v_plan is null then
      return jsonb_build_object('status', 'rejected', 'reason', 'no_plan');
    end if;
    select * into v_left from public.split_plan_left(v_plan);
    if p_parts is null or p_parts not between 1 and v_left.parts_left then
      return jsonb_build_object('status', 'rejected', 'reason', 'validation', 'detail', 'parts');
    end if;
    v_parts := p_parts;
    -- The first p_parts of an even split of what's left; the first shares get the leftover cents.
    v_need := (v_left.amount_left / v_left.parts_left) * p_parts + least(p_parts, v_left.amount_left % v_left.parts_left);
    for v_charge in
      select * from public.tab_charges(p_tab_id) c
      where c.c_plan = v_plan and c.c_cents > c.c_covered
      order by c.c_created, c.c_item, c.c_share
    loop
      exit when v_need = 0;
      v_take := least(v_need, v_charge.c_cents - v_charge.c_covered);
      v_alloc := v_alloc || jsonb_build_object('item', v_charge.c_item, 'share', v_charge.c_share, 'cents', v_take);
      v_sub := v_sub + v_take;
      v_need := v_need - v_take;
    end loop;

  else
    return jsonb_build_object('status', 'rejected', 'reason', 'validation', 'detail', 'option');
  end if;

  if v_sub = 0 then
    return jsonb_build_object('status', 'rejected', 'reason', 'nothing_to_pay');
  end if;

  select r.ivu_state_bps as st, r.ivu_municipal_bps as mu into v_rates from public.restaurants r where r.id = v_tab.restaurant_id;
  select coalesce(sum(amount_cents), 0), coalesce(sum(ivu_state_cents), 0), coalesce(sum(ivu_municipal_cents), 0)
  into v_before, v_prev_s, v_prev_m
  from public.payments where tab_id = p_tab_id and status <> 'failed';
  select coalesce(sum(c.c_cents - c.c_covered), 0) - v_sub into v_after from public.tab_charges(p_tab_id) c where c.c_cents > c.c_covered;
  if v_after = 0 then
    v_s := greatest(public.ivu_cents(v_before + v_sub, v_rates.st) - v_prev_s, 0);
    v_m := greatest(public.ivu_cents(v_before + v_sub, v_rates.mu) - v_prev_m, 0);
  else
    v_s := public.ivu_cents(v_before + v_sub, v_rates.st) - public.ivu_cents(v_before, v_rates.st);
    v_m := public.ivu_cents(v_before + v_sub, v_rates.mu) - public.ivu_cents(v_before, v_rates.mu);
  end if;
  if p_tip_cents is not null then
    v_tip := p_tip_cents;
  elsif p_tip_percent is not null then
    v_tip := public.ivu_cents(v_sub, p_tip_percent * 100);
  end if;

  insert into public.payments (
    restaurant_id, tab_id, participant_id, method, amount_cents, tip_cents, ivu_state_cents, ivu_municipal_cents,
    status, idempotency_key, split_option, for_participant_id, plan_id, plan_parts
  ) values (
    v_tab.restaurant_id, p_tab_id, p_payer, p_method, v_sub, v_tip, v_s, v_m,
    'pending', p_idempotency_key, p_option, v_for, case when v_parts is not null then v_plan end, v_parts
  ) returning id into v_pid;
  insert into public.payment_allocations (restaurant_id, payment_id, order_item_id, share_id, cents)
  select v_tab.restaurant_id, v_pid, (a ->> 'item')::uuid, (a ->> 'share')::uuid, (a ->> 'cents')::integer
  from jsonb_array_elements(v_alloc) as a;

  return jsonb_build_object('status', 'accepted', 'replayed', false, 'payment_id', v_pid,
    'subtotal_cents', v_sub, 'ivu_state_cents', v_s, 'ivu_municipal_cents', v_m, 'tip_cents', v_tip,
    'total_cents', v_sub + v_s + v_m + v_tip, 'payment_status', 'pending',
    'plan_id', case when v_parts is not null then v_plan end, 'plan_parts', v_parts);
end;
$$;

revoke all on function public.ivu_cents(bigint, integer) from public, anon;
grant execute on function public.ivu_cents(bigint, integer) to authenticated, service_role;
revoke all on function public.tab_charges(uuid), public.split_plan_left(uuid) from public, anon;
grant execute on function public.tab_charges(uuid), public.split_plan_left(uuid) to authenticated, service_role;
revoke all on function public.active_split_plan(uuid), public.start_split_plan(uuid, integer, uuid, uuid),
  public.cancel_split_plan(uuid),
  public.create_tab_payment(uuid, text, public.payment_method, text, uuid, uuid, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.active_split_plan(uuid), public.start_split_plan(uuid, integer, uuid, uuid),
  public.cancel_split_plan(uuid),
  public.create_tab_payment(uuid, text, public.payment_method, text, uuid, uuid, integer, integer, integer)
  to service_role;

create or replace function public.set_item_shares(p_order_item_id uuid, p_participants uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item record;
begin
  select i.id, i.restaurant_id, i.shared, i.voided_at, o.tab_id, t.status as tab_status into v_item
  from public.order_items i
  join public.orders o on o.id = i.order_id
  join public.tabs t on t.id = o.tab_id
  where i.id = p_order_item_id
  for update of i;
  if not found or not public.has_role(v_item.restaurant_id, array['owner', 'manager', 'server']::public.member_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not v_item.shared or v_item.voided_at is not null or v_item.tab_status <> 'open' then
    raise exception 'line cannot be re-shared' using errcode = '22023';
  end if;
  -- Once money touches the line (a payment that hasn't failed, or an even-split plan), its shares stay.
  if exists (
    select 1 from public.payment_allocations a join public.payments p on p.id = a.payment_id
    where a.order_item_id = p_order_item_id and p.status <> 'failed'
  ) or exists (
    select 1 from public.split_plan_units u join public.split_plans sp on sp.id = u.plan_id
    where u.order_item_id = p_order_item_id and sp.status = 'active'
  ) then
    raise exception 'line has payments' using errcode = '22023';
  end if;
  if coalesce(cardinality(p_participants), 0) = 0 or exists (
    select 1 from unnest(p_participants) as x(id)
    where not exists (select 1 from public.tab_participants p where p.id = x.id and p.tab_id = v_item.tab_id)
  ) then
    raise exception 'participants must be at this table' using errcode = '22023';
  end if;

  perform public.split_item_shares(p_order_item_id, (select array_agg(distinct x) from unnest(p_participants) as x));

  insert into public.audit_log (restaurant_id, actor_id, action, target_table, target_id, after)
  values (v_item.restaurant_id, (select auth.uid()), 'shares', 'order_items', p_order_item_id,
    jsonb_build_object('participants', p_participants));
end;
$$;
