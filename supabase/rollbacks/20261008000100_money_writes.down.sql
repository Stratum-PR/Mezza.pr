-- Rollback for 20261008000100_money_writes.sql (P0-1, issue #4). Restores the previous policies and
-- privileges, which REOPENS direct money writes; use only to back out a broken deploy, then redeploy
-- the app version that confirms cash with a table update (before this change). The 'confirm_cash'
-- audit_action value stays: Postgres cannot drop enum values, and unused it is harmless.
begin;

drop function public.confirm_cash_payment(uuid);

grant insert, update, delete, truncate on public.payments, public.payment_allocations, public.refunds,
  public.write_offs, public.write_off_allocations to authenticated;

drop policy payments_select_owner on public.payments;
create policy payments_owner_all on public.payments for all to authenticated
  using (public.has_role(restaurant_id, '{owner}')) with check (public.has_role(restaurant_id, '{owner}'));
create policy payments_insert_manager_server on public.payments for insert to authenticated
  with check (public.has_role(restaurant_id, '{manager,server}'));
create policy payments_update_manager_server on public.payments for update to authenticated
  using (public.has_role(restaurant_id, '{manager,server}')) with check (public.has_role(restaurant_id, '{manager,server}'));

drop policy payment_allocations_select_owner on public.payment_allocations;
create policy payment_allocations_owner_all on public.payment_allocations for all to authenticated
  using (public.has_role(restaurant_id, '{owner}')) with check (public.has_role(restaurant_id, '{owner}'));

drop policy refunds_select_owner on public.refunds;
create policy refunds_owner_all on public.refunds for all to authenticated
  using (public.has_role(restaurant_id, '{owner}')) with check (public.has_role(restaurant_id, '{owner}'));

drop policy write_offs_select_owner on public.write_offs;
create policy write_offs_owner_all on public.write_offs for all to authenticated
  using (public.has_role(restaurant_id, '{owner}')) with check (public.has_role(restaurant_id, '{owner}'));

drop policy write_off_allocations_select_owner on public.write_off_allocations;
create policy write_off_allocations_owner_all on public.write_off_allocations for all to authenticated
  using (public.has_role(restaurant_id, '{owner}')) with check (public.has_role(restaurant_id, '{owner}'));

delete from supabase_migrations.schema_migrations where version = '20261008000100';
commit;
