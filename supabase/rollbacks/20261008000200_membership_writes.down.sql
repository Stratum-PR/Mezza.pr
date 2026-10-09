-- Rollback for 20261008000200_membership_writes.sql (P0-2, issue #5). Restores the previous
-- policies and privileges, which REOPENS direct membership writes by managers and owners and PIN
-- hash reads; use only to back out a broken deploy.
begin;

revoke select (id, restaurant_id, user_id, role, active, created_at, updated_at) on public.memberships from authenticated;
grant select, insert, update, delete, truncate on public.memberships to authenticated;

drop policy memberships_select_owner on public.memberships;
create policy memberships_owner_all on public.memberships for all to authenticated
  using (public.has_role(restaurant_id, '{owner}')) with check (public.has_role(restaurant_id, '{owner}'));
create policy memberships_insert_manager on public.memberships for insert to authenticated
  with check (public.has_role(restaurant_id, '{manager}') and role <> 'owner');
create policy memberships_update_manager on public.memberships for update to authenticated
  using (public.has_role(restaurant_id, '{manager}') and role <> 'owner')
  with check (public.has_role(restaurant_id, '{manager}') and role <> 'owner');

delete from supabase_migrations.schema_migrations where version = '20261008000200';
commit;
