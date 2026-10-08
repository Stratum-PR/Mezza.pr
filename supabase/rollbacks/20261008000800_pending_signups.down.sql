-- Rollback for 20261008000800_pending_signups.sql (P2-5, issue #17). Deploy the previous app first:
-- the current signup writes this table. Signups still waiting for confirmation are lost; those
-- people can sign in once confirmed but will have no restaurant (list them before rolling back).
begin;
drop table if exists public.pending_signups;
delete from supabase_migrations.schema_migrations where version = '20261008000800';
commit;
