-- Pass 2, phase 4: guest checkout. The phone reads one summary of what is owed (tab_checkout), a phone
-- that pays without having ordered becomes a person at the table (ensure_participant), and a pending
-- payment can be cancelled by its own phone or by staff (cancel_pending_payment).

-- ---------------------------------------------------------------------------
-- ensure_participant: the phone's person on this tab, created if needed (e.g. a parent paying for the
-- kids). Same lock order and people cap as place_guest_order. Null when the table is full.
-- ---------------------------------------------------------------------------
create function public.ensure_participant(p_tab_id uuid, p_device_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tab public.tabs%rowtype;
  v_pid uuid;
begin
  if p_device_hash is null or length(p_device_hash) <> 64 then
    raise exception 'invalid device' using errcode = '22023';
  end if;
  perform 1 from public.restaurants where id = (select restaurant_id from public.tabs where id = p_tab_id) for update;
  select * into v_tab from public.tabs where id = p_tab_id for update;
  if not found or v_tab.status = 'closed' then
    raise exception 'tab is closed' using errcode = '22023';
  end if;
  select id into v_pid from public.tab_participants where tab_id = p_tab_id and device_hash = p_device_hash;
  if v_pid is not null then return v_pid; end if;
  if (select count(*) from public.tab_participants where tab_id = p_tab_id)
     >= (select max_people_per_table from public.restaurants where id = v_tab.restaurant_id) then
    return null;
  end if;
  insert into public.tab_participants (restaurant_id, tab_id, guest_number, device_hash)
  values (v_tab.restaurant_id, p_tab_id,
    (select coalesce(max(guest_number), 0) + 1 from public.tab_participants where tab_id = p_tab_id), p_device_hash)
  returning id into v_pid;
  return v_pid;
end;
$$;

-- ---------------------------------------------------------------------------
-- tab_checkout: what a phone's "Pagar" screen shows, computed with the same rules as
-- create_tab_payment (which remains the authority for the amount actually charged).
--   people        each person's unpaid own charges and shares, outside the even-split plan
--   table_cents   the table's unpaid lines (no person), outside the plan
--   balance_cents everything unpaid, plan included
--   plan          the active even split: shares, shares left, amount left, the next share
--   paid_before   subtotal of payments that haven't failed (for the IVU preview, ivuForPart)
-- ---------------------------------------------------------------------------
create function public.tab_checkout(p_tab_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_plan public.split_plans%rowtype;
  v_left record;
  v_result jsonb;
begin
  select null::bigint as amount_left, null::integer as parts_left into v_left;
  select * into v_plan from public.split_plans where tab_id = p_tab_id and status = 'active';
  if found then
    select * into v_left from public.split_plan_left(v_plan.id);
    if v_left.amount_left <= 0 or v_left.parts_left <= 0 then v_plan := null; end if;
  end if;

  with c as (select * from public.tab_charges(p_tab_id) where c_cents > c_covered)
  select jsonb_build_object(
    'people', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'owed_cents', coalesce((select sum(c.c_cents - c.c_covered) from c where c.c_owner = p.id and c.c_plan is null), 0)
      ) order by p.guest_number)
      from public.tab_participants p where p.tab_id = p_tab_id
    ), '[]'::jsonb),
    'table_cents', coalesce((select sum(c.c_cents - c.c_covered) from c where c.c_owner is null and c.c_plan is null), 0),
    'balance_cents', coalesce((select sum(c.c_cents - c.c_covered) from c), 0),
    'paid_before_cents', coalesce((select sum(amount_cents) from public.payments where tab_id = p_tab_id and status <> 'failed'), 0),
    'plan', case when v_plan.id is null then null else jsonb_build_object(
      'id', v_plan.id,
      'parts', v_plan.parts,
      'parts_left', v_left.parts_left,
      'amount_left_cents', v_left.amount_left,
      -- nullif: Postgres may evaluate this even when the branch isn't taken (a finished plan has 0 left).
      'next_share_cents', v_left.amount_left / nullif(v_left.parts_left, 0)
        + case when v_left.amount_left % nullif(v_left.parts_left, 0) > 0 then 1 else 0 end
    ) end
  ) into v_result;
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- cancel_pending_payment: a pending payment goes to failed (what it held is free again). With a
-- device hash, only the payer's own phone may cancel; without one, the caller is trusted server code
-- that already checked staff permissions. Returns whether a payment was cancelled.
-- ---------------------------------------------------------------------------
create function public.cancel_pending_payment(p_payment_id uuid, p_device_hash text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
begin
  select * into v_payment from public.payments where id = p_payment_id;
  if not found then return false; end if;
  perform 1 from public.tabs where id = v_payment.tab_id for update;
  if p_device_hash is not null and not exists (
    select 1 from public.tab_participants p where p.id = v_payment.participant_id and p.device_hash = p_device_hash
  ) then
    return false;
  end if;
  update public.payments set status = 'failed' where id = p_payment_id and status = 'pending';
  return found;
end;
$$;

revoke all on function public.ensure_participant(uuid, text), public.cancel_pending_payment(uuid, text) from public, anon, authenticated;
grant execute on function public.ensure_participant(uuid, text), public.cancel_pending_payment(uuid, text) to service_role;
revoke all on function public.tab_checkout(uuid) from public, anon;
grant execute on function public.tab_checkout(uuid) to authenticated, service_role;
