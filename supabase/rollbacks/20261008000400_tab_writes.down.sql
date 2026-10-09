-- Rollback for 20261008000400_tab_writes.sql (P0-4, issue #7). Restores the previous policies and
-- privileges, which REOPENS direct tab writes by staff; use only to back out a broken deploy, then
-- redeploy the app version whose "Cerrado en el POS" does a table update (before this change). The
-- 'pos_close' audit_action value stays (Postgres cannot drop enum values).
begin;

drop function public.close_tab_on_pos(uuid);

grant insert, update, delete, truncate on public.tabs to authenticated;

drop policy tabs_select_owner on public.tabs;
create policy tabs_owner_all on public.tabs for all to authenticated
  using (public.has_role(restaurant_id, '{owner}')) with check (public.has_role(restaurant_id, '{owner}'));
create policy tabs_insert_manager_server on public.tabs for insert to authenticated
  with check (public.has_role(restaurant_id, '{manager,server}'));
create policy tabs_update_manager_server on public.tabs for update to authenticated
  using (public.has_role(restaurant_id, '{manager,server}')) with check (public.has_role(restaurant_id, '{manager,server}'));

delete from supabase_migrations.schema_migrations where version = '20261008000400';
commit;
