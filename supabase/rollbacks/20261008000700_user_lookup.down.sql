-- Rollback for 20261008000700_user_lookup.sql (P2-3, issue #15). Deploy the previous app first: the
-- current addMember calls this function.
begin;
drop function if exists public.auth_user_id_by_email(text);
delete from supabase_migrations.schema_migrations where version = '20261008000700';
commit;
