-- Rollback for 20261008000600_default_privileges.sql (P2-2, issue #14). Restores Supabase's default
-- privileges (new functions executable by anon/authenticated, new tables open to anon).
begin;
alter default privileges grant execute on functions to public;
alter default privileges in schema public grant execute on functions to public, anon, authenticated;
alter default privileges in schema public grant all on tables to anon;
alter default privileges in schema public grant all on sequences to anon;
grant execute on function public.report_summary(uuid, date, date), public.storage_restaurant_id(text) to public, anon;
delete from supabase_migrations.schema_migrations where version = '20261008000600';
commit;
