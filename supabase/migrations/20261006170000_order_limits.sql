-- Pass 2, phase 2: limits on QR orders, a shared rate limiter, and Servicio flags.
-- Limits are restaurant settings (editable in Ajustes) and apply to QR orders only; staff orders are
-- never capped, and staff can raise one table's cap ("Ampliar límite").

alter type public.audit_action add value 'limit_change';

alter table public.restaurants
  add column qr_max_order_cents integer not null default 30000 check (qr_max_order_cents between 500 and 1000000),
  add column qr_max_line_qty integer not null default 20 check (qr_max_line_qty between 1 and 99),
  add column qr_max_tab_cents integer not null default 150000 check (qr_max_tab_cents between 500 and 5000000),
  add column max_people_per_table integer not null default 20 check (max_people_per_table between 2 and 40);

-- "Ampliar límite": extra cents staff added to one tab's QR cap.
alter table public.tabs add column qr_limit_extra_cents integer not null default 0 check (qr_limit_extra_cents between 0 and 50000000);

-- Servicio flags: a QR order that opened an idle table ("Mesa nueva por QR"), and an order from
-- someone who already paid ("pagó y pidió de nuevo").
alter table public.orders
  add column opened_tab boolean not null default false,
  add column after_payment boolean not null default false;

-- ---------------------------------------------------------------------------
-- Shared rate limiter (RateLimiter connector, MEZZA_RATE_LIMIT=postgres): fixed windows per key,
-- shared by every app instance. Returns whether this hit is within p_max for the window.
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  key text primary key check (length(key) <= 200),
  window_start timestamptz not null,
  hits integer not null
);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

