-- P0-3 (issue #6): every restaurant keeps at least one active owner. Server code writes memberships
-- with the service role (Equipo, the setup wizard), so the rule lives here rather than in each
-- caller: the wizard's invite once turned the only owner into staff when they typed their own email.
-- Deferred to commit, so ownership can be handed over inside one transaction. Deleting the whole
-- restaurant is allowed. Deleting the only owner's account (auth.users) is refused too: hand the
-- restaurant over or delete it first.
-- Rollback: supabase/rollbacks/20261008000300_keep_an_owner.down.sql

create function public.keep_an_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'owner' and old.active
     and exists (select 1 from public.restaurants r where r.id = old.restaurant_id)
     and not exists (select 1 from public.memberships m
                     where m.restaurant_id = old.restaurant_id and m.role = 'owner' and m.active) then
    raise exception 'a restaurant needs at least one active owner' using errcode = '23514';
  end if;
  return null;
end;
$$;

revoke all on function public.keep_an_owner() from public, anon, authenticated;

create constraint trigger memberships_keep_an_owner
  after update or delete on public.memberships
  deferrable initially deferred
  for each row execute function public.keep_an_owner();
