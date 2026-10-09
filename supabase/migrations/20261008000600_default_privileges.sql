-- P2-2 (issue #14): functions and tables added by later migrations are not open to everyone by
-- default. Supabase's default privileges give anon and authenticated EXECUTE on every new public
-- function (and anon every privilege on new tables); each migration had to remember to revoke, and
-- report_summary and storage_restaurant_id were missed. From here on a migration grants explicitly,
-- e.g. `grant execute on function public.f(uuid) to authenticated, service_role;`.
-- Rollback: supabase/rollbacks/20261008000600_default_privileges.down.sql

alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
-- Postgres itself grants EXECUTE on new functions to PUBLIC; that default is global (a per-schema
-- default can only add to it), so it is revoked globally for the migration role.
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;

-- Both check the caller themselves; signed-in users keep them (storage policies need the second).
revoke execute on function public.report_summary(uuid, date, date) from public, anon;
revoke execute on function public.storage_restaurant_id(text) from public, anon;
grant execute on function public.report_summary(uuid, date, date), public.storage_restaurant_id(text)
  to authenticated, service_role;