create function public.rate_limit_hit(p_key text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hits integer;
begin
  if p_key is null or length(p_key) > 200 or p_max < 1 or p_window_seconds not between 1 and 86400 then
    raise exception 'invalid rate limit' using errcode = '22023';
  end if;
  insert into public.rate_limits as l (key, window_start, hits) values (p_key, now(), 1)
  on conflict (key) do update set
    hits = case when l.window_start <= now() - make_interval(secs => p_window_seconds) then 1 else l.hits + 1 end,
    window_start = case when l.window_start <= now() - make_interval(secs => p_window_seconds) then now() else l.window_start end
  returning hits into v_hits;
  -- Bounded cleanup of windows nobody has touched for a day.
  delete from public.rate_limits where key in (
    select key from public.rate_limits where window_start < now() - interval '1 day' limit 50 for update skip locked
  );
  return v_hits <= p_max;
end;
$$;
revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- raise_tab_limit: "Ampliar límite" on a table. Each tap adds one more restaurant tab cap to this
-- tab only. Servers, managers and owners; audited. Returns the tab's new cap in cents.
-- ---------------------------------------------------------------------------
create function public.raise_tab_limit(p_tab_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tab public.tabs%rowtype;
  v_cap integer;
begin
  select * into v_tab from public.tabs where id = p_tab_id for update;
  if not found or not public.has_role(v_tab.restaurant_id, array['owner', 'manager', 'server']::public.member_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if v_tab.status = 'closed' then
    raise exception 'tab is closed' using errcode = '22023';
  end if;
  select r.qr_max_tab_cents into v_cap from public.restaurants r where r.id = v_tab.restaurant_id;
  update public.tabs set qr_limit_extra_cents = qr_limit_extra_cents + v_cap where id = p_tab_id;
  insert into public.audit_log (restaurant_id, actor_id, action, target_table, target_id, before, after)
  values (v_tab.restaurant_id, (select auth.uid()), 'limit_change', 'tabs', p_tab_id,
    jsonb_build_object('cap_cents', v_cap + v_tab.qr_limit_extra_cents),
    jsonb_build_object('cap_cents', v_cap * 2 + v_tab.qr_limit_extra_cents));
  return v_cap * 2 + v_tab.qr_limit_extra_cents;
end;
$$;
revoke all on function public.raise_tab_limit(uuid) from public, anon;
grant execute on function public.raise_tab_limit(uuid) to authenticated, service_role;

create or replace function public.place_order(
  p_restaurant_id uuid,
  p_table_id uuid,
  p_client_order_id text,
  p_source public.order_source,
  p_lines jsonb,
  p_guest_language public.app_locale default 'es',
  p_created_by uuid default null,
  p_device_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing record;
  v_tab_id uuid;
  v_tab_status public.tab_status;
  v_number integer;
  v_order_id uuid;
  v_line jsonb;
  v_item public.menu_items%rowtype;
  v_item_id uuid;
  v_qty integer;
  v_note text;
  v_opts uuid[];
  v_group record;
  v_count integer;
  v_mod_total integer;
  v_snap jsonb;
  v_rows jsonb := '[]'::jsonb;
  v_limits record;
  v_order_cents bigint;
  v_tab_cents bigint;
  v_opened boolean := false;
begin
  if p_client_order_id is null or length(p_client_order_id) not between 8 and 100 then
    return jsonb_build_object('status', 'rejected', 'reason', 'validation', 'detail', 'client_order_id');
  end if;

  -- A repeated key returns the order it already created.
  select o.id, o.number into v_existing
  from public.orders o
  where o.restaurant_id = p_restaurant_id and o.idempotency_key = p_client_order_id;
  if found then
    return jsonb_build_object('status', 'accepted', 'order_id', v_existing.id, 'number', v_existing.number, 'replayed', true);
  end if;

  -- Lock the restaurant row: serializes order numbers, tab opening and concurrent retries of one key.
  perform 1 from public.restaurants r where r.id = p_restaurant_id for update;
  if not found then
    return jsonb_build_object('status', 'rejected', 'reason', 'invalid_table', 'detail', 'restaurant');
  end if;

  select o.id, o.number into v_existing
  from public.orders o
  where o.restaurant_id = p_restaurant_id and o.idempotency_key = p_client_order_id;
  if found then
    return jsonb_build_object('status', 'accepted', 'order_id', v_existing.id, 'number', v_existing.number, 'replayed', true);
  end if;

  if not exists (select 1 from public.dining_tables t where t.id = p_table_id and t.restaurant_id = p_restaurant_id) then
    return jsonb_build_object('status', 'rejected', 'reason', 'invalid_table');
  end if;

  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 1 and 50 then
    return jsonb_build_object('status', 'rejected', 'reason', 'validation', 'detail', 'lines');
  end if;

  for v_line in select value from jsonb_array_elements(p_lines) loop
    begin
      v_item_id := (v_line ->> 'itemId')::uuid;
      v_opts := array(
        select (o.value)::uuid
        from jsonb_array_elements_text(coalesce(v_line -> 'modifierOptionIds', '[]'::jsonb)) as o(value)
      );
    exception when others then
      return jsonb_build_object('status', 'rejected', 'reason', 'validation', 'detail', 'line');
    end;

    if jsonb_typeof(v_line -> 'qty') is distinct from 'number'
       or (v_line ->> 'qty')::numeric <> trunc((v_line ->> 'qty')::numeric)
       or (v_line ->> 'qty')::numeric not between 1 and 99 then
      return jsonb_build_object('status', 'rejected', 'reason', 'validation', 'detail', 'qty');
    end if;
    v_qty := (v_line ->> 'qty')::integer;

    v_note := nullif(btrim(v_line ->> 'note'), '');
    if length(v_note) > 200 then
      return jsonb_build_object('status', 'rejected', 'reason', 'validation', 'detail', 'note');
    end if;

    select * into v_item
    from public.menu_items i
    where i.id = v_item_id and i.restaurant_id = p_restaurant_id and i.archived_at is null;
    if not found then
      return jsonb_build_object('status', 'rejected', 'reason', 'validation', 'detail', 'unknown_item');
    end if;
    if not v_item.is_available then
      return jsonb_build_object('status', 'rejected', 'reason', 'item_unavailable', 'detail', v_item.id);
    end if;

    if cardinality(v_opts) <> (select count(distinct x) from unnest(v_opts) as x) then
      return jsonb_build_object('status', 'rejected', 'reason', 'validation', 'detail', 'modifier_duplicate');
    end if;

    -- Every chosen option must belong to a group assigned to this dish.
    if exists (
      select 1
      from unnest(v_opts) as chosen(id)
      where not exists (
        select 1
        from public.modifier_options mo
        join public.item_modifier_groups img on img.group_id = mo.group_id and img.item_id = v_item.id
        where mo.id = chosen.id
      )
    ) then
      return jsonb_build_object('status', 'rejected', 'reason', 'validation', 'detail', 'modifier');
    end if;

    -- Enforce min/max per group.
    for v_group in
      select g.id, g.min_select, g.max_select
      from public.item_modifier_groups img
      join public.modifier_groups g on g.id = img.group_id
      where img.item_id = v_item.id
    loop
      select count(*) into v_count
      from public.modifier_options mo
      where mo.group_id = v_group.id and mo.id = any (v_opts);
      if v_count < v_group.min_select or v_count > v_group.max_select then
        return jsonb_build_object('status', 'rejected', 'reason', 'validation', 'detail', 'modifier_count');
      end if;
    end loop;

    select
      coalesce(sum(mo.price_cents), 0)::integer,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'group_id', g.id, 'group_es', g.name_es, 'group_en', g.name_en,
            'option_id', mo.id, 'name_es', mo.name_es, 'name_en', mo.name_en, 'price_cents', mo.price_cents
          )
          order by img.sort_order, mo.sort_order
        ),
        '[]'::jsonb
      )
    into v_mod_total, v_snap
    from public.modifier_options mo
    join public.modifier_groups g on g.id = mo.group_id
    join public.item_modifier_groups img on img.group_id = g.id and img.item_id = v_item.id
    where mo.id = any (v_opts);

    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'item_id', v_item.id,
      'name_es', v_item.name_es,
      'name_en', v_item.name_en,
      'unit', v_item.price_cents + v_mod_total,
      'qty', v_qty,
      'mods', v_snap,
      'note', v_note,
      'shared', coalesce((v_line ->> 'shared')::boolean, false)
    ));
  end loop;

  select t.id, t.status into v_tab_id, v_tab_status
  from public.tabs t
  where t.table_id = p_table_id and t.status <> 'closed'
  for update;
  if found and v_tab_status = 'paying' then
    return jsonb_build_object('status', 'rejected', 'reason', 'tab_closed');
  end if;

  -- QR orders stay within the restaurant's limits (staff orders never do): per line, per order and
  -- per open tab (plus whatever staff added with "Ampliar límite").
  if p_source = 'qr' then
    select r.qr_max_order_cents, r.qr_max_line_qty, r.qr_max_tab_cents into v_limits
    from public.restaurants r where r.id = p_restaurant_id;
    if exists (select 1 from jsonb_array_elements(v_rows) as r where (r ->> 'qty')::integer > v_limits.qr_max_line_qty) then
      return jsonb_build_object('status', 'rejected', 'reason', 'limit', 'detail', 'line', 'max', v_limits.qr_max_line_qty);
    end if;
    select coalesce(sum((r ->> 'unit')::bigint * (r ->> 'qty')::integer), 0) into v_order_cents
    from jsonb_array_elements(v_rows) as r;
    if v_order_cents > v_limits.qr_max_order_cents then
      return jsonb_build_object('status', 'rejected', 'reason', 'limit', 'detail', 'order', 'max', v_limits.qr_max_order_cents);
    end if;
    select coalesce(sum(i.qty::bigint * i.unit_price_cents), 0) into v_tab_cents
    from public.order_items i join public.orders o on o.id = i.order_id
    where o.tab_id = v_tab_id and o.status <> 'void' and i.voided_at is null;
    if v_tab_cents + v_order_cents > v_limits.qr_max_tab_cents
       + coalesce((select t.qr_limit_extra_cents from public.tabs t where t.id = v_tab_id), 0) then
      return jsonb_build_object('status', 'rejected', 'reason', 'limit', 'detail', 'tab', 'max', v_limits.qr_max_tab_cents);
    end if;
  end if;

  if v_tab_id is null then
    insert into public.tabs (restaurant_id, table_id) values (p_restaurant_id, p_table_id) returning id into v_tab_id;
    v_opened := true;
  end if;

  update public.restaurants r
  set next_order_number = r.next_order_number + 1
  where r.id = p_restaurant_id
  returning r.next_order_number - 1 into v_number;

  insert into public.orders (restaurant_id, tab_id, number, source, idempotency_key, guest_language, created_by, device_id, opened_tab)
  values (p_restaurant_id, v_tab_id, v_number, p_source, p_client_order_id, p_guest_language, p_created_by, p_device_id, v_opened and p_source = 'qr')
  returning id into v_order_id;

  insert into public.order_items (
    restaurant_id, order_id, item_id, name_snapshot_es, name_snapshot_en, unit_price_cents, qty,
    modifiers_snapshot, note, shared
  )
  select
    p_restaurant_id, v_order_id, (r ->> 'item_id')::uuid, r ->> 'name_es', r ->> 'name_en', (r ->> 'unit')::integer,
    (r ->> 'qty')::integer, r -> 'mods', r ->> 'note', (r ->> 'shared')::boolean
  from jsonb_array_elements(v_rows) as r;

  return jsonb_build_object('status', 'accepted', 'order_id', v_order_id, 'number', v_number, 'replayed', false);
