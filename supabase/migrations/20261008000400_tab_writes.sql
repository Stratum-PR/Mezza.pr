-- P0-4 (issue #7): tabs change only through server code (guest pages use the service role) and
-- SECURITY DEFINER functions (close_tab, raise_tab_limit, the split engine). Signed-in staff never
-- write tabs directly: a server could otherwise close any tab without the "settled" check, or raise a
-- table's QR spending cap without raise_tab_limit. "Cerrado en el POS" goes through close_tab_on_pos,
-- which checks the role and audits it.
-- Rollback: supabase/rollbacks/20261008000400_tab_writes.down.sql

alter type public.audit_action add value if not exists 'pos_close';

drop policy tabs_owner_all on public.tabs;
drop policy tabs_insert_manager_server on public.tabs;
drop policy tabs_update_manager_server on public.tabs;
create policy tabs_select_owner on public.tabs for select to authenticated
  using (public.has_role(restaurant_id, '{owner}'));

revoke insert, update, delete, truncate on public.tabs from authenticated;

-- ---------------------------------------------------------------------------
-- close_tab_on_pos: "Cerrado en el POS". The sale was entered on the fiscal terminal: the tab closes
-- (whether or not it was settled in Mezza) and the POS reminder goes away. Same columns as the
-- earlier direct update; the first POS close is kept, and it is audited. Owner, manager or server.
-- ---------------------------------------------------------------------------
create function public.close_tab_on_pos(p_tab_id uuid)
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
  if v_tab.pos_closed_at is not null then return; end if;
  update public.tabs
  set pos_closed_at = now(), pos_closed_by = (select auth.uid()), status = 'closed', closed_at = now()
  where id = p_tab_id;
  insert into public.audit_log (restaurant_id, actor_id, action, target_table, target_id, before)
  values (v_tab.restaurant_id, (select auth.uid()), 'pos_close', 'tabs', p_tab_id,
    jsonb_build_object('status', v_tab.status, 'closed_at', v_tab.closed_at, 'settled', public.tab_settled(p_tab_id)));
end;
$$;

revoke all on function public.close_tab_on_pos(uuid) from public, anon;
grant execute on function public.close_tab_on_pos(uuid) to authenticated, service_role;
