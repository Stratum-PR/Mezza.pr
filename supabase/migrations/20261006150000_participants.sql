-- Pass 2, phase 1: people at a table. A participant is created on a phone's first order and is
-- identified by a hash of that phone's device cookie, scoped to the tab, so a new tab (the next
-- party) always means new participants. Shared dishes are split into locked shares when ordered.

alter type public.audit_action add value 'shares';

alter table public.tab_participants
  add column guest_number integer check (guest_number between 1 and 999),
  add column device_hash text check (length(device_hash) = 64),
  add constraint tab_participants_display_name_length check (length(display_name) between 1 and 24);
create unique index tab_participants_number_idx on public.tab_participants (tab_id, guest_number);
create unique index tab_participants_device_idx on public.tab_participants (tab_id, device_hash);
create unique index tab_participants_name_idx on public.tab_participants (tab_id, lower(display_name));

-- Who placed the order (null: staff for the whole table, or orders from before pass 2).
alter table public.orders add column participant_id uuid,
  add foreign key (restaurant_id, participant_id) references public.tab_participants (restaurant_id, id) on delete set null (participant_id);

-- Locked shares of a shared line: who owes what, in cents. They always sum to qty × unit price.
create table public.order_item_shares (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  order_item_id uuid not null references public.order_items (id) on delete cascade,
  participant_id uuid not null,
  cents integer not null check (cents >= 0),
  created_at timestamptz not null default now(),
  unique (order_item_id, participant_id),
  foreign key (restaurant_id, participant_id) references public.tab_participants (restaurant_id, id) on delete cascade
);
create index order_item_shares_item_idx on public.order_item_shares (order_item_id);
alter table public.order_item_shares enable row level security;
revoke all on public.order_item_shares from anon;
create policy order_item_shares_owner_all on public.order_item_shares for all to authenticated
  using (public.has_role(restaurant_id, '{owner}'::public.member_role[]))
  with check (public.has_role(restaurant_id, '{owner}'::public.member_role[]));
create policy order_item_shares_select_manager_server on public.order_item_shares for select to authenticated
  using (public.has_role(restaurant_id, '{manager,server}'::public.member_role[]));

-- ---------------------------------------------------------------------------
-- split_item_shares: replaces a shared line's shares with an even split among p_participants,
-- in guest-number order; the first ones get the leftover cents.
-- ---------------------------------------------------------------------------
create function public.split_item_shares(p_order_item_id uuid, p_participants uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item record;
  v_total integer;
  v_n integer := coalesce(cardinality(p_participants), 0);
begin
  select i.restaurant_id, i.qty * i.unit_price_cents as total into v_item
  from public.order_items i where i.id = p_order_item_id;
  v_total := v_item.total;
  delete from public.order_item_shares where order_item_id = p_order_item_id;
  if v_n = 0 then
    return;
  end if;
  insert into public.order_item_shares (restaurant_id, order_item_id, participant_id, cents)
  select v_item.restaurant_id, p_order_item_id, p.id,
    v_total / v_n + case when row_number() over (order by p.guest_number, p.id) <= v_total % v_n then 1 else 0 end
  from public.tab_participants p
  where p.id = any (p_participants);
end;
$$;

-- ---------------------------------------------------------------------------
-- place_guest_order: place_order for a phone. Finds or creates the phone's participant on the tab,
-- attributes the order and its lines to it, and splits shared lines among everyone at the table who
-- has ordered so far (including this phone). A replayed order returns its original participant.
-- p_name: already validated by the server; null means "Invitado #n". A taken name falls back to null.
-- ---------------------------------------------------------------------------
create function public.place_guest_order(
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

  -- A full table refuses a new phone before anything is created.
  select p.id into v_pid
  from public.tabs t join public.tab_participants p on p.tab_id = t.id
  where t.table_id = p_table_id and t.status <> 'closed' and p.device_hash = p_device_hash;
  if v_pid is null and (
    select count(*) from public.tabs t join public.tab_participants p on p.tab_id = t.id
    where t.table_id = p_table_id and t.status <> 'closed'
  ) >= 20 and not exists (
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

  update public.orders set participant_id = v_pid where id = v_order.id;
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

-- ---------------------------------------------------------------------------
-- attribute_staff_order: after a staff place_order, puts the order on one person (or the table) and
-- splits its shared lines among everyone at the table who has ordered (or all participants when
-- nobody has yet). Staff only.
-- ---------------------------------------------------------------------------
create function public.attribute_staff_order(p_order_id uuid, p_participant_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_line record;
  v_people uuid[];
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or not public.has_role(v_order.restaurant_id, array['owner', 'manager', 'server']::public.member_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_participant_id is not null and not exists (
    select 1 from public.tab_participants p where p.id = p_participant_id and p.tab_id = v_order.tab_id
  ) then
    raise exception 'participant not at this table' using errcode = '22023';
  end if;

  update public.orders set participant_id = p_participant_id where id = p_order_id;
  update public.order_items set participant_id = p_participant_id where order_id = p_order_id;

  select array_agg(distinct o.participant_id) into v_people
  from public.orders o where o.tab_id = v_order.tab_id and o.participant_id is not null;
  if v_people is null then
    select array_agg(p.id) into v_people from public.tab_participants p where p.tab_id = v_order.tab_id;
  end if;
  for v_line in select i.id from public.order_items i where i.order_id = p_order_id and i.shared loop
    perform public.split_item_shares(v_line.id, v_people);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- set_item_shares: staff change who shares a shared line (an even split among the chosen people).
-- Refused once the tab is paying or closed. Audited.
-- ---------------------------------------------------------------------------
create function public.set_item_shares(p_order_item_id uuid, p_participants uuid[])
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

-- ---------------------------------------------------------------------------
-- rename_participant: a phone renames its own participant (blank: no name). Returns 'ok' or 'name_taken'.
-- ---------------------------------------------------------------------------
create function public.rename_participant(p_tab_id uuid, p_device_hash text, p_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pid uuid;
begin
  p_name := nullif(btrim(p_name), '');
  select p.id into v_pid from public.tab_participants p
  join public.tabs t on t.id = p.tab_id
  where p.tab_id = p_tab_id and p.device_hash = p_device_hash and t.status <> 'closed'
  for update of p;
  if v_pid is null then
    raise exception 'not a participant' using errcode = '42501';
  end if;
  if p_name is not null and exists (
    select 1 from public.tab_participants p where p.tab_id = p_tab_id and p.id <> v_pid and lower(p.display_name) = lower(p_name)
  ) then
    return 'name_taken';
  end if;
  update public.tab_participants set display_name = p_name where id = v_pid;
  return 'ok';
end;
$$;

revoke all on function public.split_item_shares(uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.place_guest_order(uuid, uuid, text, jsonb, public.app_locale, text, text) from public, anon, authenticated;
revoke all on function public.rename_participant(uuid, text, text) from public, anon, authenticated;
grant execute on function public.place_guest_order(uuid, uuid, text, jsonb, public.app_locale, text, text) to service_role;
grant execute on function public.rename_participant(uuid, text, text) to service_role;
revoke all on function public.attribute_staff_order(uuid, uuid), public.set_item_shares(uuid, uuid[]) from public, anon;
grant execute on function public.attribute_staff_order(uuid, uuid), public.set_item_shares(uuid, uuid[]) to authenticated, service_role;
