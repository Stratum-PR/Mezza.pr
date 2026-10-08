-- Rollback for 20261008000300_keep_an_owner.sql (P0-3, issue #6). Removes the "at least one active
-- owner" rule; the app's invite code still refuses to touch an owner.
begin;
drop trigger memberships_keep_an_owner on public.memberships;
drop function public.keep_an_owner();
delete from supabase_migrations.schema_migrations where version = '20261008000300';
commit;
