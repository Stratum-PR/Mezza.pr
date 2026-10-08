-- P2-3 (issue #15): find an existing account by exact email. addMember (Equipo and the setup wizard)
-- listed the first 1000 accounts and searched them, so an account past the first page was "not
-- found". Service role only: anyone else could probe which emails have an account.
-- Rollback: supabase/rollbacks/20261008000700_user_lookup.down.sql

create function public.auth_user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id
  from auth.users u
  where lower(u.email) = lower(trim(p_email))
    and not u.is_sso_user
    and u.deleted_at is null
  limit 1
$$;

revoke execute on function public.auth_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.auth_user_id_by_email(text) to service_role;
