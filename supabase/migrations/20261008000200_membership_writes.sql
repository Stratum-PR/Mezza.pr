-- P0-2 (issue #5): staff roles change only through server code (Equipo and the setup wizard), which
-- uses the service role after checking who may do what (only the owner adds or changes managers;
-- nobody changes the owner or themselves). Signed-in users never write memberships directly: a
-- manager could otherwise promote staff to manager or add any account with the public API key.
-- PIN hashes are not readable by anyone signed in.
-- Rollback: supabase/rollbacks/20261008000200_membership_writes.down.sql

drop policy memberships_owner_all on public.memberships;
drop policy memberships_insert_manager on public.memberships;
drop policy memberships_update_manager on public.memberships;
create policy memberships_select_owner on public.memberships for select to authenticated
  using (public.has_role(restaurant_id, '{owner}'));

revoke insert, update, delete, truncate on public.memberships from authenticated;

-- Every column but pin_hash. A new column needs its own grant (or stays server-only).
revoke select on public.memberships from authenticated;
grant select (id, restaurant_id, user_id, role, active, created_at, updated_at) on public.memberships to authenticated;
