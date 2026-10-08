-- P0-1 (issue #4): money rows are written only by server code (service role) and SECURITY DEFINER
-- functions. Signed-in staff, the owner included, read payments, what they cover, refunds and
-- write-offs but never write them directly: a server could otherwise mark a payment paid for any
-- amount, change tips or forge payments with the public API key. Cash is confirmed through
-- confirm_cash_payment, which checks the role and the payment and audits the confirmation.
-- Rollback: supabase/rollbacks/20261008000100_money_writes.down.sql

alter type public.audit_action add value if not exists 'confirm_cash';

drop policy payments_owner_all on public.payments;
drop policy payments_insert_manager_server on public.payments;
drop policy payments_update_manager_server on public.payments;
create policy payments_select_owner on public.payments for select to authenticated
  using (public.has_role(restaurant_id, '{owner}'));

drop policy payment_allocations_owner_all on public.payment_allocations;
create policy payment_allocations_select_owner on public.payment_allocations for select to authenticated
  using (public.has_role(restaurant_id, '{owner}'));

drop policy refunds_owner_all on public.refunds;
create policy refunds_select_owner on public.refunds for select to authenticated
  using (public.has_role(restaurant_id, '{owner}'));

drop policy write_offs_owner_all on public.write_offs;
create policy write_offs_select_owner on public.write_offs for select to authenticated
  using (public.has_role(restaurant_id, '{owner}'));

drop policy write_off_allocations_owner_all on public.write_off_allocations;
create policy write_off_allocations_select_owner on public.write_off_allocations for select to authenticated
  using (public.has_role(restaurant_id, '{owner}'));

-- Without a policy RLS already refuses; revoking the privilege keeps a future permissive policy from
-- reopening the tables by accident.
revoke insert, update, delete, truncate on public.payments, public.payment_allocations, public.refunds,
  public.write_offs, public.write_off_allocations from authenticated;

-- ---------------------------------------------------------------------------
-- confirm_cash_payment: "Efectivo recibido". Staff of the payment's restaurant mark a pending cash
-- payment paid. Returns the tab when this call confirmed it (the caller then records the sale), null
-- when it was already settled or lapsed. Card and ATH are confirmed by their providers, never by staff.
-- ---------------------------------------------------------------------------
create function public.confirm_cash_payment(p_payment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found or not public.has_role(v_payment.restaurant_id, array['owner', 'manager', 'server']::public.member_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if v_payment.method <> 'cash' then
    raise exception 'not a cash payment' using errcode = '22023';
  end if;
  if v_payment.status <> 'pending' then return null; end if;
  update public.payments set status = 'paid', paid_at = now(), confirmed_by = (select auth.uid())
  where id = p_payment_id;
  insert into public.audit_log (restaurant_id, actor_id, action, target_table, target_id, after)
  values (v_payment.restaurant_id, (select auth.uid()), 'confirm_cash', 'payments', p_payment_id,
    jsonb_build_object('amount_cents', v_payment.amount_cents, 'tip_cents', v_payment.tip_cents,
      'ivu_state_cents', v_payment.ivu_state_cents, 'ivu_municipal_cents', v_payment.ivu_municipal_cents));
  return v_payment.tab_id;
end;
$$;

revoke all on function public.confirm_cash_payment(uuid) from public, anon;
grant execute on function public.confirm_cash_payment(uuid) to authenticated, service_role;