end;
$$;

create or replace function public.place_guest_order(
  p_restaurant_id uuid,
  p_table_id uuid,
  p_client_order_id text,
  p_lines jsonb,
  p_guest_language public.app_locale,
  p_device_hash text,
  p_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_order record;
  v_pid uuid;
  v_number integer;
  v_line record;
  v_people uuid[];
begin
  if p_device_hash is null or length(p_device_hash) <> 64 then
    return jsonb_build_object('status', 'rejected', 'reason', 'validation', 'detail', 'device');
  end if;

  -- Same lock place_order takes first, so the tab and the participant can't race another order.
  perform 1 from public.restaurants r where r.id = p_restaurant_id for update;

  -- A full table (restaurants.max_people_per_table) refuses a new phone before anything is created.
  select p.id into v_pid
  from public.tabs t join public.tab_participants p on p.tab_id = t.id
  where t.table_id = p_table_id and t.status <> 'closed' and p.device_hash = p_device_hash;
  if v_pid is null and (
    select count(*) from public.tabs t join public.tab_participants p on p.tab_id = t.id
    where t.table_id = p_table_id and t.status <> 'closed'
  ) >= (select r.max_people_per_table from public.restaurants r where r.id = p_restaurant_id) and not exists (
    select 1 from public.orders o where o.restaurant_id = p_restaurant_id and o.idempotency_key = p_client_order_id
  ) then
    return jsonb_build_object('status', 'rejected', 'reason', 'validation', 'detail', 'table_full');
  end if;

  v_result := public.place_order(p_restaurant_id, p_table_id, p_client_order_id, 'qr', p_lines, p_guest_language);
  if v_result ->> 'status' <> 'accepted' then
    return v_result;
  end if;

  select o.id, o.tab_id, o.participant_id into v_order from public.orders o where o.id = (v_result ->> 'order_id')::uuid;
  if (v_result ->> 'replayed')::boolean then
    return v_result || jsonb_build_object('participant_id', v_order.participant_id);
  end if;

  select p.id into v_pid from public.tab_participants p where p.tab_id = v_order.tab_id and p.device_hash = p_device_hash;
  if v_pid is null then
    select coalesce(max(p.guest_number), 0) + 1 into v_number from public.tab_participants p where p.tab_id = v_order.tab_id;
    insert into public.tab_participants (restaurant_id, tab_id, display_name, guest_number, device_hash)
    values (
      p_restaurant_id, v_order.tab_id,
      case when p_name is not null and not exists (
        select 1 from public.tab_participants p where p.tab_id = v_order.tab_id and lower(p.display_name) = lower(p_name)
      ) then p_name end,
      v_number, p_device_hash
    )
    returning id into v_pid;
  end if;

  -- "Pagó y pidió de nuevo": this person already has a payment on the tab.
  update public.orders set participant_id = v_pid, after_payment = exists (
    select 1 from public.payments p
    where p.tab_id = v_order.tab_id and p.participant_id = v_pid and p.status in ('paid', 'partially_refunded')
  ) where id = v_order.id;
  update public.order_items set participant_id = v_pid where order_id = v_order.id;

  -- Everyone at the table who has ordered, this phone included.
  select array_agg(distinct o.participant_id) into v_people
  from public.orders o where o.tab_id = v_order.tab_id and o.participant_id is not null;
  for v_line in select i.id from public.order_items i where i.order_id = v_order.id and i.shared loop
    perform public.split_item_shares(v_line.id, v_people);
  end loop;

  return v_result || jsonb_build_object('participant_id', v_pid);
end;
$$;
