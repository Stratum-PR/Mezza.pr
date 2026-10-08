-- P2-5 (issue #17): the restaurant is created after the email is confirmed, not at signup, so an
-- unconfirmed address (a typo, or someone else's email) never gets a restaurant, a slug or a trial.
-- The details typed at signup wait here; finishSignup (src/lib/auth/finish-signup.ts) claims the
-- row once the email is confirmed. Service role only: it holds a phone number, and nobody should
-- change the details before confirming.
-- Rollback: supabase/rollbacks/20261008000800_pending_signups.down.sql

create table public.pending_signups (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  restaurant_name text not null,
  phone text,
  language public.app_locale not null default 'es',
  created_at timestamptz not null default now()
);

alter table public.pending_signups enable row level security;
revoke all on table public.pending_signups from public, anon, authenticated;
grant select, insert, update, delete on table public.pending_signups to service_role;
