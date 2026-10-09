-- P5-1: covering indexes for the 56 foreign keys in public that had none (the audit counted 38 on
-- an earlier schema; later migrations added more). Without one, deleting or re-keying a referenced
-- row (a tab, a participant, an order, a user) scans the whole referencing table, and joins along
-- the key can't use an index. Each index has the FK's columns in the FK's order, so it also
-- satisfies Supabase's performance advisor (lint 0001_unindexed_foreign_keys). Where a table has a
-- tenant FK on (restaurant_id) alone and a composite (restaurant_id, x) FK, the composite index
-- covers both, so 52 indexes cover 56 FKs. supabase/tests/17_fk_indexes.test.sql fails if a future
-- FK lands without one.
--
-- CONCURRENTLY: no long write lock on the tables while a build runs. It cannot run inside a
-- transaction, so this file has no begin/commit; the Supabase CLI (2.119) runs each
-- "create index concurrently" statement on its own, outside the migration batch. If a build fails
-- partway, Postgres leaves an INVALID index with that name, which "if not exists" would then skip:
-- before re-running, list them with
--   select indexrelid::regclass from pg_index where not indisvalid
-- and drop each (drop index concurrently ...). The pgTAP check ignores invalid indexes.
--
-- The first five are the ones the audit called out: service_requests(tab_id), cart_items(tab_id),
-- print_jobs(order_id), payments(participant_id), order_items(participant_id).
-- Rollback: supabase/rollbacks/20261009000200_fk_indexes.down.sql

create index concurrently if not exists service_requests_restaurant_id_tab_id_idx on public.service_requests (restaurant_id, tab_id);
create index concurrently if not exists cart_items_restaurant_id_tab_id_idx on public.cart_items (restaurant_id, tab_id);
create index concurrently if not exists print_jobs_restaurant_id_order_id_idx on public.print_jobs (restaurant_id, order_id);
create index concurrently if not exists payments_restaurant_id_participant_id_idx on public.payments (restaurant_id, participant_id);
create index concurrently if not exists order_items_restaurant_id_participant_id_idx on public.order_items (restaurant_id, participant_id);
create index concurrently if not exists audit_log_actor_id_idx on public.audit_log (actor_id);
create index concurrently if not exists cart_items_restaurant_id_item_id_idx on public.cart_items (restaurant_id, item_id);
create index concurrently if not exists cart_items_restaurant_id_participant_id_idx on public.cart_items (restaurant_id, participant_id);
create index concurrently if not exists exports_created_by_idx on public.exports (created_by);
create index concurrently if not exists exports_restaurant_id_idx on public.exports (restaurant_id);
create index concurrently if not exists item_hotspots_restaurant_id_item_id_idx on public.item_hotspots (restaurant_id, item_id);
create index concurrently if not exists item_hotspots_restaurant_id_page_id_idx on public.item_hotspots (restaurant_id, page_id);
create index concurrently if not exists item_modifier_groups_restaurant_id_group_id_idx on public.item_modifier_groups (restaurant_id, group_id);
create index concurrently if not exists item_modifier_groups_restaurant_id_item_id_idx on public.item_modifier_groups (restaurant_id, item_id);
create index concurrently if not exists menu_uploads_reviewed_by_idx on public.menu_uploads (reviewed_by);
create index concurrently if not exists modifier_options_restaurant_id_group_id_idx on public.modifier_options (restaurant_id, group_id);
create index concurrently if not exists order_item_shares_restaurant_id_participant_id_idx on public.order_item_shares (restaurant_id, participant_id);
create index concurrently if not exists order_items_restaurant_id_order_id_idx on public.order_items (restaurant_id, order_id);
create index concurrently if not exists order_items_voided_by_idx on public.order_items (voided_by);
create index concurrently if not exists orders_created_by_idx on public.orders (created_by);
create index concurrently if not exists orders_restaurant_id_device_id_idx on public.orders (restaurant_id, device_id);
create index concurrently if not exists orders_restaurant_id_participant_id_idx on public.orders (restaurant_id, participant_id);
create index concurrently if not exists orders_restaurant_id_tab_id_idx on public.orders (restaurant_id, tab_id);
create index concurrently if not exists payment_allocations_restaurant_id_idx on public.payment_allocations (restaurant_id);
create index concurrently if not exists payment_allocations_share_id_idx on public.payment_allocations (share_id);
create index concurrently if not exists payments_confirmed_by_idx on public.payments (confirmed_by);
create index concurrently if not exists payments_restaurant_id_for_participant_id_idx on public.payments (restaurant_id, for_participant_id);
create index concurrently if not exists payments_restaurant_id_plan_id_idx on public.payments (restaurant_id, plan_id);
create index concurrently if not exists payments_restaurant_id_tab_id_idx on public.payments (restaurant_id, tab_id);
create index concurrently if not exists print_jobs_restaurant_id_printer_id_idx on public.print_jobs (restaurant_id, printer_id);
create index concurrently if not exists refunds_approved_by_idx on public.refunds (approved_by);
create index concurrently if not exists refunds_restaurant_id_payment_id_idx on public.refunds (restaurant_id, payment_id);
create index concurrently if not exists service_requests_handled_by_idx on public.service_requests (handled_by);
create index concurrently if not exists split_plan_units_restaurant_id_idx on public.split_plan_units (restaurant_id);
create index concurrently if not exists split_plan_units_share_id_idx on public.split_plan_units (share_id);
create index concurrently if not exists split_plans_created_by_user_idx on public.split_plans (created_by_user);
create index concurrently if not exists split_plans_restaurant_id_created_by_participant_idx on public.split_plans (restaurant_id, created_by_participant);
create index concurrently if not exists split_plans_restaurant_id_tab_id_idx on public.split_plans (restaurant_id, tab_id);
create index concurrently if not exists support_access_grants_approved_by_idx on public.support_access_grants (approved_by);
create index concurrently if not exists support_access_grants_requested_by_idx on public.support_access_grants (requested_by);
create index concurrently if not exists support_access_grants_restaurant_id_idx on public.support_access_grants (restaurant_id);
create index concurrently if not exists tab_participants_auth_user_id_idx on public.tab_participants (auth_user_id);
create index concurrently if not exists tab_participants_restaurant_id_guest_id_idx on public.tab_participants (restaurant_id, guest_id);
create index concurrently if not exists tab_participants_restaurant_id_tab_id_idx on public.tab_participants (restaurant_id, tab_id);
create index concurrently if not exists tabs_pos_closed_by_idx on public.tabs (pos_closed_by);
create index concurrently if not exists tabs_restaurant_id_table_id_idx on public.tabs (restaurant_id, table_id);
create index concurrently if not exists write_off_allocations_restaurant_id_idx on public.write_off_allocations (restaurant_id);
create index concurrently if not exists write_off_allocations_share_id_idx on public.write_off_allocations (share_id);
create index concurrently if not exists write_off_allocations_write_off_id_idx on public.write_off_allocations (write_off_id);
create index concurrently if not exists write_offs_created_by_idx on public.write_offs (created_by);
create index concurrently if not exists write_offs_restaurant_id_participant_id_idx on public.write_offs (restaurant_id, participant_id);
create index concurrently if not exists write_offs_restaurant_id_tab_id_idx on public.write_offs (restaurant_id, tab_id);
