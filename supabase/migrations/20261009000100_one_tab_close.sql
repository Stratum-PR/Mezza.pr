-- P3-4: one tab-closing path. "Mesa libre" (close_tab), "Cerrado en el POS" (close_tab_on_pos) and
-- the idle housekeeping (close_idle_tabs) keep their own names, signatures, grants and checks (settled
-- for close_tab, the POS columns for close_tab_on_pos, settled and 10 quiet minutes for idle), and
-- all close through close_tab_core: the tab closes once (status, closed_at), its open requests are
-- handled, and the path's audit row (if it audits) is written in one place.
--
-- Two differences for "Cerrado en el POS", both from sharing the close:
--   - a tab still open now also has its open requests handled (before, they stayed in Servicio
--     after the tab closed);
--   - a tab already freed keeps the time it was freed (before, closed_at was overwritten).
-- Rollback: supabase/rollbacks/20261009000100_one_tab_close.down.sql

-- ---------------------------------------------------------------------------
-- close_tab_core: internal; only the functions below call it (as their owner). Closes the tab if
-- it is not closed yet and handles its open requests (by p_actor; null for housekeeping). Writes
-- one audit row when p_action is given, whether or not the tab was already closed (the caller
-- decides when a repeat is audited). Returns true if this call closed the tab.
-- ---------------------------------------------------------------------------
create function public.close_tab_core(p_tab_id uuid, p_actor uuid, p_action public.audit_action, p_before jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tab public.tabs%rowtype;
  v_closed boolean := false;
begin
  select * into v_tab from public.tabs where id = p_tab_id for update;
  if not found then return false; end if;
  if v_tab.status <> 'closed' then
    update public.tabs set status = 'closed', closed_at = now() where id = p_tab_id;
    update public.service_requests set status = 'handled', handled_at = now(), handled_by = p_actor
    where tab_id = p_tab_id and status = 'open';
    v_closed := true;
  end if;
  if p_action is not null then
    insert into public.audit_log (restaurant_id, actor_id, action, target_table, target_id, before)
    values (v_tab.restaurant_id, p_actor, p_action, 'tabs', p_tab_id, p_before);
  end if;
  return v_closed;
end;
$$;

revoke all on function public.close_tab_core(uuid, uuid, public.audit_action, jsonb) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- close_tab: "Mesa libre". Only a settled tab (nothing owed, nothing pending). Closing ends the
-- phones' sessions: the next order at the table starts a new tab with new people. The "Cerrado en el
-- POS" reminder (pos_closed_at) is separate and stays until staff tap it. Staff; audited.
-- ---------------------------------------------------------------------------
create or replace function public.close_tab(p_tab_id uuid)
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
  perform public.close_tab_core(p_tab_id, (select auth.uid()), 'close_tab', null);
end;
$$;

-- ---------------------------------------------------------------------------
-- close_tab_on_pos: "Cerrado en el POS". The sale was entered on the fiscal terminal: the tab closes
-- (whether or not it was settled in Mezza) and the POS reminder goes away. The first POS close is
-- kept, and it is audited with what the tab was before. Owner, manager or server.
-- ---------------------------------------------------------------------------
create or replace function public.close_tab_on_pos(p_tab_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tab public.tabs%rowtype;
  v_before jsonb;
begin
  select * into v_tab from public.tabs where id = p_tab_id for update;
  if not found or not public.has_role(v_tab.restaurant_id, array['owner', 'manager', 'server']::public.member_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if v_tab.pos_closed_at is not null then return; end if;
  v_before := jsonb_build_object('status', v_tab.status, 'closed_at', v_tab.closed_at, 'settled', public.tab_settled(p_tab_id));
  update public.tabs set pos_closed_at = now(), pos_closed_by = (select auth.uid()) where id = p_tab_id;
  perform public.close_tab_core(p_tab_id, (select auth.uid()), 'pos_close', v_before);
end;
$$;

-- ---------------------------------------------------------------------------
-- close_idle_tabs: housekeeping as staff screens and guest pages load. Pending payments nobody
-- finished in 15 minutes are abandoned (what they held is owed again; the phone can pay again and the
-- cash alert goes away), then settled tabs with orders and no activity (orders or payments) for 10
-- minutes close on their own, so a paid table doesn't carry into the next party. Not audited (no
-- actor). Staff may only tidy their own restaurant. Returns how many tabs closed.
-- ---------------------------------------------------------------------------
create or replace function public.close_idle_tabs(p_restaurant_id uuid)
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
      if public.close_tab_core(v_tab.id, null, null, null) then
        v_closed := v_closed + 1;
      end if;
    end if;
  end loop;
  return v_closed;
end;
$$;

-- Unchanged grants (create or replace keeps them; restated so this file reads on its own).
revoke all on function public.close_tab(uuid), public.close_tab_on_pos(uuid), public.close_idle_tabs(uuid) from public, anon;
grant execute on function public.close_tab(uuid), public.close_tab_on_pos(uuid), public.close_idle_tabs(uuid)
  to authenticated, service_role;
