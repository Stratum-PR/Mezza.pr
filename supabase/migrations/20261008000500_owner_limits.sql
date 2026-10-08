-- P2-1 (issue #13): the audit log is append-only for the app (server code and SECURITY DEFINER
-- functions write it; signed-in users only read it), and owners edit their restaurant's settings but
-- not its billing state: plan, status, trial end, order numbering, onboarding step and fiscal mode
-- stay with Mezza (service role), as do subscription and usage-fee rows. Otherwise an owner could
-- give themselves a paid plan or an endless trial once billing ships, or erase audit entries.
-- Rollback: supabase/rollbacks/20261008000500_owner_limits.down.sql

drop policy audit_log_owner_all on public.audit_log;
create policy audit_log_select_owner on public.audit_log for select to authenticated
  using (public.has_role(restaurant_id, '{owner}'));
revoke insert, update, delete, truncate on public.audit_log from authenticated;

drop policy subscriptions_owner_all on public.subscriptions;
create policy subscriptions_select_owner on public.subscriptions for select to authenticated
  using (public.has_role(restaurant_id, '{owner}'));
drop policy usage_fees_owner_all on public.usage_fees;
create policy usage_fees_select_owner on public.usage_fees for select to authenticated
  using (public.has_role(restaurant_id, '{owner}'));
revoke insert, update, delete, truncate on public.subscriptions, public.usage_fees from authenticated;

-- Restaurants: the owner policy stays; only the columns Ajustes edits are writable. A new settings
-- column needs its own grant here.
revoke insert, update, delete, truncate on public.restaurants from authenticated;
grant update (name, slug, address, phone, timezone, default_language, default_menu_style,
  ivu_state_bps, ivu_municipal_bps, qr_max_order_cents, qr_max_line_qty, qr_max_tab_cents,
  max_people_per_table, brand_color, cover_path) on public.restaurants to authenticated;
