-- Rollback for 20261008000500_owner_limits.sql (P2-1, issue #13). Restores owner write access to the
-- audit log, billing columns, subscriptions and usage fees; use only to back out a broken deploy.
begin;

revoke update (name, slug, address, phone, timezone, default_language, default_menu_style,
  ivu_state_bps, ivu_municipal_bps, qr_max_order_cents, qr_max_line_qty, qr_max_tab_cents,
  max_people_per_table, brand_color, cover_path) on public.restaurants from authenticated;
grant insert, update, delete, truncate on public.restaurants, public.audit_log, public.subscriptions,
  public.usage_fees to authenticated;

drop policy audit_log_select_owner on public.audit_log;
create policy audit_log_owner_all on public.audit_log for all to authenticated
  using (public.has_role(restaurant_id, '{owner}')) with check (public.has_role(restaurant_id, '{owner}'));
drop policy subscriptions_select_owner on public.subscriptions;
create policy subscriptions_owner_all on public.subscriptions for all to authenticated
  using (public.has_role(restaurant_id, '{owner}')) with check (public.has_role(restaurant_id, '{owner}'));
drop policy usage_fees_select_owner on public.usage_fees;
create policy usage_fees_owner_all on public.usage_fees for all to authenticated
  using (public.has_role(restaurant_id, '{owner}')) with check (public.has_role(restaurant_id, '{owner}'));

delete from supabase_migrations.schema_migrations where version = '20261008000500';
commit;
