-- Rollback for 20261009000100_one_tab_close.sql (P3-4). Puts back the three closing functions as
-- they were (each closing the tab itself; bodies from 20261007000000_staff_tools.sql and
-- 20261008000400_tab_writes.sql) and drops close_tab_core. Names, signatures and grants are the same
-- either way, so the app needs no change and the order of app and database rollback does not matter.
-- After it, "Cerrado en el POS" again leaves the tab's open requests open and overwrites closed_at on
-- a tab already freed.
begin;

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
  update public.tabs set status = 'closed', closed_at = now() where id = p_tab_id;
  update public.service_requests set status = 'handled', handled_at = now(), handled_by = (select auth.uid())
  where tab_id = p_tab_id and status = 'open';
  insert into public.audit_log (restaurant_id, actor_id, action, target_table, target_id)
  values (v_tab.restaurant_id, (select auth.uid()), 'close_tab', 'tabs', p_tab_id);
end;
$$;

create or replace function public.close_tab_on_pos(p_tab_id uuid)
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
      update public.tabs set status = 'closed', closed_at = now() where id = v_tab.id;
      update public.service_requests set status = 'handled', handled_at = now()
      where tab_id = v_tab.id and status = 'open';
      v_closed := v_closed + 1;
    end if;
  end loop;
  return v_closed;
end;
$$;

drop function public.close_tab_core(uuid, uuid, public.audit_action, jsonb);

delete from supabase_migrations.schema_migrations where version = '20261009000100';
commit;
