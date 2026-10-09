


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE SCHEMA IF NOT EXISTS "storage";


ALTER SCHEMA "storage" OWNER TO "supabase_admin";


CREATE TYPE "public"."app_locale" AS ENUM (
    'es',
    'en'
);


ALTER TYPE "public"."app_locale" OWNER TO "postgres";


CREATE TYPE "public"."audit_action" AS ENUM (
    'void',
    'refund',
    'price_change',
    'pin_reset',
    'support_access',
    'shares',
    'limit_change',
    'move_line',
    'write_off',
    'close_tab'
);


ALTER TYPE "public"."audit_action" OWNER TO "postgres";


CREATE TYPE "public"."device_kind" AS ENUM (
    'server',
    'kitchen',
    'register'
);


ALTER TYPE "public"."device_kind" OWNER TO "postgres";


CREATE TYPE "public"."export_kind" AS ENUM (
    'ivu_monthly_pdf',
    'ivu_monthly_csv',
    'sales_csv',
    'sales_xlsx',
    'qr_pdf'
);


ALTER TYPE "public"."export_kind" OWNER TO "postgres";


CREATE TYPE "public"."fiscal_mode" AS ENUM (
    'sit_beside',
    'processor'
);


ALTER TYPE "public"."fiscal_mode" OWNER TO "postgres";


CREATE TYPE "public"."member_role" AS ENUM (
    'owner',
    'manager',
    'server',
    'kitchen'
);


ALTER TYPE "public"."member_role" OWNER TO "postgres";


CREATE TYPE "public"."menu_style" AS ENUM (
    'house',
    'original',
    'simple'
);


ALTER TYPE "public"."menu_style" OWNER TO "postgres";


CREATE TYPE "public"."order_source" AS ENUM (
    'qr',
    'staff'
);


ALTER TYPE "public"."order_source" OWNER TO "postgres";


CREATE TYPE "public"."order_status" AS ENUM (
    'new',
    'in_kitchen',
    'ready',
    'served',
    'void'
);


ALTER TYPE "public"."order_status" OWNER TO "postgres";


CREATE TYPE "public"."paper_texture" AS ENUM (
    'none',
    'linen',
    'kraft',
    'parchment'
);


ALTER TYPE "public"."paper_texture" OWNER TO "postgres";


CREATE TYPE "public"."payment_method" AS ENUM (
    'card',
    'ath',
    'cash'
);


ALTER TYPE "public"."payment_method" OWNER TO "postgres";


CREATE TYPE "public"."payment_provider" AS ENUM (
    'stripe',
    'ath'
);


ALTER TYPE "public"."payment_provider" OWNER TO "postgres";


CREATE TYPE "public"."payment_status" AS ENUM (
    'pending',
    'paid',
    'failed',
    'refunded',
    'partially_refunded'
);


ALTER TYPE "public"."payment_status" OWNER TO "postgres";


CREATE TYPE "public"."print_status" AS ENUM (
    'queued',
    'printed',
    'failed'
);


ALTER TYPE "public"."print_status" OWNER TO "postgres";


CREATE TYPE "public"."printer_protocol" AS ENUM (
    'browser',
    'epson_epos',
    'star_webprnt'
);


ALTER TYPE "public"."printer_protocol" OWNER TO "postgres";


CREATE TYPE "public"."provider_status" AS ENUM (
    'not_connected',
    'pending',
    'connected',
    'unavailable'
);


ALTER TYPE "public"."provider_status" OWNER TO "postgres";


CREATE TYPE "public"."qr_dot_style" AS ENUM (
    'square',
    'rounded',
    'dots'
);


ALTER TYPE "public"."qr_dot_style" OWNER TO "postgres";


CREATE TYPE "public"."qr_eye_style" AS ENUM (
    'square',
    'rounded',
    'circle'
);


ALTER TYPE "public"."qr_eye_style" OWNER TO "postgres";


CREATE TYPE "public"."qr_font" AS ENUM (
    'menu',
    'modern'
);


ALTER TYPE "public"."qr_font" OWNER TO "postgres";


CREATE TYPE "public"."qr_logo_mode" AS ENUM (
    'none',
    'mono',
    'upload'
);


ALTER TYPE "public"."qr_logo_mode" OWNER TO "postgres";


CREATE TYPE "public"."restaurant_status" AS ENUM (
    'trial',
    'active',
    'paused',
    'cancelled'
);


ALTER TYPE "public"."restaurant_status" OWNER TO "postgres";


CREATE TYPE "public"."service_request_kind" AS ENUM (
    'call_server',
    'bring_check'
);


ALTER TYPE "public"."service_request_kind" OWNER TO "postgres";


CREATE TYPE "public"."service_request_status" AS ENUM (
    'open',
    'handled'
);


ALTER TYPE "public"."service_request_status" OWNER TO "postgres";


CREATE TYPE "public"."split_mode" AS ENUM (
    'one',
    'even',
    'items'
);


ALTER TYPE "public"."split_mode" OWNER TO "postgres";


CREATE TYPE "public"."subscription_status" AS ENUM (
    'trial',
    'active',
    'past_due',
    'cancelled'
);


ALTER TYPE "public"."subscription_status" OWNER TO "postgres";


CREATE TYPE "public"."tab_status" AS ENUM (
    'open',
    'paying',
    'closed'
);


ALTER TYPE "public"."tab_status" OWNER TO "postgres";


CREATE TYPE "public"."ticket_kind" AS ENUM (
    'kitchen',
    'receipt'
);


ALTER TYPE "public"."ticket_kind" OWNER TO "postgres";


CREATE TYPE "public"."upload_status" AS ENUM (
    'processing',
    'review',
    'published',
    'failed'
);


ALTER TYPE "public"."upload_status" OWNER TO "postgres";


CREATE TYPE "storage"."buckettype" AS ENUM (
    'STANDARD',
    'ANALYTICS',
    'VECTOR'
);


ALTER TYPE "storage"."buckettype" OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "public"."active_split_plan"("p_tab_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_plan uuid;
  v_left record;
begin
  select id into v_plan from public.split_plans where tab_id = p_tab_id and status = 'active';
  if v_plan is null then return null; end if;
  select * into v_left from public.split_plan_left(v_plan);
  if v_left.amount_left > 0 and v_left.parts_left > 0 then return v_plan; end if;
  update public.split_plans set status = 'done', updated_at = now() where id = v_plan;
  return null;
end;
$$;


ALTER FUNCTION "public"."active_split_plan"("p_tab_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."attribute_staff_order"("p_order_id" "uuid", "p_participant_id" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_order public.orders%rowtype;
  v_line record;
  v_people uuid[];
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or not public.has_role(v_order.restaurant_id, array['owner', 'manager', 'server']::public.member_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_participant_id is not null and not exists (
    select 1 from public.tab_participants p where p.id = p_participant_id and p.tab_id = v_order.tab_id
  ) then
    raise exception 'participant not at this table' using errcode = '22023';
  end if;

  update public.orders set participant_id = p_participant_id where id = p_order_id;
  update public.order_items set participant_id = p_participant_id where order_id = p_order_id;

  select array_agg(distinct o.participant_id) into v_people
  from public.orders o where o.tab_id = v_order.tab_id and o.participant_id is not null;
  if v_people is null then
    select array_agg(p.id) into v_people from public.tab_participants p where p.tab_id = v_order.tab_id;
  end if;
  for v_line in select i.id from public.order_items i where i.order_id = p_order_id and i.shared loop
    perform public.split_item_shares(v_line.id, v_people);
  end loop;
end;
$$;


ALTER FUNCTION "public"."attribute_staff_order"("p_order_id" "uuid", "p_participant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_price_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if new.price_cents is distinct from old.price_cents then
    insert into public.audit_log (restaurant_id, actor_id, action, target_table, target_id, before, after)
    values (
      new.restaurant_id,
      coalesce((select auth.uid()), nullif(current_setting('mezza.actor_id', true), '')::uuid),
      'price_change', 'menu_items', new.id,
      jsonb_build_object('price_cents', old.price_cents),
      jsonb_build_object('price_cents', new.price_cents)
    );
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."audit_price_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_pending_payment"("p_payment_id" "uuid", "p_device_hash" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_payment public.payments%rowtype;
begin
  select * into v_payment from public.payments where id = p_payment_id;
  if not found then return false; end if;
  perform 1 from public.tabs where id = v_payment.tab_id for update;
  if p_device_hash is not null and not exists (
    select 1 from public.tab_participants p where p.id = v_payment.participant_id and p.device_hash = p_device_hash
  ) then
    return false;
  end if;
  update public.payments set status = 'failed' where id = p_payment_id and status = 'pending';
  return found;
end;
$$;


ALTER FUNCTION "public"."cancel_pending_payment"("p_payment_id" "uuid", "p_device_hash" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_split_plan"("p_tab_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_plan uuid;
begin
  perform 1 from public.tabs where id = p_tab_id for update;
  v_plan := public.active_split_plan(p_tab_id);
  if v_plan is null then
    return jsonb_build_object('status', 'rejected', 'reason', 'no_plan');
  end if;
  if exists (select 1 from public.payments where plan_id = v_plan and status <> 'failed') then
    return jsonb_build_object('status', 'rejected', 'reason', 'plan_started');
  end if;
  update public.split_plans set status = 'cancelled', updated_at = now() where id = v_plan;
  return jsonb_build_object('status', 'accepted', 'plan_id', v_plan);
end;
$$;


ALTER FUNCTION "public"."cancel_split_plan"("p_tab_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."close_idle_tabs"("p_restaurant_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_tab record;
  v_closed integer := 0;
begin
  if (select auth.uid()) is not null
     and not public.has_role(p_restaurant_id, array['owner', 'manager', 'server', 'kitchen']::public.member_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.payments set status = 'failed'
  where restaurant_id = p_restaurant_id and status = 'pending' and created_at < now() - interval '15 minutes';
  for v_tab in
    select t.id from public.tabs t
    where t.restaurant_id = p_restaurant_id and t.status <> 'closed'
      and exists (select 1 from public.orders o where o.tab_id = t.id and o.status <> 'void')
      and greatest(
        (select max(o.created_at) from public.orders o where o.tab_id = t.id),
        coalesce((select max(coalesce(p.paid_at, p.created_at)) from public.payments p where p.tab_id = t.id and p.status <> 'failed'), '-infinity')
      ) < now() - interval '10 minutes'
    for update skip locked
  loop
    if public.tab_settled(v_tab.id) then
      update public.tabs set status = 'closed', closed_at = now() where id = v_tab.id;
      update public.service_requests set status = 'handled', handled_at = now()
      where tab_id = v_tab.id and status = 'open';
      v_closed := v_closed + 1;
    end if;
  end loop;
  return v_closed;
end;
$$;


ALTER FUNCTION "public"."close_idle_tabs"("p_restaurant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."close_tab"("p_tab_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_tab public.tabs%rowtype;
begin
  select * into v_tab from public.tabs where id = p_tab_id for update;
  if not found or not public.has_role(v_tab.restaurant_id, array['owner', 'manager', 'server']::public.member_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if v_tab.status = 'closed' then return; end if;
  if not public.tab_settled(p_tab_id) then
    raise exception 'tab is not settled' using errcode = '22023';
  end if;
  update public.tabs set status = 'closed', closed_at = now() where id = p_tab_id;
  update public.service_requests set status = 'handled', handled_at = now(), handled_by = (select auth.uid())
  where tab_id = p_tab_id and status = 'open';
  insert into public.audit_log (restaurant_id, actor_id, action, target_table, target_id)
  values (v_tab.restaurant_id, (select auth.uid()), 'close_tab', 'tabs', p_tab_id);
end;
$$;


ALTER FUNCTION "public"."close_tab"("p_tab_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_restaurant_with_owner"("p_owner_id" "uuid", "p_name" "text", "p_slug" "text", "p_phone" "text" DEFAULT NULL::"text", "p_language" "public"."app_locale" DEFAULT 'es'::"public"."app_locale") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_restaurant_id uuid;
  v_trial_ends timestamptz := now() + interval '30 days';
begin
  insert into public.restaurants (name, slug, phone, default_language, status, trial_ends_at, onboarding_step)
  values (p_name, p_slug, p_phone, p_language, 'trial', v_trial_ends, 2)
  returning id into v_restaurant_id;

  insert into public.memberships (restaurant_id, user_id, role) values (v_restaurant_id, p_owner_id, 'owner');

  insert into public.profiles (user_id, phone, preferred_language)
  values (p_owner_id, p_phone, p_language)
  on conflict (user_id) do nothing;

  insert into public.qr_designs (restaurant_id) values (v_restaurant_id);

  insert into public.subscriptions (restaurant_id, plan, status, trial_ends_at)
  values (v_restaurant_id, 'A', 'trial', v_trial_ends);

  return v_restaurant_id;
end;
$$;


ALTER FUNCTION "public"."create_restaurant_with_owner"("p_owner_id" "uuid", "p_name" "text", "p_slug" "text", "p_phone" "text", "p_language" "public"."app_locale") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_tab_payment"("p_tab_id" "uuid", "p_option" "text", "p_method" "public"."payment_method", "p_idempotency_key" "text", "p_payer" "uuid" DEFAULT NULL::"uuid", "p_for" "uuid" DEFAULT NULL::"uuid", "p_parts" integer DEFAULT 1, "p_tip_percent" integer DEFAULT NULL::integer, "p_tip_cents" integer DEFAULT NULL::integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_tab public.tabs%rowtype;
  v_existing public.payments%rowtype;
  v_rates record;
  v_plan uuid;
  v_left record;
  v_for uuid;
  v_charge record;
  v_alloc jsonb := '[]'::jsonb;
  v_sub bigint := 0;
  v_take bigint;
  v_need bigint;
  v_parts integer;
  v_before bigint;
  v_prev_s bigint;
  v_prev_m bigint;
  v_after bigint;
  v_s integer;
  v_m integer;
  v_tip integer := 0;
  v_pid uuid;
begin
  if p_idempotency_key is null or length(p_idempotency_key) not between 8 and 100 then
    return jsonb_build_object('status', 'rejected', 'reason', 'validation', 'detail', 'idempotency_key');
  end if;
  select * into v_tab from public.tabs where id = p_tab_id for update;
  if not found then
    return jsonb_build_object('status', 'rejected', 'reason', 'validation', 'detail', 'tab');
  end if;

  -- A repeated key returns the payment it already created.
  select * into v_existing from public.payments
  where restaurant_id = v_tab.restaurant_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.tab_id <> p_tab_id then
      return jsonb_build_object('status', 'rejected', 'reason', 'validation', 'detail', 'idempotency_key');
    end if;
    return jsonb_build_object('status', 'accepted', 'replayed', true, 'payment_id', v_existing.id,
      'subtotal_cents', v_existing.amount_cents, 'ivu_state_cents', v_existing.ivu_state_cents,
      'ivu_municipal_cents', v_existing.ivu_municipal_cents, 'tip_cents', v_existing.tip_cents,
      'total_cents', v_existing.amount_cents + v_existing.ivu_state_cents + v_existing.ivu_municipal_cents + v_existing.tip_cents,
      'payment_status', v_existing.status);
  end if;
  if v_tab.status = 'closed' then
    return jsonb_build_object('status', 'rejected', 'reason', 'tab_closed');
  end if;

  -- Pending payments nobody finished in 15 minutes are abandoned; what they held is free again.
  update public.payments set status = 'failed'
  where tab_id = p_tab_id and status = 'pending' and created_at < now() - interval '15 minutes';

  if p_payer is not null then
    if not exists (select 1 from public.tab_participants where id = p_payer and tab_id = p_tab_id) then
      return jsonb_build_object('status', 'rejected', 'reason', 'validation', 'detail', 'payer');
    end if;
    select * into v_existing from public.payments
    where tab_id = p_tab_id and participant_id = p_payer and status = 'pending' limit 1;
    if found then
      return jsonb_build_object('status', 'rejected', 'reason', 'pending_exists', 'payment_id', v_existing.id);
    end if;
  end if;
  if (p_tip_percent is not null and p_tip_cents is not null)
     or (p_tip_percent is not null and p_tip_percent not between 0 and 100)
     or (p_tip_cents is not null and p_tip_cents not between 0 and 100000) then
    return jsonb_build_object('status', 'rejected', 'reason', 'validation', 'detail', 'tip');
  end if;

  v_plan := public.active_split_plan(p_tab_id);

  if p_option in ('mine', 'person') then
    v_for := case when p_option = 'mine' then p_payer else p_for end;
    if v_for is null or not exists (select 1 from public.tab_participants where id = v_for and tab_id = p_tab_id) then
      return jsonb_build_object('status', 'rejected', 'reason', 'validation', 'detail', 'person');
    end if;
    -- Their own charges and shares, outside the even-split plan.
    for v_charge in
      select * from public.tab_charges(p_tab_id) c
      where c.c_owner = v_for and c.c_plan is null and c.c_cents > c.c_covered
      order by c.c_created, c.c_item, c.c_share
    loop
      v_alloc := v_alloc || jsonb_build_object('item', v_charge.c_item, 'share', v_charge.c_share, 'cents', v_charge.c_cents - v_charge.c_covered);
      v_sub := v_sub + v_charge.c_cents - v_charge.c_covered;
    end loop;

  elsif p_option = 'balance' then
    for v_charge in
      select * from public.tab_charges(p_tab_id) c where c.c_cents > c.c_covered
      order by c.c_created, c.c_item, c.c_share
    loop
      v_alloc := v_alloc || jsonb_build_object('item', v_charge.c_item, 'share', v_charge.c_share, 'cents', v_charge.c_cents - v_charge.c_covered);
      v_sub := v_sub + v_charge.c_cents - v_charge.c_covered;
    end loop;
    -- Paying the balance pays every share left in the plan.
    if v_plan is not null then
      select * into v_left from public.split_plan_left(v_plan);
      v_parts := nullif(greatest(v_left.parts_left, 0), 0);
      if v_parts is null then v_plan := null; end if;
    end if;

  elsif p_option = 'plan' then
    if v_plan is null then
      return jsonb_build_object('status', 'rejected', 'reason', 'no_plan');
    end if;
    select * into v_left from public.split_plan_left(v_plan);
    if p_parts is null or p_parts not between 1 and v_left.parts_left then
      return jsonb_build_object('status', 'rejected', 'reason', 'validation', 'detail', 'parts');
    end if;
    v_parts := p_parts;
    -- The first p_parts of an even split of what's left; the first shares get the leftover cents.
    v_need := (v_left.amount_left / v_left.parts_left) * p_parts + least(p_parts, v_left.amount_left % v_left.parts_left);
    for v_charge in
      select * from public.tab_charges(p_tab_id) c
      where c.c_plan = v_plan and c.c_cents > c.c_covered
      order by c.c_created, c.c_item, c.c_share
    loop
      exit when v_need = 0;
      v_take := least(v_need, v_charge.c_cents - v_charge.c_covered);
      v_alloc := v_alloc || jsonb_build_object('item', v_charge.c_item, 'share', v_charge.c_share, 'cents', v_take);
      v_sub := v_sub + v_take;
      v_need := v_need - v_take;
    end loop;

  else
    return jsonb_build_object('status', 'rejected', 'reason', 'validation', 'detail', 'option');
  end if;

  if v_sub = 0 then
    return jsonb_build_object('status', 'rejected', 'reason', 'nothing_to_pay');
  end if;

  select r.ivu_state_bps as st, r.ivu_municipal_bps as mu into v_rates from public.restaurants r where r.id = v_tab.restaurant_id;
  select coalesce(sum(amount_cents), 0), coalesce(sum(ivu_state_cents), 0), coalesce(sum(ivu_municipal_cents), 0)
  into v_before, v_prev_s, v_prev_m
  from public.payments where tab_id = p_tab_id and status <> 'failed';
  select coalesce(sum(c.c_cents - c.c_covered), 0) - v_sub into v_after from public.tab_charges(p_tab_id) c where c.c_cents > c.c_covered;
  if v_after = 0 then
    v_s := greatest(public.ivu_cents(v_before + v_sub, v_rates.st) - v_prev_s, 0);
    v_m := greatest(public.ivu_cents(v_before + v_sub, v_rates.mu) - v_prev_m, 0);
  else
    v_s := public.ivu_cents(v_before + v_sub, v_rates.st) - public.ivu_cents(v_before, v_rates.st);
    v_m := public.ivu_cents(v_before + v_sub, v_rates.mu) - public.ivu_cents(v_before, v_rates.mu);
  end if;
  if p_tip_cents is not null then
    v_tip := p_tip_cents;
  elsif p_tip_percent is not null then
    v_tip := public.ivu_cents(v_sub, p_tip_percent * 100);
  end if;

  insert into public.payments (
    restaurant_id, tab_id, participant_id, method, amount_cents, tip_cents, ivu_state_cents, ivu_municipal_cents,
    status, idempotency_key, split_option, for_participant_id, plan_id, plan_parts
  ) values (
    v_tab.restaurant_id, p_tab_id, p_payer, p_method, v_sub, v_tip, v_s, v_m,
    'pending', p_idempotency_key, p_option, v_for, case when v_parts is not null then v_plan end, v_parts
  ) returning id into v_pid;
  insert into public.payment_allocations (restaurant_id, payment_id, order_item_id, share_id, cents)
  select v_tab.restaurant_id, v_pid, (a ->> 'item')::uuid, (a ->> 'share')::uuid, (a ->> 'cents')::integer
  from jsonb_array_elements(v_alloc) as a;

  return jsonb_build_object('status', 'accepted', 'replayed', false, 'payment_id', v_pid,
    'subtotal_cents', v_sub, 'ivu_state_cents', v_s, 'ivu_municipal_cents', v_m, 'tip_cents', v_tip,
    'total_cents', v_sub + v_s + v_m + v_tip, 'payment_status', 'pending',
    'plan_id', case when v_parts is not null then v_plan end, 'plan_parts', v_parts);
end;
$$;


ALTER FUNCTION "public"."create_tab_payment"("p_tab_id" "uuid", "p_option" "text", "p_method" "public"."payment_method", "p_idempotency_key" "text", "p_payer" "uuid", "p_for" "uuid", "p_parts" integer, "p_tip_percent" integer, "p_tip_cents" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_participant"("p_tab_id" "uuid", "p_device_hash" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_tab public.tabs%rowtype;
  v_pid uuid;
begin
  if p_device_hash is null or length(p_device_hash) <> 64 then
    raise exception 'invalid device' using errcode = '22023';
  end if;
  perform 1 from public.restaurants where id = (select restaurant_id from public.tabs where id = p_tab_id) for no key update; -- not FOR UPDATE: it would block the foreign-key checks of payments/orders inserted by another transaction that holds the tab (deadlock)
  select * into v_tab from public.tabs where id = p_tab_id for update;
  if not found or v_tab.status = 'closed' then
    raise exception 'tab is closed' using errcode = '22023';
  end if;
  select id into v_pid from public.tab_participants where tab_id = p_tab_id and device_hash = p_device_hash;
  if v_pid is not null then return v_pid; end if;
  if (select count(*) from public.tab_participants where tab_id = p_tab_id)
     >= (select max_people_per_table from public.restaurants where id = v_tab.restaurant_id) then
    return null;
  end if;
  insert into public.tab_participants (restaurant_id, tab_id, guest_number, device_hash)
  values (v_tab.restaurant_id, p_tab_id,
    (select coalesce(max(guest_number), 0) + 1 from public.tab_participants where tab_id = p_tab_id), p_device_hash)
  returning id into v_pid;
  return v_pid;
end;
$$;


ALTER FUNCTION "public"."ensure_participant"("p_tab_id" "uuid", "p_device_hash" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("p_restaurant_id" "uuid", "p_roles" "public"."member_role"[]) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1
    from public.memberships m
    where m.restaurant_id = p_restaurant_id
      and m.user_id = (select auth.uid())
      and m.active
      and m.role = any (p_roles)
  );
$$;


ALTER FUNCTION "public"."has_role"("p_restaurant_id" "uuid", "p_roles" "public"."member_role"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_platform_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid()));
$$;


ALTER FUNCTION "public"."is_platform_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ivu_cents"("p_cents" bigint, "p_bps" integer) RETURNS integer
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$ select ((p_cents * p_bps + 5000) / 10000)::integer $$;


ALTER FUNCTION "public"."ivu_cents"("p_cents" bigint, "p_bps" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."move_order_item"("p_order_item_id" "uuid", "p_participant_id" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_item record;
begin
  select i.id, i.restaurant_id, i.participant_id, i.shared, i.voided_at, o.tab_id, t.status as tab_status into v_item
  from public.order_items i join public.orders o on o.id = i.order_id join public.tabs t on t.id = o.tab_id
  where i.id = p_order_item_id;
  if not found or not public.has_role(v_item.restaurant_id, array['owner', 'manager', 'server']::public.member_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  perform 1 from public.tabs where id = v_item.tab_id for update;
  if v_item.voided_at is not null or v_item.tab_status = 'closed' then
    raise exception 'line cannot move' using errcode = '22023';
  end if;
  if p_participant_id is not null and not exists (
    select 1 from public.tab_participants where id = p_participant_id and tab_id = v_item.tab_id
  ) then
    raise exception 'participants must be at this table' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.payment_allocations a join public.payments p on p.id = a.payment_id
    where a.order_item_id = p_order_item_id and p.status <> 'failed'
  ) or exists (select 1 from public.write_off_allocations w where w.order_item_id = p_order_item_id)
    or exists (
      select 1 from public.split_plan_units u join public.split_plans sp on sp.id = u.plan_id
      where u.order_item_id = p_order_item_id and sp.status = 'active'
    ) then
    raise exception 'line has payments' using errcode = '22023';
  end if;

  delete from public.order_item_shares where order_item_id = p_order_item_id;
  update public.order_items set participant_id = p_participant_id, shared = false where id = p_order_item_id;
  insert into public.audit_log (restaurant_id, actor_id, action, target_table, target_id, before, after)
  values (v_item.restaurant_id, (select auth.uid()), 'move_line', 'order_items', p_order_item_id,
    jsonb_build_object('participant_id', v_item.participant_id, 'shared', v_item.shared),
    jsonb_build_object('participant_id', p_participant_id, 'shared', false));
end;
$$;


ALTER FUNCTION "public"."move_order_item"("p_order_item_id" "uuid", "p_participant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."period_adjustments"("p_restaurant_id" "uuid", "p_from" "date", "p_to" "date") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_tz text;
  v_start timestamptz;
  v_end timestamptz;
begin
  if not public.has_role(p_restaurant_id, array['owner', 'manager']::public.member_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then
    raise exception 'invalid range' using errcode = '22023';
  end if;
  select r.timezone into v_tz from public.restaurants r where r.id = p_restaurant_id;
  v_start := p_from::timestamp at time zone v_tz;
  v_end := (p_to + 1)::timestamp at time zone v_tz;
  return jsonb_build_object(
    'voidsCents', coalesce((select sum(i.qty * i.unit_price_cents) from public.order_items i
      where i.restaurant_id = p_restaurant_id and i.voided_at >= v_start and i.voided_at < v_end), 0),
    'voidsCount', (select count(*) from public.order_items i
      where i.restaurant_id = p_restaurant_id and i.voided_at >= v_start and i.voided_at < v_end),
    'writeOffsCents', coalesce((select sum(w.cents) from public.write_offs w
      where w.restaurant_id = p_restaurant_id and w.created_at >= v_start and w.created_at < v_end), 0),
    'writeOffsCount', (select count(*) from public.write_offs w
      where w.restaurant_id = p_restaurant_id and w.created_at >= v_start and w.created_at < v_end)
  );
end;
$$;


ALTER FUNCTION "public"."period_adjustments"("p_restaurant_id" "uuid", "p_from" "date", "p_to" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."place_guest_order"("p_restaurant_id" "uuid", "p_table_id" "uuid", "p_client_order_id" "text", "p_lines" "jsonb", "p_guest_language" "public"."app_locale", "p_device_hash" "text", "p_name" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_result jsonb;
  v_order record;
  v_pid uuid;
  v_number integer;
  v_line record;
  v_people uuid[];
begin
  if p_device_hash is null or length(p_device_hash) <> 64 then
    return jsonb_build_object('status', 'rejected', 'reason', 'validation', 'detail', 'device');
  end if;

  -- Same lock place_order takes first, so the tab and the participant can't race another order.
  perform 1 from public.restaurants r where r.id = p_restaurant_id for no key update; -- not FOR UPDATE: it would block the foreign-key checks of payments/orders inserted by another transaction that holds the tab (deadlock)

  -- A full table (restaurants.max_people_per_table) refuses a new phone before anything is created.
  select p.id into v_pid
  from public.tabs t join public.tab_participants p on p.tab_id = t.id
  where t.table_id = p_table_id and t.status <> 'closed' and p.device_hash = p_device_hash;
  if v_pid is null and (
    select count(*) from public.tabs t join public.tab_participants p on p.tab_id = t.id
    where t.table_id = p_table_id and t.status <> 'closed'
  ) >= (select r.max_people_per_table from public.restaurants r where r.id = p_restaurant_id) and not exists (
    select 1 from public.orders o where o.restaurant_id = p_restaurant_id and o.idempotency_key = p_client_order_id
  ) then
    return jsonb_build_object('status', 'rejected', 'reason', 'validation', 'detail', 'table_full');
  end if;

  v_result := public.place_order(p_restaurant_id, p_table_id, p_client_order_id, 'qr', p_lines, p_guest_language);
  if v_result ->> 'status' <> 'accepted' then
    return v_result;
  end if;

  select o.id, o.tab_id, o.participant_id into v_order from public.orders o where o.id = (v_result ->> 'order_id')::uuid;
  if (v_result ->> 'replayed')::boolean then
    return v_result || jsonb_build_object('participant_id', v_order.participant_id);
  end if;

  select p.id into v_pid from public.tab_participants p where p.tab_id = v_order.tab_id and p.device_hash = p_device_hash;
  if v_pid is null then
    select coalesce(max(p.guest_number), 0) + 1 into v_number from public.tab_participants p where p.tab_id = v_order.tab_id;
    insert into public.tab_participants (restaurant_id, tab_id, display_name, guest_number, device_hash)
    values (
      p_restaurant_id, v_order.tab_id,
      case when p_name is not null and not exists (
        select 1 from public.tab_participants p where p.tab_id = v_order.tab_id and lower(p.display_name) = lower(p_name)
      ) then p_name end,
      v_number, p_device_hash
    )
    returning id into v_pid;
  end if;

  -- "Pagó y pidió de nuevo": this person already has a payment on the tab.
  update public.orders set participant_id = v_pid, after_payment = exists (
    select 1 from public.payments p
    where p.tab_id = v_order.tab_id and p.participant_id = v_pid and p.status in ('paid', 'partially_refunded')
  ) where id = v_order.id;
  update public.order_items set participant_id = v_pid where order_id = v_order.id;

  -- Everyone at the table who has ordered, this phone included.
  select array_agg(distinct o.participant_id) into v_people
  from public.orders o where o.tab_id = v_order.tab_id and o.participant_id is not null;
  for v_line in select i.id from public.order_items i where i.order_id = v_order.id and i.shared loop
    perform public.split_item_shares(v_line.id, v_people);
  end loop;

  return v_result || jsonb_build_object('participant_id', v_pid);
end;
$$;


ALTER FUNCTION "public"."place_guest_order"("p_restaurant_id" "uuid", "p_table_id" "uuid", "p_client_order_id" "text", "p_lines" "jsonb", "p_guest_language" "public"."app_locale", "p_device_hash" "text", "p_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."place_order"("p_restaurant_id" "uuid", "p_table_id" "uuid", "p_client_order_id" "text", "p_source" "public"."order_source", "p_lines" "jsonb", "p_guest_language" "public"."app_locale" DEFAULT 'es'::"public"."app_locale", "p_created_by" "uuid" DEFAULT NULL::"uuid", "p_device_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_existing record;
  v_tab_id uuid;
  v_tab_status public.tab_status;
  v_number integer;
  v_order_id uuid;
  v_line jsonb;
  v_item public.menu_items%rowtype;
  v_item_id uuid;
  v_qty integer;
  v_note text;
  v_opts uuid[];
  v_group record;
  v_count integer;
  v_mod_total integer;
  v_snap jsonb;
  v_rows jsonb := '[]'::jsonb;
  v_limits record;
  v_order_cents bigint;
  v_tab_cents bigint;
  v_opened boolean := false;
begin
  if p_client_order_id is null or length(p_client_order_id) not between 8 and 100 then
    return jsonb_build_object('status', 'rejected', 'reason', 'validation', 'detail', 'client_order_id');
  end if;

  -- A repeated key returns the order it already created.
  select o.id, o.number into v_existing
  from public.orders o
  where o.restaurant_id = p_restaurant_id and o.idempotency_key = p_client_order_id;
  if found then
    return jsonb_build_object('status', 'accepted', 'order_id', v_existing.id, 'number', v_existing.number, 'replayed', true);
  end if;

  -- Lock the restaurant row: serializes order numbers, tab opening and concurrent retries of one key.
  perform 1 from public.restaurants r where r.id = p_restaurant_id for no key update; -- not FOR UPDATE: it would block the foreign-key checks of payments/orders inserted by another transaction that holds the tab (deadlock)
  if not found then
    return jsonb_build_object('status', 'rejected', 'reason', 'invalid_table', 'detail', 'restaurant');
  end if;

  select o.id, o.number into v_existing
  from public.orders o
  where o.restaurant_id = p_restaurant_id and o.idempotency_key = p_client_order_id;
  if found then
    return jsonb_build_object('status', 'accepted', 'order_id', v_existing.id, 'number', v_existing.number, 'replayed', true);
  end if;

  if not exists (select 1 from public.dining_tables t where t.id = p_table_id and t.restaurant_id = p_restaurant_id) then
    return jsonb_build_object('status', 'rejected', 'reason', 'invalid_table');
  end if;

  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 1 and 50 then
    return jsonb_build_object('status', 'rejected', 'reason', 'validation', 'detail', 'lines');
  end if;

  for v_line in select value from jsonb_array_elements(p_lines) loop
    begin
      v_item_id := (v_line ->> 'itemId')::uuid;
      v_opts := array(
        select (o.value)::uuid
        from jsonb_array_elements_text(coalesce(v_line -> 'modifierOptionIds', '[]'::jsonb)) as o(value)
      );
    exception when others then
      return jsonb_build_object('status', 'rejected', 'reason', 'validation', 'detail', 'line');
    end;

    if jsonb_typeof(v_line -> 'qty') is distinct from 'number'
       or (v_line ->> 'qty')::numeric <> trunc((v_line ->> 'qty')::numeric)
       or (v_line ->> 'qty')::numeric not between 1 and 99 then
      return jsonb_build_object('status', 'rejected', 'reason', 'validation', 'detail', 'qty');
    end if;
    v_qty := (v_line ->> 'qty')::integer;

    v_note := nullif(btrim(v_line ->> 'note'), '');
    if length(v_note) > 200 then
      return jsonb_build_object('status', 'rejected', 'reason', 'validation', 'detail', 'note');
    end if;

    select * into v_item
    from public.menu_items i
    where i.id = v_item_id and i.restaurant_id = p_restaurant_id and i.archived_at is null;
    if not found then
      return jsonb_build_object('status', 'rejected', 'reason', 'validation', 'detail', 'unknown_item');
    end if;
    if not v_item.is_available then
      return jsonb_build_object('status', 'rejected', 'reason', 'item_unavailable', 'detail', v_item.id);
    end if;

    if cardinality(v_opts) <> (select count(distinct x) from unnest(v_opts) as x) then
      return jsonb_build_object('status', 'rejected', 'reason', 'validation', 'detail', 'modifier_duplicate');
    end if;

    -- Every chosen option must belong to a group assigned to this dish.
    if exists (
      select 1
      from unnest(v_opts) as chosen(id)
      where not exists (
        select 1
        from public.modifier_options mo
        join public.item_modifier_groups img on img.group_id = mo.group_id and img.item_id = v_item.id
        where mo.id = chosen.id
      )
    ) then
      return jsonb_build_object('status', 'rejected', 'reason', 'validation', 'detail', 'modifier');
    end if;

    -- Enforce min/max per group.
    for v_group in
      select g.id, g.min_select, g.max_select
      from public.item_modifier_groups img
      join public.modifier_groups g on g.id = img.group_id
      where img.item_id = v_item.id
    loop
      select count(*) into v_count
      from public.modifier_options mo
      where mo.group_id = v_group.id and mo.id = any (v_opts);
      if v_count < v_group.min_select or v_count > v_group.max_select then
        return jsonb_build_object('status', 'rejected', 'reason', 'validation', 'detail', 'modifier_count');
      end if;
    end loop;

    select
      coalesce(sum(mo.price_cents), 0)::integer,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'group_id', g.id, 'group_es', g.name_es, 'group_en', g.name_en,
            'option_id', mo.id, 'name_es', mo.name_es, 'name_en', mo.name_en, 'price_cents', mo.price_cents
          )
          order by img.sort_order, mo.sort_order
        ),
        '[]'::jsonb
      )
    into v_mod_total, v_snap
    from public.modifier_options mo
    join public.modifier_groups g on g.id = mo.group_id
    join public.item_modifier_groups img on img.group_id = g.id and img.item_id = v_item.id
    where mo.id = any (v_opts);

    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'item_id', v_item.id,
      'name_es', v_item.name_es,
      'name_en', v_item.name_en,
      'unit', v_item.price_cents + v_mod_total,
      'qty', v_qty,
      'mods', v_snap,
      'note', v_note,
      'shared', coalesce((v_line ->> 'shared')::boolean, false)
    ));
  end loop;

  select t.id, t.status into v_tab_id, v_tab_status
  from public.tabs t
  where t.table_id = p_table_id and t.status <> 'closed'
  for update;
  if found and v_tab_status = 'paying' then
    return jsonb_build_object('status', 'rejected', 'reason', 'tab_closed');
  end if;

  -- QR orders stay within the restaurant's limits (staff orders never do): per line, per order and
  -- per open tab (plus whatever staff added with "Ampliar límite").
  if p_source = 'qr' then
    select r.qr_max_order_cents, r.qr_max_line_qty, r.qr_max_tab_cents into v_limits
    from public.restaurants r where r.id = p_restaurant_id;
    if exists (select 1 from jsonb_array_elements(v_rows) as r where (r ->> 'qty')::integer > v_limits.qr_max_line_qty) then
      return jsonb_build_object('status', 'rejected', 'reason', 'limit', 'detail', 'line', 'max', v_limits.qr_max_line_qty);
    end if;
    select coalesce(sum((r ->> 'unit')::bigint * (r ->> 'qty')::integer), 0) into v_order_cents
    from jsonb_array_elements(v_rows) as r;
    if v_order_cents > v_limits.qr_max_order_cents then
      return jsonb_build_object('status', 'rejected', 'reason', 'limit', 'detail', 'order', 'max', v_limits.qr_max_order_cents);
    end if;
    select coalesce(sum(i.qty::bigint * i.unit_price_cents), 0) into v_tab_cents
    from public.order_items i join public.orders o on o.id = i.order_id
    where o.tab_id = v_tab_id and o.status <> 'void' and i.voided_at is null;
    if v_tab_cents + v_order_cents > v_limits.qr_max_tab_cents
       + coalesce((select t.qr_limit_extra_cents from public.tabs t where t.id = v_tab_id), 0) then
      return jsonb_build_object('status', 'rejected', 'reason', 'limit', 'detail', 'tab', 'max', v_limits.qr_max_tab_cents);
    end if;
  end if;

  if v_tab_id is null then
    insert into public.tabs (restaurant_id, table_id) values (p_restaurant_id, p_table_id) returning id into v_tab_id;
    v_opened := true;
  end if;

  update public.restaurants r
  set next_order_number = r.next_order_number + 1
  where r.id = p_restaurant_id
  returning r.next_order_number - 1 into v_number;

  insert into public.orders (restaurant_id, tab_id, number, source, idempotency_key, guest_language, created_by, device_id, opened_tab)
  values (p_restaurant_id, v_tab_id, v_number, p_source, p_client_order_id, p_guest_language, p_created_by, p_device_id, v_opened and p_source = 'qr')
  returning id into v_order_id;

  insert into public.order_items (
    restaurant_id, order_id, item_id, name_snapshot_es, name_snapshot_en, unit_price_cents, qty,
    modifiers_snapshot, note, shared
  )
  select
    p_restaurant_id, v_order_id, (r ->> 'item_id')::uuid, r ->> 'name_es', r ->> 'name_en', (r ->> 'unit')::integer,
    (r ->> 'qty')::integer, r -> 'mods', r ->> 'note', (r ->> 'shared')::boolean
  from jsonb_array_elements(v_rows) as r;

  return jsonb_build_object('status', 'accepted', 'order_id', v_order_id, 'number', v_number, 'replayed', false);
end;
$$;


ALTER FUNCTION "public"."place_order"("p_restaurant_id" "uuid", "p_table_id" "uuid", "p_client_order_id" "text", "p_source" "public"."order_source", "p_lines" "jsonb", "p_guest_language" "public"."app_locale", "p_created_by" "uuid", "p_device_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."publish_menu_import"("p_upload_id" "uuid", "p_payload" "jsonb", "p_reviewed_by" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_restaurant_id uuid;
  v_status public.upload_status;
  v_section jsonb;
  v_item jsonb;
  v_group jsonb;
  v_option jsonb;
  v_page jsonb;
  v_section_ids jsonb := '{}'::jsonb;
  v_group_ids jsonb := '{}'::jsonb;
  v_page_ids jsonb := '{}'::jsonb;
  v_id uuid;
  v_item_id uuid;
  v_section_order integer := 0;
  v_item_order integer := 0;
  v_page_number integer := 0;
  v_kept_items uuid[] := '{}';
  v_kept_sections uuid[] := '{}';
  v_key text;
  v_sort integer;
begin
  -- Lets the price-change audit trigger name the reviewer (server code calls this as service_role).
  perform set_config('mezza.actor_id', coalesce(p_reviewed_by::text, ''), true);

  select u.restaurant_id, u.status into v_restaurant_id, v_status
  from public.menu_uploads u where u.id = p_upload_id
  for update;
  if not found then
    raise exception 'menu upload % not found', p_upload_id using errcode = 'P0002';
  end if;
  if v_status <> 'review' then
    raise exception 'menu upload % is %, expected review', p_upload_id, v_status using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(coalesce(p_payload -> 'items', '[]'::jsonb)) as i
    where jsonb_typeof(i -> 'priceCents') is distinct from 'number' or (i ->> 'priceCents')::numeric < 0
       or (i ->> 'priceCents')::numeric <> trunc((i ->> 'priceCents')::numeric)
  ) then
    raise exception 'every item needs a confirmed price in cents' using errcode = '22023';
  end if;

  -- Sections
  for v_section in select value from jsonb_array_elements(coalesce(p_payload -> 'sections', '[]'::jsonb)) loop
    select s.id into v_id from public.menu_sections s
    where s.restaurant_id = v_restaurant_id and lower(s.name_es) = lower(v_section ->> 'nameEs')
    order by s.archived_at nulls first limit 1;
    if v_id is null then
      insert into public.menu_sections (restaurant_id, name_es, name_en, sort_order)
      values (v_restaurant_id, v_section ->> 'nameEs', v_section ->> 'nameEn', v_section_order)
      returning id into v_id;
    else
      update public.menu_sections
      set name_es = v_section ->> 'nameEs', name_en = v_section ->> 'nameEn', sort_order = v_section_order, archived_at = null
      where id = v_id;
    end if;
    v_section_ids := v_section_ids || jsonb_build_object(v_section ->> 'key', v_id);
    v_kept_sections := v_kept_sections || v_id;
    v_section_order := v_section_order + 1;
    v_id := null;
  end loop;

  -- Modifier groups (matched by Spanish name; options replaced, past orders keep their snapshots)
  for v_group in select value from jsonb_array_elements(coalesce(p_payload -> 'modifierGroups', '[]'::jsonb)) loop
    select g.id into v_id from public.modifier_groups g
    where g.restaurant_id = v_restaurant_id and lower(g.name_es) = lower(v_group ->> 'nameEs') limit 1;
    if v_id is null then
      insert into public.modifier_groups (restaurant_id, name_es, name_en, min_select, max_select)
      values (v_restaurant_id, v_group ->> 'nameEs', v_group ->> 'nameEn', (v_group ->> 'min')::integer, (v_group ->> 'max')::integer)
      returning id into v_id;
    else
      update public.modifier_groups
      set name_en = v_group ->> 'nameEn', min_select = (v_group ->> 'min')::integer, max_select = (v_group ->> 'max')::integer
      where id = v_id;
      delete from public.modifier_options where group_id = v_id;
    end if;
    v_sort := 0;
    for v_option in select value from jsonb_array_elements(coalesce(v_group -> 'options', '[]'::jsonb)) loop
      insert into public.modifier_options (restaurant_id, group_id, name_es, name_en, price_cents, sort_order)
      values (v_restaurant_id, v_id, v_option ->> 'nameEs', v_option ->> 'nameEn', coalesce((v_option ->> 'priceCents')::integer, 0), v_sort);
      v_sort := v_sort + 1;
    end loop;
    v_group_ids := v_group_ids || jsonb_build_object(v_group ->> 'key', v_id);
    v_id := null;
  end loop;

  -- Pages (replaced; hotspots go with them)
  delete from public.original_menu_pages where restaurant_id = v_restaurant_id;
  for v_page in select value from jsonb_array_elements(coalesce(p_payload -> 'pages', '[]'::jsonb)) loop
    v_page_number := v_page_number + 1;
    insert into public.original_menu_pages (restaurant_id, image_path, width, height, page_number)
    values (v_restaurant_id, v_page ->> 'storagePath', (v_page ->> 'width')::integer, (v_page ->> 'height')::integer, v_page_number)
    returning id into v_id;
    v_page_ids := v_page_ids || jsonb_build_object(v_page_number::text, v_id);
  end loop;

  -- Items
  for v_item in select value from jsonb_array_elements(coalesce(p_payload -> 'items', '[]'::jsonb)) loop
    if not (v_section_ids ? (v_item ->> 'sectionKey')) then
      raise exception 'item % references unknown section %', v_item ->> 'nameEs', v_item ->> 'sectionKey' using errcode = '22023';
    end if;
    select i.id into v_item_id from public.menu_items i
    where i.restaurant_id = v_restaurant_id and lower(i.name_es) = lower(v_item ->> 'nameEs')
    order by i.archived_at nulls first limit 1;
    if v_item_id is null then
      insert into public.menu_items (
        restaurant_id, section_id, name_es, name_en, description_es, description_en, price_cents, ai_confidence, sort_order
      ) values (
        v_restaurant_id, (v_section_ids ->> (v_item ->> 'sectionKey'))::uuid, v_item ->> 'nameEs', v_item ->> 'nameEn',
        v_item ->> 'descriptionEs', v_item ->> 'descriptionEn', (v_item ->> 'priceCents')::integer,
        (v_item ->> 'confidence')::numeric, v_item_order
      ) returning id into v_item_id;
    else
      -- Price changes are audited by the menu_items_audit_price trigger.
      update public.menu_items set
        section_id = (v_section_ids ->> (v_item ->> 'sectionKey'))::uuid,
        name_es = v_item ->> 'nameEs', name_en = v_item ->> 'nameEn',
        description_es = v_item ->> 'descriptionEs', description_en = v_item ->> 'descriptionEn',
        price_cents = (v_item ->> 'priceCents')::integer, ai_confidence = (v_item ->> 'confidence')::numeric,
        sort_order = v_item_order, archived_at = null
      where id = v_item_id;
    end if;

    delete from public.item_modifier_groups where item_id = v_item_id;
    v_sort := 0;
    for v_key in select value from jsonb_array_elements_text(coalesce(v_item -> 'modifierGroupKeys', '[]'::jsonb)) loop
      if not (v_group_ids ? v_key) then
        raise exception 'item % references unknown modifier group %', v_item ->> 'nameEs', v_key using errcode = '22023';
      end if;
      insert into public.item_modifier_groups (restaurant_id, item_id, group_id, sort_order)
      values (v_restaurant_id, v_item_id, (v_group_ids ->> v_key)::uuid, v_sort);
      v_sort := v_sort + 1;
    end loop;

    if v_item ? 'hotspot' and jsonb_typeof(v_item -> 'hotspot') = 'object' then
      if not (v_page_ids ? (v_item -> 'hotspot' ->> 'page')) then
        raise exception 'hotspot for % references unknown page', v_item ->> 'nameEs' using errcode = '22023';
      end if;
      insert into public.item_hotspots (restaurant_id, item_id, page_id, x, y, width, height)
      values (
        v_restaurant_id, v_item_id, (v_page_ids ->> (v_item -> 'hotspot' ->> 'page'))::uuid,
        (v_item -> 'hotspot' ->> 'x')::numeric, (v_item -> 'hotspot' ->> 'y')::numeric,
        (v_item -> 'hotspot' ->> 'width')::numeric, (v_item -> 'hotspot' ->> 'height')::numeric
      );
    end if;

    v_kept_items := v_kept_items || v_item_id;
    v_item_order := v_item_order + 1;
    v_item_id := null;
  end loop;

  update public.menu_items set archived_at = now()
  where restaurant_id = v_restaurant_id and archived_at is null and not (id = any (v_kept_items));
  update public.menu_sections set archived_at = now()
  where restaurant_id = v_restaurant_id and archived_at is null and not (id = any (v_kept_sections));

  -- Theme
  if p_payload ? 'theme' then
    insert into public.menu_themes (restaurant_id, palette, display_font, body_font, ornament, paper_texture)
    values (
      v_restaurant_id, p_payload -> 'theme' -> 'palette', p_payload -> 'theme' ->> 'displayFont',
      p_payload -> 'theme' ->> 'bodyFont', p_payload -> 'theme' ->> 'ornament',
      coalesce((p_payload -> 'theme' ->> 'paperTexture')::public.paper_texture, 'none')
    )
    on conflict (restaurant_id) do update set
      palette = excluded.palette, display_font = excluded.display_font, body_font = excluded.body_font,
      ornament = excluded.ornament, paper_texture = excluded.paper_texture;
  end if;

  update public.menu_uploads
  set status = 'published', published_at = now(), reviewed_by = p_reviewed_by, ai_result = p_payload
  where id = p_upload_id;

  return jsonb_build_object(
    'sections', cardinality(v_kept_sections),
    'items', cardinality(v_kept_items),
    'modifier_groups', (select count(*) from jsonb_object_keys(v_group_ids)),
    'pages', v_page_number
  );
end;
$$;


ALTER FUNCTION "public"."publish_menu_import"("p_upload_id" "uuid", "p_payload" "jsonb", "p_reviewed_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."publish_original_menu_image"("p_upload_id" "uuid", "p_width" integer, "p_height" integer, "p_reviewed_by" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  v_upload public.menu_uploads%rowtype;
  v_page_id uuid;
begin
  select * into v_upload from public.menu_uploads where id = p_upload_id for update;
  if not found then
    raise exception 'menu upload not found' using errcode = 'P0002';
  end if;
  if p_width is null or p_height is null or p_width <= 0 or p_height <= 0
     or p_width::bigint * p_height::bigint > 40000000 then
    raise exception 'invalid image dimensions' using errcode = '22023';
  end if;
  if not exists (select 1 from public.memberships
    where restaurant_id = v_upload.restaurant_id and user_id = p_reviewed_by
      and active and role in ('owner', 'manager')) then
    raise exception 'menu publication requires an active owner or manager' using errcode = '42501';
  end if;
  if v_upload.mime_type not in ('image/jpeg', 'image/png')
     or v_upload.storage_path not like v_upload.restaurant_id::text || '/uploads/%'
     or not exists (select 1 from storage.objects where bucket_id = 'menus' and name = v_upload.storage_path) then
    raise exception 'original uploaded image is missing or invalid' using errcode = '22023';
  end if;
  -- Serialize image replacement across different uploads for the same restaurant.
  perform 1 from public.restaurants where id = v_upload.restaurant_id for update;
  -- A retry must not erase manually assigned tap zones for the same image.
  if v_upload.status = 'published' then
    select id into v_page_id from public.original_menu_pages
      where restaurant_id = v_upload.restaurant_id and image_path = v_upload.storage_path;
    if v_page_id is null then
      raise exception 'published image has since been replaced' using errcode = '22023';
    end if;
    return v_page_id;
  end if;
  if v_upload.status not in ('processing', 'review') then
    raise exception 'upload cannot be published' using errcode = '22023';
  end if;
  -- Old zones refer to the old page layout; their foreign keys cascade on replacement.
  delete from public.original_menu_pages where restaurant_id = v_upload.restaurant_id;
  insert into public.original_menu_pages (restaurant_id, image_path, width, height, page_number)
    values (v_upload.restaurant_id, v_upload.storage_path, p_width, p_height, 1)
    returning id into v_page_id;
  update public.menu_uploads set status = 'published', reviewed_by = p_reviewed_by,
    published_at = now(), ai_result = jsonb_build_object('kind', 'original_image', 'pages',
      jsonb_build_array(jsonb_build_object('storagePath', v_upload.storage_path,
        'width', p_width, 'height', p_height))) where id = p_upload_id;
  return v_page_id;
end;
$$;


ALTER FUNCTION "public"."publish_original_menu_image"("p_upload_id" "uuid", "p_width" integer, "p_height" integer, "p_reviewed_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."raise_tab_limit"("p_tab_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_tab public.tabs%rowtype;
  v_cap integer;
begin
  select * into v_tab from public.tabs where id = p_tab_id for update;
  if not found or not public.has_role(v_tab.restaurant_id, array['owner', 'manager', 'server']::public.member_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if v_tab.status = 'closed' then
    raise exception 'tab is closed' using errcode = '22023';
  end if;
  select r.qr_max_tab_cents into v_cap from public.restaurants r where r.id = v_tab.restaurant_id;
  update public.tabs set qr_limit_extra_cents = qr_limit_extra_cents + v_cap where id = p_tab_id;
  insert into public.audit_log (restaurant_id, actor_id, action, target_table, target_id, before, after)
  values (v_tab.restaurant_id, (select auth.uid()), 'limit_change', 'tabs', p_tab_id,
    jsonb_build_object('cap_cents', v_cap + v_tab.qr_limit_extra_cents),
    jsonb_build_object('cap_cents', v_cap * 2 + v_tab.qr_limit_extra_cents));
  return v_cap * 2 + v_tab.qr_limit_extra_cents;
end;
$$;


ALTER FUNCTION "public"."raise_tab_limit"("p_tab_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rate_limit_hit"("p_key" "text", "p_max" integer, "p_window_seconds" integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_hits integer;
begin
  if p_key is null or length(p_key) > 200 or p_max < 1 or p_window_seconds not between 1 and 86400 then
    raise exception 'invalid rate limit' using errcode = '22023';
  end if;
  insert into public.rate_limits as l (key, window_start, hits) values (p_key, now(), 1)
  on conflict (key) do update set
    hits = case when l.window_start <= now() - make_interval(secs => p_window_seconds) then 1 else l.hits + 1 end,
    window_start = case when l.window_start <= now() - make_interval(secs => p_window_seconds) then now() else l.window_start end
  returning hits into v_hits;
  -- Bounded cleanup of windows nobody has touched for a day.
  delete from public.rate_limits where key in (
    select key from public.rate_limits where window_start < now() - interval '1 day' limit 50 for update skip locked
  );
  return v_hits <= p_max;
end;
$$;


ALTER FUNCTION "public"."rate_limit_hit"("p_key" "text", "p_max" integer, "p_window_seconds" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_refund"("p_payment_id" "uuid", "p_amount_cents" integer, "p_reason" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_payment public.payments%rowtype;
  v_refunded integer;
  v_total integer;
  v_refund_id uuid;
  v_actor uuid := (select auth.uid());
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found or not public.has_role(v_payment.restaurant_id, array['owner', 'manager']::public.member_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if v_payment.status not in ('paid', 'partially_refunded') then
    raise exception 'only paid payments can be refunded' using errcode = '22023';
  end if;
  if p_reason is null or length(btrim(p_reason)) = 0 then
    raise exception 'a reason is required' using errcode = '22023';
  end if;

  v_total := v_payment.amount_cents + v_payment.ivu_state_cents + v_payment.ivu_municipal_cents + v_payment.tip_cents;
  select coalesce(sum(amount_cents), 0) into v_refunded from public.refunds where payment_id = p_payment_id;
  if p_amount_cents is null or p_amount_cents <= 0 or v_refunded + p_amount_cents > v_total then
    raise exception 'refund exceeds the amount paid' using errcode = '22023';
  end if;

  insert into public.refunds (restaurant_id, payment_id, amount_cents, reason, approved_by)
  values (v_payment.restaurant_id, p_payment_id, p_amount_cents, p_reason, v_actor)
  returning id into v_refund_id;

  update public.payments
  set status = case when v_refunded + p_amount_cents = v_total then 'refunded' else 'partially_refunded' end::public.payment_status
  where id = p_payment_id;

  insert into public.audit_log (restaurant_id, actor_id, action, target_table, target_id, before, after)
  values (
    v_payment.restaurant_id, v_actor, 'refund', 'payments', p_payment_id,
    jsonb_build_object('status', v_payment.status, 'refunded_cents', v_refunded),
    jsonb_build_object('refund_id', v_refund_id, 'amount_cents', p_amount_cents, 'reason', p_reason)
  );
  return v_refund_id;
end;
$$;


ALTER FUNCTION "public"."record_refund"("p_payment_id" "uuid", "p_amount_cents" integer, "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_sales_summaries"("p_restaurant_id" "uuid", "p_from" "date", "p_to" "date") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_tz text;
begin
  select r.timezone into v_tz from public.restaurants r where r.id = p_restaurant_id;
  if v_tz is null then
    raise exception 'restaurant % not found', p_restaurant_id using errcode = 'P0002';
  end if;

  delete from public.daily_sales where restaurant_id = p_restaurant_id and date between p_from and p_to;
  delete from public.item_sales_daily where restaurant_id = p_restaurant_id and date between p_from and p_to;

  insert into public.daily_sales (
    restaurant_id, date, hour, sales_cents, ivu_state_cents, ivu_municipal_cents, tips_cents,
    covers, orders, card_cents, ath_cents, cash_cents
  )
  with pay as (
    select (p.paid_at at time zone v_tz) as lt, p.method, p.amount_cents, p.ivu_state_cents, p.ivu_municipal_cents, p.tip_cents
    from public.payments p
    where p.restaurant_id = p_restaurant_id
      and p.status in ('paid', 'partially_refunded', 'refunded')
      and p.paid_at is not null
      and (p.paid_at at time zone v_tz)::date between p_from and p_to
  ),
  pay_agg as (
    select lt::date as d, extract(hour from lt)::integer as h,
      sum(amount_cents) as sales, sum(ivu_state_cents) as ivu_s, sum(ivu_municipal_cents) as ivu_m, sum(tip_cents) as tips,
      coalesce(sum(amount_cents) filter (where method = 'card'), 0) as card,
      coalesce(sum(amount_cents) filter (where method = 'ath'), 0) as ath,
      coalesce(sum(amount_cents) filter (where method = 'cash'), 0) as cash
    from pay group by 1, 2
  ),
  ord_agg as (
    select (o.created_at at time zone v_tz)::date as d, extract(hour from (o.created_at at time zone v_tz))::integer as h,
      count(*) as n
    from public.orders o
    where o.restaurant_id = p_restaurant_id and o.status <> 'void'
      and (o.created_at at time zone v_tz)::date between p_from and p_to
    group by 1, 2
  ),
  cov_agg as (
    select (t.opened_at at time zone v_tz)::date as d, extract(hour from (t.opened_at at time zone v_tz))::integer as h,
      sum(coalesce(t.party_size, 1)) as covers
    from public.tabs t
    where t.restaurant_id = p_restaurant_id
      and (t.opened_at at time zone v_tz)::date between p_from and p_to
      and exists (select 1 from public.orders o where o.tab_id = t.id and o.status <> 'void')
    group by 1, 2
  ),
  keys as (
    select d, h from pay_agg union select d, h from ord_agg union select d, h from cov_agg
  )
  select p_restaurant_id, k.d, k.h,
    coalesce(p.sales, 0), coalesce(p.ivu_s, 0), coalesce(p.ivu_m, 0), coalesce(p.tips, 0),
    coalesce(c.covers, 0), coalesce(o.n, 0), coalesce(p.card, 0), coalesce(p.ath, 0), coalesce(p.cash, 0)
  from keys k
  left join pay_agg p on p.d = k.d and p.h = k.h
  left join ord_agg o on o.d = k.d and o.h = k.h
  left join cov_agg c on c.d = k.d and c.h = k.h;

  insert into public.item_sales_daily (restaurant_id, item_id, date, units, revenue_cents, modifier_count)
  select p_restaurant_id, oi.item_id, (o.created_at at time zone v_tz)::date,
    sum(oi.qty), sum(oi.qty * oi.unit_price_cents),
    -- "With extras": an option from an optional group, or a paid upgrade in any group. Required
    -- free choices (which milk, which bread) don't count.
    coalesce(sum(oi.qty) filter (where exists (
      select 1
      from jsonb_array_elements(oi.modifiers_snapshot) s
      left join public.modifier_options mo on mo.id = (s ->> 'option_id')::uuid
      left join public.modifier_groups g on g.id = coalesce(mo.group_id, (s ->> 'group_id')::uuid)
      -- A re-imported menu has new option ids; fall back to the group's name.
      left join lateral (
        select g2.min_select from public.modifier_groups g2
        where g2.restaurant_id = oi.restaurant_id and g2.name_es = s ->> 'group_es'
        limit 1
      ) gn on g.id is null
      where coalesce((s ->> 'price_cents')::int, 0) > 0 or coalesce(g.min_select, gn.min_select) = 0
    )), 0)
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.restaurant_id = p_restaurant_id
    and oi.item_id is not null
    and oi.voided_at is null
    and o.status <> 'void'
    and (o.created_at at time zone v_tz)::date between p_from and p_to
  group by oi.item_id, (o.created_at at time zone v_tz)::date;
end;
$$;


ALTER FUNCTION "public"."refresh_sales_summaries"("p_restaurant_id" "uuid", "p_from" "date", "p_to" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rename_participant"("p_tab_id" "uuid", "p_device_hash" "text", "p_name" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_pid uuid;
begin
  p_name := nullif(btrim(p_name), '');
  select p.id into v_pid from public.tab_participants p
  join public.tabs t on t.id = p.tab_id
  where p.tab_id = p_tab_id and p.device_hash = p_device_hash and t.status <> 'closed'
  for update of p;
  if v_pid is null then
    raise exception 'not a participant' using errcode = '42501';
  end if;
  if p_name is not null and exists (
    select 1 from public.tab_participants p where p.tab_id = p_tab_id and p.id <> v_pid and lower(p.display_name) = lower(p_name)
  ) then
    return 'name_taken';
  end if;
  update public.tab_participants set display_name = p_name where id = v_pid;
  return 'ok';
end;
$$;


ALTER FUNCTION "public"."rename_participant"("p_tab_id" "uuid", "p_device_hash" "text", "p_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."report_summary"("p_restaurant_id" "uuid", "p_from" "date", "p_to" "date") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
declare
  v_tz text;
  v_start timestamptz;
  v_end timestamptz;
  v_result jsonb;
begin
  if not public.has_role(p_restaurant_id, '{owner,manager}'::public.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then
    raise exception 'invalid range' using errcode = '22023';
  end if;
  select r.timezone into v_tz from public.restaurants r where r.id = p_restaurant_id;
  v_start := p_from::timestamp at time zone v_tz;
  v_end := (p_to + 1)::timestamp at time zone v_tz;

  select jsonb_build_object(
    -- Totals for the range (gross; refunds are reported on their own).
    'totals', (
      select jsonb_build_object(
        'sales', coalesce(sum(d.sales_cents), 0),
        'ivuState', coalesce(sum(d.ivu_state_cents), 0),
        'ivuMunicipal', coalesce(sum(d.ivu_municipal_cents), 0),
        'tips', coalesce(sum(d.tips_cents), 0),
        'covers', coalesce(sum(d.covers), 0),
        'orders', coalesce(sum(d.orders), 0),
        'card', coalesce(sum(d.card_cents), 0),
        'ath', coalesce(sum(d.ath_cents), 0),
        'cash', coalesce(sum(d.cash_cents), 0),
        'refunds', (
          select coalesce(sum(f.amount_cents), 0) from public.refunds f
          where f.restaurant_id = p_restaurant_id and f.created_at >= v_start and f.created_at < v_end
        )
      )
      from public.daily_sales d
      where d.restaurant_id = p_restaurant_id and d.date between p_from and p_to
    ),
    -- 1. Heat map: sales by ISO weekday (1 = Monday) and hour.
    'heat', (
      select coalesce(jsonb_agg(jsonb_build_object('dow', x.dow, 'hour', x.hour, 'sales', x.sales) order by x.dow, x.hour), '[]')
      from (
        select extract(isodow from d.date)::int as dow, d.hour, sum(d.sales_cents) as sales
        from public.daily_sales d
        where d.restaurant_id = p_restaurant_id and d.date between p_from and p_to
        group by 1, 2
      ) x
    ),
    -- 2. Sales per day, starting a week before the range so each day has its "same day last week".
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('date', x.date, 'sales', x.sales, 'orders', x.orders, 'covers', x.covers) order by x.date), '[]')
      from (
        select d.date, sum(d.sales_cents) as sales, sum(d.orders) as orders, sum(d.covers) as covers
        from public.daily_sales d
        where d.restaurant_id = p_restaurant_id and d.date between p_from - 7 and p_to
        group by d.date
      ) x
    ),
    -- 3. Covers and average check per table: tabs opened in the range that were paid.
    'tables', (
      select coalesce(jsonb_agg(jsonb_build_object('label', x.label, 'tabs', x.tabs, 'covers', x.covers, 'sales', x.sales) order by x.label), '[]')
      from (
        select dt.label, count(*) as tabs, sum(coalesce(t.party_size, 1)) as covers, sum(ts.sales) as sales
        from public.tabs t
        join public.dining_tables dt on dt.id = t.table_id
        join lateral (
          select sum(p.amount_cents) as sales from public.payments p
          where p.tab_id = t.id and p.status in ('paid', 'partially_refunded', 'refunded')
        ) ts on ts.sales is not null
        where t.restaurant_id = p_restaurant_id and t.opened_at >= v_start and t.opened_at < v_end
        group by dt.label
      ) x
    ),
    -- 4. Payment mix by method, with tips (tip % is over the pre-tax amount).
    'methods', (
      select coalesce(jsonb_agg(jsonb_build_object('method', x.method, 'count', x.n, 'amount', x.amount, 'tips', x.tips) order by x.method), '[]')
      from (
        select p.method, count(*) as n, sum(p.amount_cents) as amount, sum(p.tip_cents) as tips
        from public.payments p
        where p.restaurant_id = p_restaurant_id and p.status in ('paid', 'partially_refunded', 'refunded')
          and p.paid_at >= v_start and p.paid_at < v_end
        group by p.method
      ) x
    ),
    -- 5. IVU by month.
    'ivuMonthly', (
      select coalesce(jsonb_agg(jsonb_build_object('month', x.month, 'sales', x.sales, 'state', x.st, 'municipal', x.mu) order by x.month), '[]')
      from (
        select to_char(date_trunc('month', d.date), 'YYYY-MM') as month,
          sum(d.sales_cents) as sales, sum(d.ivu_state_cents) as st, sum(d.ivu_municipal_cents) as mu
        from public.daily_sales d
        where d.restaurant_id = p_restaurant_id and d.date between p_from and p_to
        group by 1
      ) x
    ),
    -- 6 and 7. Every dish on the menu (plus archived ones that sold): units, revenue, modifier rate.
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', m.id, 'nameEs', m.name_es, 'nameEn', m.name_en, 'archived', m.archived_at is not null,
        'units', coalesce(s.units, 0), 'revenue', coalesce(s.revenue, 0), 'withModifiers', coalesce(s.mods, 0),
        'hasModifiers', exists (
          select 1 from public.item_modifier_groups img
          join public.modifier_groups g on g.id = img.group_id
          where img.item_id = m.id
            and (g.min_select = 0 or exists (select 1 from public.modifier_options o where o.group_id = g.id and o.price_cents > 0))
        )
      ) order by m.sort_order, m.name_es), '[]')
      from public.menu_items m
      left join (
        select i.item_id, sum(i.units) as units, sum(i.revenue_cents) as revenue, sum(i.modifier_count) as mods
        from public.item_sales_daily i
        where i.restaurant_id = p_restaurant_id and i.date between p_from and p_to
        group by i.item_id
      ) s on s.item_id = m.id
      where m.restaurant_id = p_restaurant_id and (m.archived_at is null or s.units > 0)
    ),
    -- 8. Time sold out, and an estimate of the sales lost meanwhile: for every hour a dish was sold
    -- out, its average units in that same weekday-hour over the prior 4 weeks, times its price.
    'soldOut', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', x.item_id, 'nameEs', m.name_es, 'nameEn', m.name_en, 'events', x.events,
        'hours', round(x.hours::numeric, 2), 'lostUnits', round(x.lost_units::numeric, 2),
        'lostRevenue', round(x.lost_units * m.price_cents)
      ) order by x.lost_units desc, x.hours desc), '[]')
      from (
        with ev as materialized (
          select a.id, a.item_id, greatest(a.sold_out_at, v_start) as s, least(coalesce(a.back_at, now()), v_end) as e
          from public.item_availability_events a
          where a.restaurant_id = p_restaurant_id and a.sold_out_at < v_end and coalesce(a.back_at, now()) > v_start
        ),
        -- Units per dish per clock hour, over the range and the 4 weeks before it (one pass).
        hourly as materialized (
          select oi.item_id, date_trunc('hour', o.created_at) as slot, sum(oi.qty) as units
          from public.order_items oi
          join public.orders o on o.id = oi.order_id
          where oi.restaurant_id = p_restaurant_id and o.restaurant_id = p_restaurant_id
            and oi.item_id in (select ev.item_id from ev)
            and oi.voided_at is null and o.status <> 'void'
            and o.created_at >= v_start - interval '28 days' and o.created_at < v_end
          group by 1, 2
        ),
        w as (
          select ev.id as event_id, ev.item_id,
            extract(epoch from (least(h.slot + interval '1 hour', ev.e) - greatest(h.slot, ev.s))) / 3600.0 as frac,
            (
              select coalesce(sum(hr.units), 0) / 4.0 from hourly hr
              where hr.item_id = ev.item_id
                and hr.slot in (h.slot - interval '7 days', h.slot - interval '14 days', h.slot - interval '21 days', h.slot - interval '28 days')
            ) as baseline
          from ev
          cross join lateral generate_series(date_trunc('hour', ev.s), ev.e - interval '1 microsecond', interval '1 hour') as h(slot)
          where ev.e > ev.s
        )
        select w.item_id, count(distinct w.event_id) as events, sum(w.frac) as hours, sum(w.frac * w.baseline) as lost_units
        from w
        group by w.item_id
      ) x
      join public.menu_items m on m.id = x.item_id
    ),
    -- 9 and 10. Where orders came from, and which menu language guests used (QR orders only:
    -- staff orders are always entered in Spanish).
    'sources', (
      select coalesce(jsonb_agg(jsonb_build_object('source', x.source, 'language', x.lang, 'count', x.n)), '[]')
      from (
        select o.source, o.guest_language as lang, count(*) as n
        from public.orders o
        where o.restaurant_id = p_restaurant_id and o.status <> 'void'
          and o.created_at >= v_start and o.created_at < v_end
        group by 1, 2
      ) x
    )
  ) into v_result;

  return v_result;
end;
$$;


ALTER FUNCTION "public"."report_summary"("p_restaurant_id" "uuid", "p_from" "date", "p_to" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_item_availability"("p_item_id" "uuid", "p_available" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_item public.menu_items%rowtype;
begin
  select * into v_item from public.menu_items where id = p_item_id for update;
  if not found or not public.has_role(v_item.restaurant_id, array['owner', 'manager', 'kitchen']::public.member_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if v_item.is_available = p_available then
    return;
  end if;
  if p_available then
    update public.menu_items set is_available = true, sold_out_since = null where id = p_item_id;
    update public.item_availability_events set back_at = now() where item_id = p_item_id and back_at is null;
  else
    update public.menu_items set is_available = false, sold_out_since = now() where id = p_item_id;
    insert into public.item_availability_events (restaurant_id, item_id, sold_out_at)
    values (v_item.restaurant_id, p_item_id, now());
  end if;
end;
$$;


ALTER FUNCTION "public"."set_item_availability"("p_item_id" "uuid", "p_available" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_item_shares"("p_order_item_id" "uuid", "p_participants" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_item record;
begin
  select i.id, i.restaurant_id, i.shared, i.voided_at, o.tab_id, t.status as tab_status into v_item
  from public.order_items i
  join public.orders o on o.id = i.order_id
  join public.tabs t on t.id = o.tab_id
  where i.id = p_order_item_id
  for update of i;
  if not found or not public.has_role(v_item.restaurant_id, array['owner', 'manager', 'server']::public.member_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not v_item.shared or v_item.voided_at is not null or v_item.tab_status <> 'open' then
    raise exception 'line cannot be re-shared' using errcode = '22023';
  end if;
  -- Once money touches the line (a payment that hasn't failed, or an even-split plan), its shares stay.
  if exists (
    select 1 from public.payment_allocations a join public.payments p on p.id = a.payment_id
    where a.order_item_id = p_order_item_id and p.status <> 'failed'
  ) or exists (
    select 1 from public.split_plan_units u join public.split_plans sp on sp.id = u.plan_id
    where u.order_item_id = p_order_item_id and sp.status = 'active'
  ) then
    raise exception 'line has payments' using errcode = '22023';
  end if;
  if coalesce(cardinality(p_participants), 0) = 0 or exists (
    select 1 from unnest(p_participants) as x(id)
    where not exists (select 1 from public.tab_participants p where p.id = x.id and p.tab_id = v_item.tab_id)
  ) then
    raise exception 'participants must be at this table' using errcode = '22023';
  end if;

  perform public.split_item_shares(p_order_item_id, (select array_agg(distinct x) from unnest(p_participants) as x));

  insert into public.audit_log (restaurant_id, actor_id, action, target_table, target_id, after)
  values (v_item.restaurant_id, (select auth.uid()), 'shares', 'order_items', p_order_item_id,
    jsonb_build_object('participants', p_participants));
end;
$$;


ALTER FUNCTION "public"."set_item_shares"("p_order_item_id" "uuid", "p_participants" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_order_status"("p_order_id" "uuid", "p_status" "public"."order_status") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or not public.has_role(v_order.restaurant_id, array['owner', 'manager', 'server', 'kitchen']::public.member_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_status = 'void' or v_order.status = 'void' then
    raise exception 'use void_order to void an order' using errcode = '22023';
  end if;
  update public.orders set status = p_status where id = p_order_id;
  update public.order_items set status = p_status where order_id = p_order_id and voided_at is null;
end;
$$;


ALTER FUNCTION "public"."set_order_status"("p_order_id" "uuid", "p_status" "public"."order_status") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."split_item_shares"("p_order_item_id" "uuid", "p_participants" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_item record;
  v_total integer;
  v_n integer := coalesce(cardinality(p_participants), 0);
begin
  select i.restaurant_id, i.qty * i.unit_price_cents as total into v_item
  from public.order_items i where i.id = p_order_item_id;
  v_total := v_item.total;
  delete from public.order_item_shares where order_item_id = p_order_item_id;
  if v_n = 0 then
    return;
  end if;
  insert into public.order_item_shares (restaurant_id, order_item_id, participant_id, cents)
  select v_item.restaurant_id, p_order_item_id, p.id,
    v_total / v_n + case when row_number() over (order by p.guest_number, p.id) <= v_total % v_n then 1 else 0 end
  from public.tab_participants p
  where p.id = any (p_participants);
end;
$$;


ALTER FUNCTION "public"."split_item_shares"("p_order_item_id" "uuid", "p_participants" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."split_plan_left"("p_plan_id" "uuid", OUT "amount_left" bigint, OUT "parts_left" integer) RETURNS "record"
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select
    coalesce((select sum(c.c_cents - c.c_covered) from public.tab_charges(sp.tab_id) c where c.c_plan = sp.id), 0),
    sp.parts - coalesce((
      select sum(p.plan_parts) from public.payments p where p.plan_id = sp.id and p.status <> 'failed'
    ), 0)::integer
  from public.split_plans sp where sp.id = p_plan_id
$$;


ALTER FUNCTION "public"."split_plan_left"("p_plan_id" "uuid", OUT "amount_left" bigint, OUT "parts_left" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."start_split_plan"("p_tab_id" "uuid", "p_parts" integer, "p_by_participant" "uuid" DEFAULT NULL::"uuid", "p_by_user" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_tab public.tabs%rowtype;
  v_plan uuid;
  v_existing public.split_plans%rowtype;
begin
  select * into v_tab from public.tabs where id = p_tab_id for update;
  if not found or v_tab.status = 'closed' then
    return jsonb_build_object('status', 'rejected', 'reason', 'tab_closed');
  end if;
  if p_parts is null or p_parts not between 2 and 20 then
    return jsonb_build_object('status', 'rejected', 'reason', 'validation', 'detail', 'parts');
  end if;
  if p_by_participant is not null and not exists (
    select 1 from public.tab_participants where id = p_by_participant and tab_id = p_tab_id
  ) then
    return jsonb_build_object('status', 'rejected', 'reason', 'validation', 'detail', 'participant');
  end if;

  v_plan := public.active_split_plan(p_tab_id);
  if v_plan is not null then
    select * into v_existing from public.split_plans where id = v_plan;
    if v_existing.parts = p_parts then
      return jsonb_build_object('status', 'accepted', 'plan_id', v_plan, 'parts', p_parts, 'existing', true);
    end if;
    return jsonb_build_object('status', 'rejected', 'reason', 'plan_exists', 'plan_id', v_plan, 'parts', v_existing.parts);
  end if;

  if not exists (select 1 from public.tab_charges(p_tab_id) c where c.c_cents > c.c_covered) then
    return jsonb_build_object('status', 'rejected', 'reason', 'nothing_to_pay');
  end if;
  insert into public.split_plans (restaurant_id, tab_id, parts, created_by_participant, created_by_user)
  values (v_tab.restaurant_id, p_tab_id, p_parts, p_by_participant, p_by_user)
  returning id into v_plan;
  insert into public.split_plan_units (restaurant_id, plan_id, order_item_id, share_id)
  select v_tab.restaurant_id, v_plan, c.c_item, c.c_share
  from public.tab_charges(p_tab_id) c where c.c_cents > c.c_covered;
  return jsonb_build_object('status', 'accepted', 'plan_id', v_plan, 'parts', p_parts, 'existing', false);
end;
$$;


ALTER FUNCTION "public"."start_split_plan"("p_tab_id" "uuid", "p_parts" integer, "p_by_participant" "uuid", "p_by_user" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."storage_restaurant_id"("p_name" "text") RETURNS "uuid"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $_$
  select case
    when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(p_name, '/', 1)::uuid
  end;
$_$;


ALTER FUNCTION "public"."storage_restaurant_id"("p_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tab_charges"("p_tab_id" "uuid") RETURNS TABLE("c_item" "uuid", "c_share" "uuid", "c_owner" "uuid", "c_cents" integer, "c_covered" integer, "c_plan" "uuid", "c_created" timestamp with time zone)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  with live as (
    select i.* from public.order_items i join public.orders o on o.id = i.order_id
    where o.tab_id = p_tab_id and o.status <> 'void' and i.voided_at is null
  ), units as (
    select l.id as item, s.id as share, s.participant_id as owner, s.cents, l.created_at
    from live l join public.order_item_shares s on s.order_item_id = l.id
    where l.shared
    union all
    select l.id, null, case when l.shared then null else l.participant_id end, l.qty * l.unit_price_cents, l.created_at
    from live l
    where not (l.shared and exists (select 1 from public.order_item_shares s where s.order_item_id = l.id))
  )
  select u.item, u.share, u.owner, u.cents,
    coalesce((
      select sum(a.cents) from public.payment_allocations a join public.payments p on p.id = a.payment_id
      where a.order_item_id = u.item and a.share_id is not distinct from u.share and p.status <> 'failed'
    ), 0)::integer + coalesce((
      select sum(w.cents) from public.write_off_allocations w
      where w.order_item_id = u.item and w.share_id is not distinct from u.share
    ), 0)::integer,
    (
      select pu.plan_id from public.split_plan_units pu join public.split_plans sp on sp.id = pu.plan_id
      where sp.status = 'active' and pu.order_item_id = u.item and pu.share_id is not distinct from u.share
    ),
    u.created_at
  from units u
$$;


ALTER FUNCTION "public"."tab_charges"("p_tab_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tab_checkout"("p_tab_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
declare
  v_plan public.split_plans%rowtype;
  v_left record;
  v_result jsonb;
begin
  select null::bigint as amount_left, null::integer as parts_left into v_left;
  select * into v_plan from public.split_plans where tab_id = p_tab_id and status = 'active';
  if found then
    select * into v_left from public.split_plan_left(v_plan.id);
    if v_left.amount_left <= 0 or v_left.parts_left <= 0 then v_plan := null; end if;
  end if;

  with c as (select * from public.tab_charges(p_tab_id) where c_cents > c_covered)
  select jsonb_build_object(
    'people', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'owed_cents', coalesce((select sum(c.c_cents - c.c_covered) from c where c.c_owner = p.id and c.c_plan is null), 0)
      ) order by p.guest_number)
      from public.tab_participants p where p.tab_id = p_tab_id
    ), '[]'::jsonb),
    'table_cents', coalesce((select sum(c.c_cents - c.c_covered) from c where c.c_owner is null and c.c_plan is null), 0),
    'balance_cents', coalesce((select sum(c.c_cents - c.c_covered) from c), 0),
    'paid_before_cents', coalesce((select sum(amount_cents) from public.payments where tab_id = p_tab_id and status <> 'failed'), 0),
    'plan', case when v_plan.id is null then null else jsonb_build_object(
      'id', v_plan.id,
      'parts', v_plan.parts,
      'parts_left', v_left.parts_left,
      'amount_left_cents', v_left.amount_left,
      -- nullif: Postgres may evaluate this even when the branch isn't taken (a finished plan has 0 left).
      'next_share_cents', v_left.amount_left / nullif(v_left.parts_left, 0)
        + case when v_left.amount_left % nullif(v_left.parts_left, 0) > 0 then 1 else 0 end
    ) end
  ) into v_result;
  return v_result;
end;
$$;


ALTER FUNCTION "public"."tab_checkout"("p_tab_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tab_settled"("p_tab_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select not exists (select 1 from public.tab_charges(p_tab_id) c where c.c_cents > c.c_covered)
    and not exists (select 1 from public.payments p where p.tab_id = p_tab_id and p.status = 'pending')
$$;


ALTER FUNCTION "public"."tab_settled"("p_tab_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."void_line"("p_order_id" "uuid", "p_reason" "text", "p_order_item_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_restaurant uuid;
  v_pay record;
  v_refund integer;
  v_refunds jsonb := '[]'::jsonb;
  v_lines uuid[];
begin
  select o.restaurant_id into v_restaurant from public.orders o where o.id = p_order_id;
  if not found or not public.has_role(v_restaurant, array['owner', 'manager']::public.member_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select array_agg(i.id) into v_lines from public.order_items i
  where i.order_id = p_order_id and i.voided_at is null and (p_order_item_id is null or i.id = p_order_item_id);

  perform public.void_order(p_order_id, p_reason, p_order_item_id);

  for v_pay in
    select p.id, p.participant_id, p.amount_cents, p.ivu_state_cents + p.ivu_municipal_cents as ivu,
      p.amount_cents + p.ivu_state_cents + p.ivu_municipal_cents + p.tip_cents
        - coalesce((select sum(f.amount_cents) from public.refunds f where f.payment_id = p.id), 0) as refundable,
      sum(a.cents) as covered
    from public.payment_allocations a join public.payments p on p.id = a.payment_id
    where a.order_item_id = any (coalesce(v_lines, '{}')) and p.status in ('paid', 'partially_refunded')
    group by p.id
  loop
    v_refund := least(v_pay.refundable, v_pay.covered + (v_pay.ivu * v_pay.covered / greatest(v_pay.amount_cents, 1))::integer);
    if v_refund > 0 then
      perform public.record_refund(v_pay.id, v_refund, p_reason);
      v_refunds := v_refunds || jsonb_build_object('payment_id', v_pay.id, 'participant_id', v_pay.participant_id, 'amount_cents', v_refund);
    end if;
  end loop;
  return jsonb_build_object('refunds', v_refunds);
end;
$$;


ALTER FUNCTION "public"."void_line"("p_order_id" "uuid", "p_reason" "text", "p_order_item_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."void_order"("p_order_id" "uuid", "p_reason" "text", "p_order_item_id" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_order public.orders%rowtype;
  v_actor uuid := (select auth.uid());
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or not public.has_role(v_order.restaurant_id, array['owner', 'manager']::public.member_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_reason is null or length(btrim(p_reason)) = 0 then
    raise exception 'a reason is required' using errcode = '22023';
  end if;
  -- A line a pending payment is holding waits until that payment is confirmed or cancelled.
  if exists (
    select 1 from public.payment_allocations a join public.payments p on p.id = a.payment_id
    join public.order_items i on i.id = a.order_item_id
    where p.status = 'pending' and i.order_id = p_order_id and i.voided_at is null
      and (p_order_item_id is null or i.id = p_order_item_id)
  ) then
    raise exception 'held by a pending payment' using errcode = '22023';
  end if;

  if p_order_item_id is null then
    update public.order_items
    set status = 'void', voided_at = now(), voided_by = v_actor, void_reason = p_reason
    where order_id = p_order_id and voided_at is null;
    update public.orders set status = 'void' where id = p_order_id;
  else
    update public.order_items
    set status = 'void', voided_at = now(), voided_by = v_actor, void_reason = p_reason
    where id = p_order_item_id and order_id = p_order_id and voided_at is null;
    if not found then
      raise exception 'line not found or already void' using errcode = 'P0002';
    end if;
    if not exists (select 1 from public.order_items where order_id = p_order_id and voided_at is null) then
      update public.orders set status = 'void' where id = p_order_id;
    end if;
  end if;

  insert into public.audit_log (restaurant_id, actor_id, action, target_table, target_id, before, after)
  values (
    v_order.restaurant_id, v_actor, 'void',
    case when p_order_item_id is null then 'orders' else 'order_items' end,
    coalesce(p_order_item_id, p_order_id),
    jsonb_build_object('status', v_order.status),
    jsonb_build_object('status', 'void', 'reason', p_reason)
  );
end;
$$;


ALTER FUNCTION "public"."void_order"("p_order_id" "uuid", "p_reason" "text", "p_order_item_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."write_off"("p_tab_id" "uuid", "p_scope" "text", "p_reason" "text", "p_participant_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_tab public.tabs%rowtype;
  v_id uuid;
  v_cents bigint;
  v_units jsonb;
begin
  select * into v_tab from public.tabs where id = p_tab_id for update;
  if not found or not public.has_role(v_tab.restaurant_id, array['owner', 'manager']::public.member_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if v_tab.status = 'closed' then
    raise exception 'tab is closed' using errcode = '22023';
  end if;
  if p_reason is null or length(btrim(p_reason)) not between 3 and 300 then
    raise exception 'a reason is required' using errcode = '22023';
  end if;
  if p_scope not in ('person', 'table', 'balance') or (p_scope = 'person') <> (p_participant_id is not null) then
    raise exception 'invalid scope' using errcode = '22023';
  end if;

  -- The charges it covers (a list, not a scratch table: the Data API refuses DELETE without WHERE).
  select coalesce(jsonb_agg(jsonb_build_object('item', c.c_item, 'share', c.c_share, 'cents', c.c_cents - c.c_covered)), '[]'::jsonb),
    coalesce(sum(c.c_cents - c.c_covered), 0)
  into v_units, v_cents
  from public.tab_charges(p_tab_id) c
  where c.c_cents > c.c_covered
    and (p_scope = 'balance'
      or (p_scope = 'person' and c.c_owner = p_participant_id and c.c_plan is null)
      or (p_scope = 'table' and c.c_owner is null and c.c_plan is null));
  if v_cents = 0 then
    raise exception 'nothing to write off' using errcode = '22023';
  end if;

  insert into public.write_offs (restaurant_id, tab_id, participant_id, scope, cents, reason, created_by)
  values (v_tab.restaurant_id, p_tab_id, p_participant_id, p_scope, v_cents, btrim(p_reason), (select auth.uid()))
  returning id into v_id;
  insert into public.write_off_allocations (restaurant_id, write_off_id, order_item_id, share_id, cents)
  select v_tab.restaurant_id, v_id, (u ->> 'item')::uuid, (u ->> 'share')::uuid, (u ->> 'cents')::integer
  from jsonb_array_elements(v_units) as u;
  insert into public.audit_log (restaurant_id, actor_id, action, target_table, target_id, after)
  values (v_tab.restaurant_id, (select auth.uid()), 'write_off', 'tabs', p_tab_id,
    jsonb_build_object('write_off_id', v_id, 'scope', p_scope, 'participant_id', p_participant_id, 'cents', v_cents, 'reason', btrim(p_reason)));
  return jsonb_build_object('write_off_id', v_id, 'cents', v_cents);
end;
$$;


ALTER FUNCTION "public"."write_off"("p_tab_id" "uuid", "p_scope" "text", "p_reason" "text", "p_participant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "storage"."allow_any_operation"("expected_operations" "text"[]) RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT CASE
      WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
      ELSE raw_operation
    END AS current_operation
    FROM current_operation
  )
  SELECT EXISTS (
    SELECT 1
    FROM normalized n
    CROSS JOIN LATERAL unnest(expected_operations) AS expected_operation
    WHERE expected_operation IS NOT NULL
      AND expected_operation <> ''
      AND n.current_operation = CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END
  );
$$;


ALTER FUNCTION "storage"."allow_any_operation"("expected_operations" "text"[]) OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."allow_only_operation"("expected_operation" "text") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT
      CASE
        WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
        ELSE raw_operation
      END AS current_operation,
      CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END AS requested_operation
    FROM current_operation
  )
  SELECT CASE
    WHEN requested_operation IS NULL OR requested_operation = '' THEN FALSE
    ELSE COALESCE(current_operation = requested_operation, FALSE)
  END
  FROM normalized;
$$;


ALTER FUNCTION "storage"."allow_only_operation"("expected_operation" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."can_insert_object"("bucketid" "text", "name" "text", "owner" "uuid", "metadata" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


ALTER FUNCTION "storage"."can_insert_object"("bucketid" "text", "name" "text", "owner" "uuid", "metadata" "jsonb") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."enforce_bucket_lifecycle_service_role"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog'
    AS $$
BEGIN
  IF current_user::text IS DISTINCT FROM TG_ARGV[0]
     AND (
       OLD.lifecycle_configuration IS DISTINCT FROM NEW.lifecycle_configuration
       OR OLD.lifecycle_configuration_generation IS DISTINCT FROM NEW.lifecycle_configuration_generation
     ) THEN
    -- AFTER runs only after caller RLS has accepted the proposed row. The API
    -- recognizes this specific error after rolling back its permission probe;
    -- direct non-service writes still fail and cannot persist the change.
    RAISE EXCEPTION 'bucket control columns may only be changed by the configured storage service role'
      USING ERRCODE = 'PST01',
            SCHEMA = TG_TABLE_SCHEMA,
            TABLE = TG_TABLE_NAME,
            CONSTRAINT = TG_NAME;
  END IF;

  RETURN NULL;
END;
$$;


ALTER FUNCTION "storage"."enforce_bucket_lifecycle_service_role"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."enforce_bucket_name_length"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


ALTER FUNCTION "storage"."enforce_bucket_name_length"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."extension"("name" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
    _parts text[];
    _filename text;
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Get the last path segment (the actual filename)
    SELECT _parts[array_length(_parts, 1)] INTO _filename;
    -- Extract extension: reverse, split on '.', then reverse again
    RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$$;


ALTER FUNCTION "storage"."extension"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."filename"("name" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    SELECT string_to_array(name, '/') INTO _parts;
    RETURN _parts[array_length(_parts, 1)];
END
$$;


ALTER FUNCTION "storage"."filename"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."foldername"("name" "text") RETURNS "text"[]
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Return everything except the last segment
    RETURN _parts[1 : array_length(_parts,1) - 1];
END
$$;


ALTER FUNCTION "storage"."foldername"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."get_common_prefix"("p_key" "text", "p_prefix" "text", "p_delimiter" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
SELECT CASE
    WHEN p_delimiter <> ''
         AND position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)) > 0
    THEN left(
        p_key,
        length(p_prefix)
            + position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1))
            + length(p_delimiter) - 1
    )
    ELSE NULL
END;
$$;


ALTER FUNCTION "storage"."get_common_prefix"("p_key" "text", "p_prefix" "text", "p_delimiter" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."get_size_by_bucket"("noncurrent_versions" "text" DEFAULT 'include'::"text", "delete_markers" "text" DEFAULT 'include'::"text") RETURNS TABLE("size" bigint, "bucket_id" "text")
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
    -- COALESCE first: NULL NOT IN (...) evaluates to NULL (not TRUE), so a
    -- bare NOT IN check silently leaves an explicit NULL argument unreset.
    noncurrent_versions := COALESCE(noncurrent_versions, 'include');
    delete_markers := COALESCE(delete_markers, 'include');
    IF noncurrent_versions NOT IN ('exclude', 'only', 'include') THEN
        noncurrent_versions := 'include';
    END IF;
    IF delete_markers NOT IN ('exclude', 'only', 'include') THEN
        delete_markers := 'include';
    END IF;

    return query
        select sum((metadata->>'size')::bigint)::bigint as size, obj.bucket_id
        from "storage".objects as obj
        where (noncurrent_versions != 'exclude' OR obj.archived_at IS NULL)
          and (noncurrent_versions != 'only' OR obj.archived_at IS NOT NULL)
          and (delete_markers != 'exclude' OR NOT obj.is_delete_marker)
          and (delete_markers != 'only' OR obj.is_delete_marker)
        group by obj.bucket_id;
END
$$;


ALTER FUNCTION "storage"."get_size_by_bucket"("noncurrent_versions" "text", "delete_markers" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."list_multipart_uploads_with_delimiter"("bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer DEFAULT 100, "next_key_token" "text" DEFAULT ''::"text", "next_upload_token" "text" DEFAULT ''::"text", "raw_prefix_param" "text" DEFAULT NULL::"text") RETURNS TABLE("key" "text", "id" "text", "created_at" timestamp with time zone)
    LANGUAGE "sql" STABLE
    AS $_$
WITH candidates AS (
    SELECT
        upload.key AS object_key,
        CASE
            WHEN position($3 IN substring(upload.key FROM length(coalesce($7, $2)) + 1)) > 0
            THEN left(
                upload.key,
                length(coalesce($7, $2))
                    + position($3 IN substring(upload.key FROM length(coalesce($7, $2)) + 1))
                    + length($3) - 1
            )
            ELSE upload.key
        END AS result_key,
        upload.id,
        upload.created_at,
        position($3 IN substring(upload.key FROM length(coalesce($7, $2)) + 1)) > 0 AS is_common_prefix
    FROM storage.s3_multipart_uploads AS upload
    WHERE upload.bucket_id = $1
      AND upload.key COLLATE "C" LIKE $2 || '%'
), filtered AS (
    SELECT candidate.*
    FROM candidates AS candidate
    WHERE $5 = ''
       OR candidate.result_key COLLATE "C" > $5
       OR (
           candidate.result_key COLLATE "C" = $5
           AND NOT candidate.is_common_prefix
           AND $6 <> ''
           -- A completed or aborted marker repeats the remaining same-key uploads.
           AND COALESCE(
               (candidate.created_at, candidate.id COLLATE "C") > (
                   SELECT marker.created_at, marker.id COLLATE "C"
                   FROM storage.s3_multipart_uploads AS marker
                   WHERE marker.bucket_id = $1
                     AND marker.key COLLATE "C" = $5
                     AND marker.id = $6
               ),
               TRUE
           )
       )
), ranked AS (
    SELECT
        filtered.*,
        row_number() OVER (
            PARTITION BY filtered.result_key COLLATE "C"
            ORDER BY filtered.created_at, filtered.id COLLATE "C"
        ) AS prefix_rank
    FROM filtered
)
SELECT ranked.result_key, ranked.id, ranked.created_at
FROM ranked
WHERE NOT ranked.is_common_prefix OR ranked.prefix_rank = 1
ORDER BY ranked.result_key COLLATE "C", ranked.created_at, ranked.id COLLATE "C"
LIMIT $4;
$_$;


ALTER FUNCTION "storage"."list_multipart_uploads_with_delimiter"("bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer, "next_key_token" "text", "next_upload_token" "text", "raw_prefix_param" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."list_objects_with_delimiter"("_bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer DEFAULT 100, "start_after" "text" DEFAULT ''::"text", "next_token" "text" DEFAULT ''::"text", "sort_order" "text" DEFAULT 'asc'::"text", "noncurrent_versions" "text" DEFAULT 'exclude'::"text", "delete_markers" "text" DEFAULT 'exclude'::"text", "next_token_archived_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "next_token_version" "text" DEFAULT ''::"text") RETURNS TABLE("name" "text", "id" "uuid", "metadata" "jsonb", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "version" "text", "archived_at" timestamp with time zone, "is_delete_marker" boolean, "is_versioned" boolean)
    LANGUAGE "plpgsql" STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;

    -- Configuration
    v_is_asc BOOLEAN;
    v_prefix TEXT;
    v_start TEXT;
    v_start_relative TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;
    v_version_filter TEXT;

    -- true when noncurrent_versions can return >1 row per name; keeps them
    -- ordered most-recent-first and lets pagination resume mid-key
    v_multi_row BOOLEAN;
    v_name_order TEXT;
    v_exact_range_predicate TEXT;
    v_strict_range_predicate TEXT;
    v_inclusive_range_predicate TEXT;

    -- Seek state for the current name. archived_at is normalized to JavaScript's
    -- millisecond precision and version breaks ties within the same millisecond.
    -- Current rows use 'infinity'; NULL means no tiebreak has been established.
    v_next_seek TEXT;
    v_next_seek_at TIMESTAMPTZ;
    v_next_seek_version TEXT;
    v_next_seek_strict BOOLEAN := false;
    v_cursor_is_folder BOOLEAN;
    v_count INT := 0;
    v_previous_seek TEXT;
    v_previous_seek_at TIMESTAMPTZ;
    v_previous_seek_version TEXT;
    v_previous_count INT;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;
    v_batch_query_strict TEXT;
    v_delete_marker_peek_query TEXT;
    v_delete_marker_peek_query_strict TEXT;

BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_is_asc := lower(coalesce(sort_order, 'asc')) = 'asc';
    v_prefix := coalesce(prefix_param, '');
    v_start := CASE WHEN coalesce(next_token, '') <> '' THEN next_token ELSE coalesce(start_after, '') END;
    v_file_batch_size := LEAST(GREATEST(max_keys * 2, 100), 1000);
    v_next_seek_at := NULL;
    v_next_seek_version := '';

    -- COALESCE first: NULL NOT IN (...) evaluates to NULL (not TRUE), so a
    -- bare NOT IN check silently leaves an explicit NULL argument unreset.
    noncurrent_versions := COALESCE(noncurrent_versions, 'exclude');
    delete_markers := COALESCE(delete_markers, 'exclude');
    IF noncurrent_versions NOT IN ('exclude', 'only', 'include') THEN
        noncurrent_versions := 'exclude';
    END IF;
    IF delete_markers NOT IN ('exclude', 'only', 'include') THEN
        delete_markers := 'exclude';
    END IF;

    v_multi_row := noncurrent_versions IN ('only', 'include');
    v_name_order := CASE WHEN v_is_asc THEN 'ASC' ELSE 'DESC' END;

    v_version_filter := '';
    IF noncurrent_versions = 'exclude' THEN
        v_version_filter := v_version_filter || ' AND o.archived_at IS NULL';
    ELSIF noncurrent_versions = 'only' THEN
        v_version_filter := v_version_filter || ' AND o.archived_at IS NOT NULL';
    END IF;
    IF delete_markers = 'exclude' THEN
        v_version_filter := v_version_filter || ' AND NOT o.is_delete_marker';
    ELSIF delete_markers = 'only' THEN
        v_version_filter := v_version_filter || ' AND o.is_delete_marker';
    END IF;

    -- Calculate upper bound for prefix filtering (bytewise, using COLLATE "C")
    IF v_prefix = '' THEN
        v_upper_bound := NULL;
    ELSE
        v_upper_bound := left(v_prefix, -1) || chr(ascii(right(v_prefix, 1)) + 1);
    END IF;

    -- Keep caller-provided cursors inside the requested prefix range.
    IF v_start <> '' AND v_upper_bound IS NOT NULL THEN
        IF v_is_asc THEN
            IF v_start COLLATE "C" < v_prefix COLLATE "C" THEN
                v_start := '';
            ELSIF v_start COLLATE "C" >= v_upper_bound COLLATE "C" THEN
                RETURN;
            END IF;
        ELSE
            IF v_start COLLATE "C" < v_prefix COLLATE "C" THEN
                RETURN;
            ELSIF v_start COLLATE "C" >= v_upper_bound COLLATE "C" THEN
                v_start := '';
            END IF;
        END IF;
    END IF;

    v_start_relative := substring(v_start FROM length(v_prefix) + 1);

    -- Direction affects only the indexed name range and its ordering. Cursor
    -- state transitions and within-key version ordering stay shared.
    IF v_is_asc THEN
        v_exact_range_predicate := 'TRUE';
        v_strict_range_predicate := 'o.name COLLATE "C" > $2';
        v_inclusive_range_predicate := 'o.name COLLATE "C" >= $2';
        IF v_upper_bound IS NOT NULL THEN
            v_exact_range_predicate := 'o.name COLLATE "C" < $3';
            v_strict_range_predicate := v_strict_range_predicate || ' AND o.name COLLATE "C" < $3';
            v_inclusive_range_predicate := v_inclusive_range_predicate || ' AND o.name COLLATE "C" < $3';
        END IF;
    ELSE
        v_exact_range_predicate := 'TRUE';
        v_strict_range_predicate := 'o.name COLLATE "C" < $2';
        v_inclusive_range_predicate := 'o.name COLLATE "C" < $2';
        IF v_prefix <> '' THEN
            v_exact_range_predicate := 'o.name COLLATE "C" >= $3';
            v_strict_range_predicate := v_strict_range_predicate || ' AND o.name COLLATE "C" >= $3';
            v_inclusive_range_predicate := v_inclusive_range_predicate || ' AND o.name COLLATE "C" >= $3';
        END IF;
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    -- The multi-row order matches the externally serialized cursor exactly:
    -- archived_at at millisecond precision, then version as the final tiebreak.
    --
    -- When v_multi_row, the seek is a keyset tuple comparison ("name > $2 OR
    -- (name = $2 AND tiebreak)") - Postgres won't split that OR into indexable
    -- form (confirmed even with fully literal values), so as one WHERE clause
    -- it forces a full bucket scan filtered row-by-row. Splitting it into two
    -- independently-indexable branches (exact name match with the tiebreak
    -- filter, vs. strictly-past names) combined with UNION ALL lets each
    -- branch keep name as a real index condition; the outer ORDER BY/LIMIT
    -- re-merges them into the same page the single query used to produce.
    IF v_multi_row THEN
        v_batch_query := format(
            $sql$
            SELECT *
            FROM (
                (
                    SELECT o.name, o.id, o.updated_at, o.created_at,
                           o.last_accessed_at, o.metadata, o.version,
                           o.archived_at, o.is_delete_marker, o.is_versioned
                    FROM storage.objects o
                    WHERE o.bucket_id = $1
                      AND o.name COLLATE "C" = $2
                      AND %s
                      AND NOT $7::boolean
                      AND (
                          $5::timestamptz IS NULL
                          OR COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) < $5
                          OR (
                              COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) = $5
                              AND COALESCE(o.version, '') > $6
                          )
                      )
                      %s
                    ORDER BY
                        COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) DESC,
                        COALESCE(o.version, '') ASC
                    LIMIT $4
                )
                UNION ALL
                (
                    SELECT o.name, o.id, o.updated_at, o.created_at,
                           o.last_accessed_at, o.metadata, o.version,
                           o.archived_at, o.is_delete_marker, o.is_versioned
                    FROM storage.objects o
                    WHERE o.bucket_id = $1
                      AND %s
                      %s
                    ORDER BY
                        o.name COLLATE "C" %s,
                        COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) DESC,
                        COALESCE(o.version, '') ASC
                    LIMIT $4
                )
            ) sub
            ORDER BY
                sub.name COLLATE "C" %s,
                COALESCE(date_trunc('milliseconds', sub.archived_at), 'infinity'::timestamptz) DESC,
                COALESCE(sub.version, '') ASC
            LIMIT $4
            $sql$,
            v_exact_range_predicate,
            v_version_filter,
            v_strict_range_predicate,
            v_version_filter,
            v_name_order,
            v_name_order
        );
    ELSE
        v_batch_query := format(
            $sql$
            SELECT o.name, o.id, o.updated_at, o.created_at,
                   o.last_accessed_at, o.metadata, o.version,
                   o.archived_at, o.is_delete_marker, o.is_versioned
            FROM storage.objects o
            WHERE o.bucket_id = $1
              AND %s
              %s
            ORDER BY o.name COLLATE "C" %s, o.archived_at DESC
            LIMIT $4
            $sql$,
            v_inclusive_range_predicate,
            v_version_filter,
            v_name_order
        );

        -- Strict counterpart of the query above: used once the single-row
        -- ASC batch advance (below) has left v_next_seek pointing at the
        -- last row already emitted, so an inclusive predicate would
        -- re-match it forever. Only single-row mode ever sets strict mode,
        -- so this variant is never needed when v_multi_row.
        v_batch_query_strict := format(
            $sql$
            SELECT o.name, o.id, o.updated_at, o.created_at,
                   o.last_accessed_at, o.metadata, o.version,
                   o.archived_at, o.is_delete_marker, o.is_versioned
            FROM storage.objects o
            WHERE o.bucket_id = $1
              AND %s
              %s
            ORDER BY o.name COLLATE "C" %s, o.archived_at DESC
            LIMIT $4
            $sql$,
            v_strict_range_predicate,
            v_version_filter,
            v_name_order
        );
    END IF;

    -- The static peek predicates cannot use the partial delete-marker index
    -- once PL/pgSQL switches to a generic plan because whether
    -- is_delete_marker is required remains parameter-dependent. Reuse the
    -- already-specialized batch query with a one-row limit for this sparse
    -- filter so the plan sees a literal `o.is_delete_marker` predicate.
    IF delete_markers = 'only' THEN
        v_delete_marker_peek_query :=
            'SELECT marker_page.name FROM (' || v_batch_query || ') marker_page LIMIT 1';
        IF NOT v_multi_row THEN
            v_delete_marker_peek_query_strict :=
                'SELECT marker_page.name FROM (' || v_batch_query_strict || ') marker_page LIMIT 1';
        END IF;
    END IF;

    -- ========================================================================
    -- SEEK INITIALIZATION: Determine starting position
    -- ========================================================================
    IF v_start = '' THEN
        IF v_is_asc THEN
            v_next_seek := v_prefix;
        ELSE
            -- DESC without cursor performs one specialized initial seek so
            -- partial current-version and delete-marker indexes remain available.
            EXECUTE format(
                'SELECT o.name FROM storage.objects o WHERE o.bucket_id = $1%s%s ORDER BY o.name COLLATE "C" DESC LIMIT 1',
                CASE WHEN v_upper_bound IS NOT NULL
                    THEN ' AND o.name COLLATE "C" >= $2 AND o.name COLLATE "C" < $3'
                    ELSE ''
                END,
                v_version_filter
            )
            INTO v_next_seek
            USING _bucket_id, v_prefix, v_upper_bound;

            IF v_next_seek IS NOT NULL THEN
                v_next_seek := v_next_seek || delimiter_param;
            ELSE
                RETURN;
            END IF;
        END IF;
    ELSE
        -- Folder continuation tokens retain their trailing delimiter. A
        -- delimiter-less startAfter is always a literal key boundary.
        v_cursor_is_folder := delimiter_param <> ''
            AND v_start_relative <> ''
            AND right(v_start_relative, length(delimiter_param)) = delimiter_param;

        IF v_cursor_is_folder THEN
            v_next_seek := CASE
                WHEN right(v_start, length(delimiter_param)) = delimiter_param
                    THEN v_start
                ELSE v_start || delimiter_param
            END;
            IF v_is_asc THEN
                v_next_seek := left(v_next_seek, -1)
                    || chr(ascii(right(v_next_seek, 1)) + 1);
            END IF;
            v_next_seek_strict := NOT v_is_asc;
        ELSE
            -- leaf object: when v_multi_row, stay on v_start with the
            -- caller-supplied tiebreak so a page boundary mid-key resumes
            -- that key's remaining rows instead of skipping them. Truncate
            -- to milliseconds like every other v_next_seek_at assignment -
            -- harmless today since object.ts's cursor always round-trips
            -- through JS Date first, but this shouldn't rely on that.
            IF v_multi_row THEN
                v_next_seek := v_start;
                v_next_seek_at := date_trunc('milliseconds', next_token_archived_at);
                v_next_seek_version := coalesce(next_token_version, '');
                v_next_seek_strict := coalesce(next_token, '') = '';
            ELSIF v_is_asc THEN
                v_next_seek := v_start;
                v_next_seek_strict := true;
            ELSE
                v_next_seek := v_start;
            END IF;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= max_keys;

        v_previous_seek := v_next_seek;
        v_previous_seek_at := v_next_seek_at;
        v_previous_seek_version := v_next_seek_version;
        v_previous_count := v_count;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        -- v_multi_row is branched here (rather than folded into the WHERE
        -- clause as a bound parameter) so each concrete query keeps an
        -- unconditional seek predicate - once PL/pgSQL switches to its
        -- cached generic plan (after 5 calls), a parameter-gated
        -- "(NOT v_multi_row AND name >= $x) OR (v_multi_row AND ...)"
        -- predicate stops the planner from using name as an index
        -- condition at all, degrading every subsequent peek to a full
        -- index scan filtered row-by-row instead of a bounded range scan.
        -- v_multi_row's seek predicate is a keyset tuple comparison
        -- ("name > x OR (name = x AND tiebreak)") - Postgres does not
        -- split this OR into indexable form even with fully literal
        -- values, so it falls back to a full scan filtered row-by-row.
        -- Splitting it into two independently-indexable branches (exact
        -- name match with the tiebreak filter, vs. strictly-past name)
        -- combined with UNION ALL lets each branch keep name as a real
        -- index condition; the outer ORDER BY/LIMIT picks whichever of
        -- the (at most 2) rows sorts first.
        IF delete_markers = 'only' THEN
            EXECUTE CASE WHEN v_next_seek_strict AND NOT v_multi_row
                THEN v_delete_marker_peek_query_strict
                ELSE v_delete_marker_peek_query
            END
                INTO v_peek_name
                USING _bucket_id, v_next_seek,
                    CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix) ELSE v_prefix END,
                    1, v_next_seek_at, v_next_seek_version, v_next_seek_strict;
        ELSIF v_multi_row THEN
            IF v_is_asc THEN
                IF v_upper_bound IS NOT NULL THEN
                    SELECT sub.name INTO v_peek_name FROM (
                        (SELECT o.name FROM storage.objects o
                         WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" = v_next_seek
                           AND o.name COLLATE "C" < v_upper_bound
                           AND NOT v_next_seek_strict
                           AND (v_next_seek_at IS NULL
                                OR COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) < v_next_seek_at
                                OR (COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) = v_next_seek_at
                                    AND COALESCE(o.version, '') > v_next_seek_version))
                           AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                           AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                           AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                           AND (delete_markers != 'only' OR o.is_delete_marker)
                         ORDER BY COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) DESC, COALESCE(o.version, '') ASC LIMIT 1)
                        UNION ALL
                        (SELECT o.name FROM storage.objects o
                         WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" > v_next_seek AND o.name COLLATE "C" < v_upper_bound
                           AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                           AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                           AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                           AND (delete_markers != 'only' OR o.is_delete_marker)
                         ORDER BY o.name COLLATE "C" ASC LIMIT 1)
                    ) sub ORDER BY sub.name COLLATE "C" ASC LIMIT 1;
                ELSE
                    SELECT sub.name INTO v_peek_name FROM (
                        (SELECT o.name FROM storage.objects o
                         WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" = v_next_seek
                           AND NOT v_next_seek_strict
                           AND (v_next_seek_at IS NULL
                                OR COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) < v_next_seek_at
                                OR (COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) = v_next_seek_at
                                    AND COALESCE(o.version, '') > v_next_seek_version))
                           AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                           AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                           AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                           AND (delete_markers != 'only' OR o.is_delete_marker)
                         ORDER BY COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) DESC, COALESCE(o.version, '') ASC LIMIT 1)
                        UNION ALL
                        (SELECT o.name FROM storage.objects o
                         WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" > v_next_seek
                           AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                           AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                           AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                           AND (delete_markers != 'only' OR o.is_delete_marker)
                         ORDER BY o.name COLLATE "C" ASC LIMIT 1)
                    ) sub ORDER BY sub.name COLLATE "C" ASC LIMIT 1;
                END IF;
            ELSE
                IF v_upper_bound IS NOT NULL THEN
                    SELECT sub.name INTO v_peek_name FROM (
                        (SELECT o.name FROM storage.objects o
                         WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" = v_next_seek
                           AND o.name COLLATE "C" >= v_prefix
                           AND NOT v_next_seek_strict
                           AND (v_next_seek_at IS NULL
                                OR COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) < v_next_seek_at
                                OR (COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) = v_next_seek_at
                                    AND COALESCE(o.version, '') > v_next_seek_version))
                           AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                           AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                           AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                           AND (delete_markers != 'only' OR o.is_delete_marker)
                         ORDER BY COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) DESC, COALESCE(o.version, '') ASC LIMIT 1)
                        UNION ALL
                        (SELECT o.name FROM storage.objects o
                         WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                           AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                           AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                           AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                           AND (delete_markers != 'only' OR o.is_delete_marker)
                         ORDER BY o.name COLLATE "C" DESC LIMIT 1)
                    ) sub ORDER BY sub.name COLLATE "C" DESC LIMIT 1;
                ELSE
                    SELECT sub.name INTO v_peek_name FROM (
                        (SELECT o.name FROM storage.objects o
                         WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" = v_next_seek
                           AND NOT v_next_seek_strict
                           AND (v_next_seek_at IS NULL
                                OR COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) < v_next_seek_at
                                OR (COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) = v_next_seek_at
                                    AND COALESCE(o.version, '') > v_next_seek_version))
                           AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                           AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                           AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                           AND (delete_markers != 'only' OR o.is_delete_marker)
                         ORDER BY COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) DESC, COALESCE(o.version, '') ASC LIMIT 1)
                        UNION ALL
                        (SELECT o.name FROM storage.objects o
                         WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek
                           AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                           AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                           AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                           AND (delete_markers != 'only' OR o.is_delete_marker)
                         ORDER BY o.name COLLATE "C" DESC LIMIT 1)
                    ) sub ORDER BY sub.name COLLATE "C" DESC LIMIT 1;
                END IF;
            END IF;
        ELSE
            -- Single-row mode is always noncurrent_versions='exclude'. Keep
            -- this predicate literal so generic plans use the current index.
            IF v_is_asc THEN
                IF v_next_seek_strict AND v_upper_bound IS NOT NULL THEN
                    SELECT o.name INTO v_peek_name FROM storage.objects o
                    WHERE o.bucket_id = _bucket_id
                      AND o.name COLLATE "C" > v_next_seek
                      AND o.name COLLATE "C" < v_upper_bound
                      AND o.archived_at IS NULL
                      AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                      AND (delete_markers != 'only' OR o.is_delete_marker)
                    ORDER BY o.name COLLATE "C" ASC LIMIT 1;
                ELSIF v_next_seek_strict THEN
                    SELECT o.name INTO v_peek_name FROM storage.objects o
                    WHERE o.bucket_id = _bucket_id
                      AND o.name COLLATE "C" > v_next_seek
                      AND o.archived_at IS NULL
                      AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                      AND (delete_markers != 'only' OR o.is_delete_marker)
                    ORDER BY o.name COLLATE "C" ASC LIMIT 1;
                ELSIF v_upper_bound IS NOT NULL THEN
                    SELECT o.name INTO v_peek_name FROM storage.objects o
                    WHERE o.bucket_id = _bucket_id
                      AND o.name COLLATE "C" >= v_next_seek
                      AND o.name COLLATE "C" < v_upper_bound
                      AND o.archived_at IS NULL
                      AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                      AND (delete_markers != 'only' OR o.is_delete_marker)
                    ORDER BY o.name COLLATE "C" ASC LIMIT 1;
                ELSE
                    SELECT o.name INTO v_peek_name FROM storage.objects o
                    WHERE o.bucket_id = _bucket_id
                      AND o.name COLLATE "C" >= v_next_seek
                      AND o.archived_at IS NULL
                      AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                      AND (delete_markers != 'only' OR o.is_delete_marker)
                    ORDER BY o.name COLLATE "C" ASC LIMIT 1;
                END IF;
            ELSE
                IF v_upper_bound IS NOT NULL THEN
                    SELECT o.name INTO v_peek_name FROM storage.objects o
                    WHERE o.bucket_id = _bucket_id
                      AND o.name COLLATE "C" < v_next_seek
                      AND o.name COLLATE "C" >= v_prefix
                      AND o.archived_at IS NULL
                      AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                      AND (delete_markers != 'only' OR o.is_delete_marker)
                    ORDER BY o.name COLLATE "C" DESC LIMIT 1;
                ELSE
                    SELECT o.name INTO v_peek_name FROM storage.objects o
                    WHERE o.bucket_id = _bucket_id
                      AND o.name COLLATE "C" < v_next_seek
                      AND o.archived_at IS NULL
                      AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                      AND (delete_markers != 'only' OR o.is_delete_marker)
                    ORDER BY o.name COLLATE "C" DESC LIMIT 1;
                END IF;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(v_peek_name, v_prefix, delimiter_param);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Emit and skip to next folder (no heap access needed)
            name := v_common_prefix;
            id := NULL;
            updated_at := NULL;
            created_at := NULL;
            last_accessed_at := NULL;
            metadata := NULL;
            version := NULL;
            archived_at := NULL;
            is_delete_marker := NULL;
            is_versioned := NULL;
            RETURN NEXT;
            v_count := v_count + 1;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := left(v_common_prefix, -1)
                    || chr(ascii(right(v_common_prefix, 1)) + 1);
            ELSE
                v_next_seek := v_common_prefix;
            END IF;
            v_next_seek_at := NULL;
            v_next_seek_version := '';
            v_next_seek_strict := NOT v_is_asc;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE CASE WHEN v_next_seek_strict AND NOT v_multi_row THEN v_batch_query_strict ELSE v_batch_query END
                USING _bucket_id, v_next_seek,
                CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix) ELSE v_prefix END, v_file_batch_size, v_next_seek_at, v_next_seek_version,
                v_next_seek_strict
            LOOP
                v_common_prefix := storage.get_common_prefix(v_current.name, v_prefix, delimiter_param);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it. Reset
                    -- strict mode too it may have been set by an earlier
                    -- row in this same batch (see the single-row ASC advance
                    -- below), and v_next_seek here is the folder-triggering
                    -- row's own name, which the next peek must find inclusively.
                    v_next_seek := CASE
                        WHEN v_is_asc THEN v_current.name
                        ELSE v_current.name || delimiter_param
                    END;
                    v_next_seek_at := NULL;
                    v_next_seek_version := '';
                    v_next_seek_strict := false;
                    EXIT;
                END IF;

                -- Emit file
                name := v_current.name;
                id := v_current.id;
                updated_at := v_current.updated_at;
                created_at := v_current.created_at;
                last_accessed_at := v_current.last_accessed_at;
                metadata := v_current.metadata;
                version := v_current.version;
                archived_at := v_current.archived_at;
                is_delete_marker := v_current.is_delete_marker;
                is_versioned := v_current.is_versioned;
                RETURN NEXT;
                v_count := v_count + 1;

                -- when v_multi_row, stay on this name and record its
                -- archived_at as the new tiebreak so remaining rows for the
                -- same key are picked up before moving to the next name
                IF v_multi_row THEN
                    v_next_seek := v_current.name;
                    v_next_seek_at := COALESCE(date_trunc('milliseconds', v_current.archived_at), 'infinity'::timestamptz);
                    v_next_seek_version := COALESCE(v_current.version, '');
                    v_next_seek_strict := false;
                ELSIF v_is_asc THEN
                    -- Appending the delimiter as a fake lexical successor
                    -- would skip a real key like `name || '!'` (or any
                    -- character sorting below the delimiter), which sorts
                    -- between `name` and `name || delimiter`. Track the real
                    -- name and mark the next comparison strict instead.
                    v_next_seek := v_current.name;
                    v_next_seek_strict := true;
                ELSE
                    v_next_seek := v_current.name;
                END IF;

                EXIT WHEN v_count >= max_keys;
            END LOOP;
        END IF;

        IF v_count = v_previous_count
           AND v_next_seek IS NOT DISTINCT FROM v_previous_seek
           AND v_next_seek_at IS NOT DISTINCT FROM v_previous_seek_at
           AND v_next_seek_version IS NOT DISTINCT FROM v_previous_seek_version THEN
            RAISE EXCEPTION 'storage.list_objects_with_delimiter made no progress at seek (%, %, %)',
                v_next_seek, v_next_seek_at, v_next_seek_version;
        END IF;
    END LOOP;
END;
$_$;


ALTER FUNCTION "storage"."list_objects_with_delimiter"("_bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer, "start_after" "text", "next_token" "text", "sort_order" "text", "noncurrent_versions" "text", "delete_markers" "text", "next_token_archived_at" timestamp with time zone, "next_token_version" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."operation"() RETURNS "text"
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


ALTER FUNCTION "storage"."operation"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."protect_bucket_control_columns"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  configuration_changed boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.lifecycle_configuration IS NOT NULL
       OR NEW.lifecycle_configuration_generation IS NOT NULL THEN
      IF NOT pg_has_role(current_user, TG_ARGV[0], 'MEMBER') THEN
        RAISE EXCEPTION 'only members of the configured storage service role may insert lifecycle policy state'
          USING ERRCODE = '42501',
                HINT = format(
                  'Insert with both lifecycle columns NULL and configure lifecycle through the Storage API afterward, or insert as a member of %I.',
                  TG_ARGV[0]
                );
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  configuration_changed =
    OLD.lifecycle_configuration IS DISTINCT FROM NEW.lifecycle_configuration
    OR OLD.lifecycle_configuration_generation IS DISTINCT FROM NEW.lifecycle_configuration_generation;

  IF NOT configuration_changed THEN
    RETURN NEW;
  END IF;

  IF NEW.type IS DISTINCT FROM 'STANDARD' THEN
    RAISE EXCEPTION 'bucket versioning and lifecycle controls require a Standard bucket'
      USING ERRCODE = '0A000';
  END IF;

  IF NEW.lifecycle_configuration IS NULL
     AND NEW.lifecycle_configuration_generation IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.lifecycle_configuration IS NULL
     OR NEW.lifecycle_configuration_generation IS NULL
     OR OLD.lifecycle_configuration IS NOT DISTINCT FROM NEW.lifecycle_configuration
     OR OLD.lifecycle_configuration_generation IS NOT DISTINCT FROM NEW.lifecycle_configuration_generation THEN
    RAISE EXCEPTION 'a changed lifecycle policy requires a new non-null generation'
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "storage"."protect_bucket_control_columns"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."protect_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Check if storage.allow_delete_query is set to 'true'
    IF COALESCE(current_setting('storage.allow_delete_query', true), 'false') != 'true' THEN
        RAISE EXCEPTION 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
            USING HINT = 'This prevents accidental data loss from orphaned objects.',
                  ERRCODE = '42501';
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION "storage"."protect_delete"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."search"("prefix" "text", "bucketname" "text", "limits" integer DEFAULT 100, "levels" integer DEFAULT 1, "offsets" integer DEFAULT 0, "search" "text" DEFAULT ''::"text", "sortcolumn" "text" DEFAULT 'name'::"text", "sortorder" "text" DEFAULT 'asc'::"text", "noncurrent_versions" "text" DEFAULT 'exclude'::"text", "delete_markers" "text" DEFAULT 'exclude'::"text") RETURNS TABLE("name" "text", "id" "uuid", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "metadata" "jsonb", "version" "text", "archived_at" timestamp with time zone, "is_delete_marker" boolean, "is_versioned" boolean)
    LANGUAGE "plpgsql" STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;
    v_delimiter CONSTANT TEXT := '/';

    -- Configuration
    v_limit INT;
    v_prefix TEXT;
    v_prefix_lower TEXT;
    v_prefix_len INT;
    v_prefix_start INT;
    v_combined_levels INT;
    v_is_asc BOOLEAN;
    v_order_by TEXT;
    v_sort_order TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;
    v_version_filter TEXT;
    v_multi_row BOOLEAN;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;
    v_delete_marker_peek_query TEXT;
    v_delete_marker_peek_query_strict TEXT;

    -- Seek state
    v_next_seek TEXT;
    v_next_seek_at TIMESTAMPTZ;
    v_next_seek_version TEXT;
    v_next_seek_strict BOOLEAN := false;
    v_count INT := 0;
    v_skipped INT := 0;
    v_previous_seek TEXT;
    v_previous_seek_at TIMESTAMPTZ;
    v_previous_seek_version TEXT;
    v_previous_count INT;
    v_previous_skipped INT;
BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_limit := LEAST(coalesce(limits, 100), 1500);
    v_prefix := coalesce(prefix, '') || coalesce(search, '');
    v_prefix_lower := lower(v_prefix);
    v_prefix_len := length(coalesce(prefix, ''));
    v_prefix_start := coalesce(array_length(string_to_array(coalesce(prefix, ''), v_delimiter), 1), 1);
    v_combined_levels := coalesce(array_length(string_to_array(v_prefix, v_delimiter), 1), 1);
    v_is_asc := lower(coalesce(sortorder, 'asc')) = 'asc';
    v_file_batch_size := LEAST(GREATEST(v_limit * 2, 100), 1000);
    v_next_seek_at := NULL;
    v_next_seek_version := '';

    -- COALESCE first: NULL NOT IN (...) evaluates to NULL (not TRUE), so a
    -- bare NOT IN check silently leaves an explicit NULL argument unreset.
    noncurrent_versions := COALESCE(noncurrent_versions, 'exclude');
    delete_markers := COALESCE(delete_markers, 'exclude');
    IF noncurrent_versions NOT IN ('exclude', 'only', 'include') THEN
        noncurrent_versions := 'exclude';
    END IF;
    IF delete_markers NOT IN ('exclude', 'only', 'include') THEN
        delete_markers := 'exclude';
    END IF;

    v_multi_row := noncurrent_versions IN ('only', 'include');

    v_version_filter := '';
    IF noncurrent_versions = 'exclude' THEN
        v_version_filter := v_version_filter || ' AND o.archived_at IS NULL';
    ELSIF noncurrent_versions = 'only' THEN
        v_version_filter := v_version_filter || ' AND o.archived_at IS NOT NULL';
    END IF;
    IF delete_markers = 'exclude' THEN
        v_version_filter := v_version_filter || ' AND NOT o.is_delete_marker';
    ELSIF delete_markers = 'only' THEN
        v_version_filter := v_version_filter || ' AND o.is_delete_marker';
    END IF;

    -- Validate sort column
    CASE lower(coalesce(sortcolumn, 'name'))
        WHEN 'name' THEN v_order_by := 'name';
        WHEN 'updated_at' THEN v_order_by := 'updated_at';
        WHEN 'created_at' THEN v_order_by := 'created_at';
        WHEN 'last_accessed_at' THEN v_order_by := 'last_accessed_at';
        ELSE v_order_by := 'name';
    END CASE;

    v_sort_order := CASE WHEN v_is_asc THEN 'asc' ELSE 'desc' END;

    -- ========================================================================
    -- NON-NAME SORTING: Use path_tokens approach
    -- ========================================================================
    IF v_order_by != 'name' THEN
        RETURN QUERY EXECUTE format(
            $sql$
            WITH folders AS (
                SELECT array_to_string(path_tokens[$1:$2], '/') AS folder
                FROM storage.objects
                WHERE objects.name ILIKE $3 || '%%'
                  AND bucket_id = $4
                  AND array_length(objects.path_tokens, 1) <> $2
                  AND ($7 != 'exclude' OR objects.archived_at IS NULL)
                  AND ($7 != 'only' OR objects.archived_at IS NOT NULL)
                  AND ($8 != 'exclude' OR NOT objects.is_delete_marker)
                  AND ($8 != 'only' OR objects.is_delete_marker)
                GROUP BY folder
                ORDER BY folder %s
            )
            (SELECT folder AS "name",
                   NULL::uuid AS id,
                   NULL::timestamptz AS updated_at,
                   NULL::timestamptz AS created_at,
                   NULL::timestamptz AS last_accessed_at,
                   NULL::jsonb AS metadata,
                   NULL::text AS version,
                   NULL::timestamptz AS archived_at,
                   NULL::boolean AS is_delete_marker,
                   NULL::boolean AS is_versioned FROM folders)
            UNION ALL
            (SELECT array_to_string(path_tokens[$1:$2], '/') AS "name",
                   id, updated_at, created_at, last_accessed_at, metadata,
                   version, archived_at, is_delete_marker, is_versioned
             FROM storage.objects
             WHERE objects.name ILIKE $3 || '%%'
               AND bucket_id = $4
               AND array_length(objects.path_tokens, 1) = $2
               AND ($7 != 'exclude' OR objects.archived_at IS NULL)
               AND ($7 != 'only' OR objects.archived_at IS NOT NULL)
               AND ($8 != 'exclude' OR NOT objects.is_delete_marker)
               AND ($8 != 'only' OR objects.is_delete_marker)
             -- name, then version, as tiebreaks so two versions of the same
             -- key tying on the sort column still sort deterministically
             ORDER BY %I %s, name COLLATE "C" %s, COALESCE(version, '') %s)
            LIMIT $5 OFFSET $6
            $sql$, v_sort_order, v_order_by, v_sort_order, v_sort_order, v_sort_order
        ) USING v_prefix_start, v_combined_levels, v_prefix, bucketname, v_limit, offsets, noncurrent_versions, delete_markers;
        RETURN;
    END IF;

    -- ========================================================================
    -- NAME SORTING: Hybrid skip-scan with batch optimization
    -- ========================================================================

    -- Calculate upper bound for prefix filtering
    IF v_prefix_lower = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix_lower, 1) = v_delimiter THEN
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(v_delimiter) + 1);
    ELSE
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(right(v_prefix_lower, 1)) + 1);
    END IF;

    -- Build a resume-safe batch query. The exact-name branch returns remaining
    -- versions after the current (archived_at, version) boundary; the strict
    -- name branch returns subsequent keys. UNION ALL keeps both predicates
    -- independently indexable.
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT * FROM (' ||
                '(SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata, o.version, o.archived_at, o.is_delete_marker, o.is_versioned FROM storage.objects o ' ||
                'WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" = $2 AND ($5::timestamptz IS NULL OR COALESCE(o.archived_at, ''infinity''::timestamptz) < $5 OR (COALESCE(o.archived_at, ''infinity''::timestamptz) = $5 AND COALESCE(o.version, '''') > $6))' ||
                v_version_filter || ' ORDER BY COALESCE(o.archived_at, ''infinity''::timestamptz) DESC, COALESCE(o.version, '''') ASC LIMIT $4) UNION ALL ' ||
                '(SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata, o.version, o.archived_at, o.is_delete_marker, o.is_versioned FROM storage.objects o ' ||
                'WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" > $2 AND lower(o.name) COLLATE "C" < $3' || v_version_filter ||
                ' ORDER BY lower(o.name) COLLATE "C" ASC, COALESCE(o.archived_at, ''infinity''::timestamptz) DESC, COALESCE(o.version, '''') ASC LIMIT $4)' ||
                ') sub ORDER BY lower(sub.name) COLLATE "C" ASC, COALESCE(sub.archived_at, ''infinity''::timestamptz) DESC, COALESCE(sub.version, '''') ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT * FROM (' ||
                '(SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata, o.version, o.archived_at, o.is_delete_marker, o.is_versioned FROM storage.objects o ' ||
                'WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" = $2 AND ($5::timestamptz IS NULL OR COALESCE(o.archived_at, ''infinity''::timestamptz) < $5 OR (COALESCE(o.archived_at, ''infinity''::timestamptz) = $5 AND COALESCE(o.version, '''') > $6))' ||
                v_version_filter || ' ORDER BY COALESCE(o.archived_at, ''infinity''::timestamptz) DESC, COALESCE(o.version, '''') ASC LIMIT $4) UNION ALL ' ||
                '(SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata, o.version, o.archived_at, o.is_delete_marker, o.is_versioned FROM storage.objects o ' ||
                'WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" > $2' || v_version_filter ||
                ' ORDER BY lower(o.name) COLLATE "C" ASC, COALESCE(o.archived_at, ''infinity''::timestamptz) DESC, COALESCE(o.version, '''') ASC LIMIT $4)' ||
                ') sub ORDER BY lower(sub.name) COLLATE "C" ASC, COALESCE(sub.archived_at, ''infinity''::timestamptz) DESC, COALESCE(sub.version, '''') ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT * FROM (' ||
                '(SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata, o.version, o.archived_at, o.is_delete_marker, o.is_versioned FROM storage.objects o ' ||
                'WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" = $2 AND ($5::timestamptz IS NULL OR COALESCE(o.archived_at, ''infinity''::timestamptz) < $5 OR (COALESCE(o.archived_at, ''infinity''::timestamptz) = $5 AND COALESCE(o.version, '''') > $6))' ||
                v_version_filter || ' ORDER BY COALESCE(o.archived_at, ''infinity''::timestamptz) DESC, COALESCE(o.version, '''') ASC LIMIT $4) UNION ALL ' ||
                '(SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata, o.version, o.archived_at, o.is_delete_marker, o.is_versioned FROM storage.objects o ' ||
                'WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 AND lower(o.name) COLLATE "C" >= $3' || v_version_filter ||
                ' ORDER BY lower(o.name) COLLATE "C" DESC, COALESCE(o.archived_at, ''infinity''::timestamptz) DESC, COALESCE(o.version, '''') ASC LIMIT $4)' ||
                ') sub ORDER BY lower(sub.name) COLLATE "C" DESC, COALESCE(sub.archived_at, ''infinity''::timestamptz) DESC, COALESCE(sub.version, '''') ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT * FROM (' ||
                '(SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata, o.version, o.archived_at, o.is_delete_marker, o.is_versioned FROM storage.objects o ' ||
                'WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" = $2 AND ($5::timestamptz IS NULL OR COALESCE(o.archived_at, ''infinity''::timestamptz) < $5 OR (COALESCE(o.archived_at, ''infinity''::timestamptz) = $5 AND COALESCE(o.version, '''') > $6))' ||
                v_version_filter || ' ORDER BY COALESCE(o.archived_at, ''infinity''::timestamptz) DESC, COALESCE(o.version, '''') ASC LIMIT $4) UNION ALL ' ||
                '(SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata, o.version, o.archived_at, o.is_delete_marker, o.is_versioned FROM storage.objects o ' ||
                'WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2' || v_version_filter ||
                ' ORDER BY lower(o.name) COLLATE "C" DESC, COALESCE(o.archived_at, ''infinity''::timestamptz) DESC, COALESCE(o.version, '''') ASC LIMIT $4)' ||
                ') sub ORDER BY lower(sub.name) COLLATE "C" DESC, COALESCE(sub.archived_at, ''infinity''::timestamptz) DESC, COALESCE(sub.version, '''') ASC LIMIT $4';
        END IF;
    END IF;

    -- Keep the delete-marker predicate literal so the cached generic
    -- plan can use idx_objects_delete_markers during the main-loop peek.
    IF delete_markers = 'only' THEN
        IF v_multi_row THEN
            v_delete_marker_peek_query :=
                'SELECT marker_page.name FROM (' || v_batch_query || ') marker_page LIMIT 1';
        ELSIF v_is_asc THEN
            -- Two separate literal query strings, not one gated by a bound
            -- boolean: folding "$n AND op1 OR NOT $n AND op2" into a single
            -- query defeats the generic plan's ability to push either
            -- comparison into the index. Branching in PL/pgSQL control flow
            -- instead keeps each query's index condition intact.
            v_delete_marker_peek_query :=
                'SELECT o.name FROM storage.objects o WHERE o.bucket_id = $1 ' ||
                'AND lower(o.name) COLLATE "C" >= $2' ||
                CASE WHEN v_upper_bound IS NOT NULL
                    THEN ' AND lower(o.name) COLLATE "C" < $3'
                    ELSE ''
                END ||
                v_version_filter ||
                ' ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1';
            -- Strict variant: used once the single-row ASC batch advance
            -- (below) has left v_next_seek pointing at the last row already
            -- emitted, so a plain >= would re-match it forever.
            v_delete_marker_peek_query_strict :=
                'SELECT o.name FROM storage.objects o WHERE o.bucket_id = $1 ' ||
                'AND lower(o.name) COLLATE "C" > $2' ||
                CASE WHEN v_upper_bound IS NOT NULL
                    THEN ' AND lower(o.name) COLLATE "C" < $3'
                    ELSE ''
                END ||
                v_version_filter ||
                ' ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1';
        ELSE
            v_delete_marker_peek_query :=
                'SELECT o.name FROM storage.objects o WHERE o.bucket_id = $1 ' ||
                'AND lower(o.name) COLLATE "C" < $2' ||
                CASE WHEN v_upper_bound IS NOT NULL
                    THEN ' AND lower(o.name) COLLATE "C" >= $3'
                    ELSE ''
                END ||
                v_version_filter ||
                ' ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1';
        END IF;
    END IF;

    -- Initialize seek position
    IF v_is_asc THEN
        v_next_seek := v_prefix_lower;
    ELSE
        -- DESC performs one specialized initial seek so partial current-version
        -- and delete-marker indexes remain available.
        EXECUTE format(
            'SELECT o.name FROM storage.objects o WHERE o.bucket_id = $1%s%s ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1',
            CASE WHEN v_upper_bound IS NOT NULL
                THEN ' AND lower(o.name) COLLATE "C" >= $2 AND lower(o.name) COLLATE "C" < $3'
                ELSE ''
            END,
            v_version_filter
        )
        INTO v_peek_name
        USING bucketname, v_prefix_lower, v_upper_bound;

        IF v_peek_name IS NOT NULL THEN
            v_next_seek := lower(v_peek_name) || v_delimiter;
        ELSE
            RETURN;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch and
    -- the delete-marker-only path
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= v_limit;

        v_previous_seek := v_next_seek;
        v_previous_seek_at := v_next_seek_at;
        v_previous_seek_version := v_next_seek_version;
        v_previous_count := v_count;
        v_previous_skipped := v_skipped;

        -- STEP 1: PEEK
        v_peek_name := NULL;
        IF delete_markers = 'only' THEN
            EXECUTE CASE WHEN v_next_seek_strict
                THEN v_delete_marker_peek_query_strict
                ELSE v_delete_marker_peek_query
            END
                INTO v_peek_name
                USING bucketname, v_next_seek,
                    CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix_lower) ELSE v_prefix_lower END,
                    1, v_next_seek_at, v_next_seek_version;
        ELSIF v_multi_row AND v_next_seek_at IS NOT NULL THEN
            SELECT o.name INTO v_peek_name
            FROM storage.objects o
            WHERE o.bucket_id = bucketname
              AND lower(o.name) COLLATE "C" = v_next_seek
              AND (COALESCE(o.archived_at, 'infinity'::timestamptz) < v_next_seek_at
                   OR (COALESCE(o.archived_at, 'infinity'::timestamptz) = v_next_seek_at
                       AND COALESCE(o.version, '') > v_next_seek_version))
              AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
              AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
              AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
              AND (delete_markers != 'only' OR o.is_delete_marker)
            ORDER BY COALESCE(o.archived_at, 'infinity'::timestamptz) DESC,
                     COALESCE(o.version, '') ASC
            LIMIT 1;

            -- The current key is exhausted. Clear its version boundary and
            -- make the following ASC name peek strict. Appending '/' is not a
            -- valid lexical successor because keys ending in characters such
            -- as '!' sort between the exhausted name and name || '/'.
            IF v_peek_name IS NULL THEN
                IF v_is_asc THEN
                    v_next_seek_strict := true;
                END IF;
                v_next_seek_at := NULL;
                v_next_seek_version := '';
            END IF;
        END IF;

        -- Single-row mode is always noncurrent_versions='exclude'. Keep the
        -- current-row predicate literal so generic plans use the current index.
        IF delete_markers != 'only' AND v_peek_name IS NULL AND NOT v_multi_row THEN
            IF v_is_asc THEN
                IF v_next_seek_strict AND v_upper_bound IS NOT NULL THEN
                    SELECT o.name INTO v_peek_name FROM storage.objects o
                    WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" > v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                      AND o.archived_at IS NULL
                      AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                    ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
                ELSIF v_next_seek_strict THEN
                    SELECT o.name INTO v_peek_name FROM storage.objects o
                    WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" > v_next_seek
                      AND o.archived_at IS NULL
                      AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                    ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
                ELSIF v_upper_bound IS NOT NULL THEN
                    SELECT o.name INTO v_peek_name FROM storage.objects o
                    WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                      AND o.archived_at IS NULL
                      AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                    ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
                ELSE
                    SELECT o.name INTO v_peek_name FROM storage.objects o
                    WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek
                      AND o.archived_at IS NULL
                      AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                    ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
                END IF;
            ELSIF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                  AND o.archived_at IS NULL
                  AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek
                  AND o.archived_at IS NULL
                  AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            END IF;
        ELSIF delete_markers != 'only' AND v_peek_name IS NULL AND v_is_asc THEN
            IF v_next_seek_strict AND v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" > v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                  AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                  AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                  AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                  AND (delete_markers != 'only' OR o.is_delete_marker)
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            ELSIF v_next_seek_strict THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" > v_next_seek
                  AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                  AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                  AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                  AND (delete_markers != 'only' OR o.is_delete_marker)
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            ELSIF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                  AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                  AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                  AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                  AND (delete_markers != 'only' OR o.is_delete_marker)
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek
                  AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                  AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                  AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                  AND (delete_markers != 'only' OR o.is_delete_marker)
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSIF delete_markers != 'only' AND v_peek_name IS NULL THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                  AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                  AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                  AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                  AND (delete_markers != 'only' OR o.is_delete_marker)
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek
                  AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                  AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                  AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                  AND (delete_markers != 'only' OR o.is_delete_marker)
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- If the peek landed on a different key than we were tracking, any
        -- version boundary belongs to the OLD key and must not leak into the
        -- new one - e.g. the deleteMarkers='only' peek doesn't know or care
        -- whether it's continuing the same key or jumping to a new one, so
        -- it never clears these itself.
        IF lower(v_peek_name) IS DISTINCT FROM v_next_seek THEN
            v_next_seek_at := NULL;
            v_next_seek_version := '';
        END IF;

        -- The peek is authoritative for the next key to process. This is
        -- especially important after exhausting a multi-version key: the
        -- version boundary has been cleared, so executing the batch against
        -- a stale v_next_seek would replay every version of that old key.
        v_next_seek := lower(v_peek_name);
        v_next_seek_strict := false;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(lower(v_peek_name), v_prefix_lower, v_delimiter);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Handle offset, emit if needed, skip to next folder
            IF v_skipped < offsets THEN
                v_skipped := v_skipped + 1;
            ELSE
                name := substring(rtrim(storage.get_common_prefix(v_peek_name, v_prefix, v_delimiter), v_delimiter) from v_prefix_len + 1);
                id := NULL;
                updated_at := NULL;
                created_at := NULL;
                last_accessed_at := NULL;
                metadata := NULL;
                version := NULL;
                archived_at := NULL;
                is_delete_marker := NULL;
                is_versioned := NULL;
                RETURN NEXT;
                v_count := v_count + 1;
            END IF;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := lower(left(v_common_prefix, -1)) || chr(ascii(v_delimiter) + 1);
            ELSE
                v_next_seek := lower(v_common_prefix);
            END IF;
            v_next_seek_at := NULL;
            v_next_seek_version := '';
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix_lower is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query
                USING bucketname, v_next_seek,
                    CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix_lower) ELSE v_prefix_lower END, v_file_batch_size,
                    v_next_seek_at, v_next_seek_version
            LOOP
                v_common_prefix := storage.get_common_prefix(lower(v_current.name), v_prefix_lower, v_delimiter);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it. Reset
                    -- strict mode too - it may have been set by an earlier
                    -- row in this same batch (see the single-row ASC advance
                    -- below), and v_next_seek here is the folder-triggering
                    -- row's own name, which the next peek must find inclusively.
                    v_next_seek := CASE
                        WHEN v_is_asc THEN lower(v_current.name)
                        ELSE lower(v_current.name) || v_delimiter
                    END;
                    v_next_seek_at := NULL;
                    v_next_seek_version := '';
                    v_next_seek_strict := false;
                    EXIT;
                END IF;

                -- Handle offset skipping
                IF v_skipped < offsets THEN
                    v_skipped := v_skipped + 1;
                ELSE
                    -- Emit file
                    name := substring(v_current.name from v_prefix_len + 1);
                    id := v_current.id;
                    updated_at := v_current.updated_at;
                    created_at := v_current.created_at;
                    last_accessed_at := v_current.last_accessed_at;
                    metadata := v_current.metadata;
                    version := v_current.version;
                    archived_at := v_current.archived_at;
                    is_delete_marker := v_current.is_delete_marker;
                    is_versioned := v_current.is_versioned;
                    RETURN NEXT;
                    v_count := v_count + 1;
                END IF;

                -- Multi-row mode must remain on this key until all of its
                -- versions have crossed the internal batch boundary.
                IF v_multi_row THEN
                    v_next_seek := lower(v_current.name);
                    v_next_seek_at := COALESCE(v_current.archived_at, 'infinity'::timestamptz);
                    v_next_seek_version := COALESCE(v_current.version, '');
                ELSIF v_is_asc THEN
                    -- Appending the delimiter as a fake lexical successor would
                    -- skip a real key like `name || '!'` (or any character
                    -- sorting below the delimiter), which sorts between `name`
                    -- and `name || delimiter`. Track the real name and mark the
                    -- next comparison strict instead - same fix as the
                    -- exhausted-key case above.
                    v_next_seek := lower(v_current.name);
                    v_next_seek_strict := true;
                ELSE
                    v_next_seek := lower(v_current.name);
                END IF;

                EXIT WHEN v_count >= v_limit;
            END LOOP;
        END IF;

        IF v_count = v_previous_count
           AND v_skipped = v_previous_skipped
           AND v_next_seek IS NOT DISTINCT FROM v_previous_seek
           AND v_next_seek_at IS NOT DISTINCT FROM v_previous_seek_at
           AND v_next_seek_version IS NOT DISTINCT FROM v_previous_seek_version THEN
            RAISE EXCEPTION 'storage.search made no progress at seek (%, %, %)',
                v_next_seek, v_next_seek_at, v_next_seek_version;
        END IF;
    END LOOP;
END;
$_$;


ALTER FUNCTION "storage"."search"("prefix" "text", "bucketname" "text", "limits" integer, "levels" integer, "offsets" integer, "search" "text", "sortcolumn" "text", "sortorder" "text", "noncurrent_versions" "text", "delete_markers" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."search_by_timestamp"("p_prefix" "text", "p_bucket_id" "text", "p_limit" integer, "p_level" integer, "p_start_after" "text", "p_sort_order" "text", "p_sort_column" "text", "p_sort_column_after" "text", "noncurrent_versions" "text" DEFAULT 'exclude'::"text", "delete_markers" "text" DEFAULT 'exclude'::"text", "p_start_after_version" "text" DEFAULT ''::"text") RETURNS TABLE("key" "text", "name" "text", "id" "uuid", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "metadata" "jsonb", "version" "text", "archived_at" timestamp with time zone, "is_delete_marker" boolean, "is_versioned" boolean)
    LANGUAGE "plpgsql" STABLE
    AS $_$
DECLARE
    v_cursor_op text;
    v_query text;
    v_prefix text;
    v_prefix_pattern text;
    v_sort_order text;
    v_sort_column text;
    v_version_tiebreak text;
BEGIN
    v_prefix := coalesce(p_prefix, '');
    -- Keep the raw prefix for common-prefix calculations and escape only LIKE metacharacters.
    v_prefix_pattern := replace(v_prefix, chr(92), chr(92) || chr(92));
    v_prefix_pattern := replace(v_prefix_pattern, '%', chr(92) || '%');
    v_prefix_pattern := replace(v_prefix_pattern, '_', chr(92) || '_');

    -- COALESCE first: NULL NOT IN (...) evaluates to NULL (not TRUE), so a
    -- bare NOT IN check silently leaves an explicit NULL argument unreset.
    noncurrent_versions := COALESCE(noncurrent_versions, 'exclude');
    delete_markers := COALESCE(delete_markers, 'exclude');
    IF noncurrent_versions NOT IN ('exclude', 'only', 'include') THEN
        noncurrent_versions := 'exclude';
    END IF;
    IF delete_markers NOT IN ('exclude', 'only', 'include') THEN
        delete_markers := 'exclude';
    END IF;

    -- $9 is only populated in multi-row mode; it's always '' otherwise, so
    -- only use each row's real version as a tiebreak in multi-row mode.
    v_version_tiebreak := CASE WHEN noncurrent_versions IN ('only', 'include') THEN 'COALESCE(version, '''')' ELSE '''''' END;

    -- Defense-in-depth: this function is independently reachable and must
    -- not trust p_sort_order/p_sort_column to already be validated by a
    -- caller. Normalize to the same strict allow-list storage.search_v2
    -- uses before interpolating anything into dynamic SQL below.
    v_sort_order := lower(coalesce(p_sort_order, 'asc'));
    IF v_sort_order NOT IN ('asc', 'desc') THEN
        v_sort_order := 'asc';
    END IF;

    v_sort_column := lower(coalesce(p_sort_column, 'updated_at'));
    IF v_sort_column NOT IN ('updated_at', 'created_at') THEN
        v_sort_column := 'updated_at';
    END IF;

    IF v_sort_order = 'asc' THEN
        v_cursor_op := '>';
    ELSE
        v_cursor_op := '<';
    END IF;

    v_query := format($sql$
        WITH raw_objects AS (
            SELECT
                o.name AS obj_name,
                o.id AS obj_id,
                o.updated_at AS obj_updated_at,
                o.created_at AS obj_created_at,
                o.last_accessed_at AS obj_last_accessed_at,
                o.metadata AS obj_metadata,
                o.version AS obj_version,
                o.archived_at AS obj_archived_at,
                o.is_delete_marker AS obj_is_delete_marker,
                o.is_versioned AS obj_is_versioned,
                storage.get_common_prefix(o.name, $1, '/') AS common_prefix
            FROM storage.objects o
            WHERE o.bucket_id = $2
              AND o.name COLLATE "C" LIKE $10 || '%%'
              AND ($7 != 'exclude' OR o.archived_at IS NULL)
              AND ($7 != 'only' OR o.archived_at IS NOT NULL)
              AND ($8 != 'exclude' OR NOT o.is_delete_marker)
              AND ($8 != 'only' OR o.is_delete_marker)
        ),
        -- Aggregate common prefixes (folders)
        -- Both created_at and updated_at use MIN(obj_created_at) to match the old prefixes table behavior
        aggregated_prefixes AS (
            SELECT
                common_prefix AS name,
                NULL::uuid AS id,
                MIN(obj_created_at) AS updated_at,
                MIN(obj_created_at) AS created_at,
                NULL::timestamptz AS last_accessed_at,
                NULL::jsonb AS metadata,
                NULL::text AS version,
                NULL::timestamptz AS archived_at,
                NULL::boolean AS is_delete_marker,
                NULL::boolean AS is_versioned,
                TRUE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NOT NULL
            GROUP BY common_prefix
        ),
        leaf_objects AS (
            SELECT
                obj_name AS name,
                obj_id AS id,
                obj_updated_at AS updated_at,
                obj_created_at AS created_at,
                obj_last_accessed_at AS last_accessed_at,
                obj_metadata AS metadata,
                obj_version AS version,
                obj_archived_at AS archived_at,
                obj_is_delete_marker AS is_delete_marker,
                obj_is_versioned AS is_versioned,
                FALSE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NULL
        ),
        combined AS (
            SELECT * FROM aggregated_prefixes
            UNION ALL
            SELECT * FROM leaf_objects
        ),
        filtered AS (
            SELECT *
            FROM combined
            WHERE (
                $5 = ''
                OR ROW(
                    COALESCE(date_trunc('milliseconds', %I), 'epoch'::timestamptz),
                    name COLLATE "C",
                    %s
                ) %s ROW(
                    -- truncated the same way as the stored value above
                    date_trunc('milliseconds', COALESCE(NULLIF($6, '')::timestamptz, 'epoch'::timestamptz)),
                    $5,
                    $9
                )
            )
        )
        SELECT
            split_part(name, '/', $3) AS key,
            name,
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata,
            version,
            archived_at,
            is_delete_marker,
            is_versioned
        FROM filtered
        ORDER BY
            COALESCE(date_trunc('milliseconds', %I), 'epoch'::timestamptz) %s,
            name COLLATE "C" %s,
            COALESCE(version, '') %s
        LIMIT $4
    $sql$,
        v_sort_column,
        v_version_tiebreak,
        v_cursor_op,
        v_sort_column,
        v_sort_order,
        v_sort_order,
        v_sort_order
    );

    -- version is the third tiebreak component for two versions of the same
    -- key tying on both timestamp and name (see filtered CTE / ORDER BY above)
    RETURN QUERY EXECUTE v_query
    USING v_prefix, p_bucket_id, p_level, p_limit, p_start_after, p_sort_column_after, noncurrent_versions, delete_markers, coalesce(p_start_after_version, ''), v_prefix_pattern;
END;
$_$;


ALTER FUNCTION "storage"."search_by_timestamp"("p_prefix" "text", "p_bucket_id" "text", "p_limit" integer, "p_level" integer, "p_start_after" "text", "p_sort_order" "text", "p_sort_column" "text", "p_sort_column_after" "text", "noncurrent_versions" "text", "delete_markers" "text", "p_start_after_version" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."search_v2"("prefix" "text", "bucket_name" "text", "limits" integer DEFAULT 100, "levels" integer DEFAULT 1, "start_after" "text" DEFAULT ''::"text", "sort_order" "text" DEFAULT 'asc'::"text", "sort_column" "text" DEFAULT 'name'::"text", "sort_column_after" "text" DEFAULT ''::"text", "noncurrent_versions" "text" DEFAULT 'exclude'::"text", "delete_markers" "text" DEFAULT 'exclude'::"text", "start_after_archived_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "start_after_version" "text" DEFAULT ''::"text", "start_after_is_continuation" boolean DEFAULT false) RETURNS TABLE("key" "text", "name" "text", "id" "uuid", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "metadata" "jsonb", "version" "text", "archived_at" timestamp with time zone, "is_delete_marker" boolean, "is_versioned" boolean)
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
    v_sort_col text;
    v_sort_ord text;
    v_limit int;
BEGIN
    -- Cap limit to maximum of 1500 records
    v_limit := LEAST(coalesce(limits, 100), 1500);

    -- Validate and normalize sort_order
    v_sort_ord := lower(coalesce(sort_order, 'asc'));
    IF v_sort_ord NOT IN ('asc', 'desc') THEN
        v_sort_ord := 'asc';
    END IF;

    -- Validate and normalize sort_column
    v_sort_col := lower(coalesce(sort_column, 'name'));
    IF v_sort_col NOT IN ('name', 'updated_at', 'created_at') THEN
        v_sort_col := 'name';
    END IF;

    -- Route to appropriate implementation
    IF v_sort_col = 'name' THEN
        -- Use list_objects_with_delimiter for name sorting (most efficient: O(k * log n))
        RETURN QUERY
        SELECT
            split_part(l.name, '/', levels) AS key,
            l.name AS name,
            l.id,
            l.updated_at,
            l.created_at,
            l.last_accessed_at,
            l.metadata,
            l.version,
            l.archived_at,
            l.is_delete_marker,
            l.is_versioned
        FROM storage.list_objects_with_delimiter(
            bucket_name,
            coalesce(prefix, ''),
            '/',
            v_limit,
            CASE WHEN start_after_is_continuation THEN '' ELSE start_after END,
            CASE WHEN start_after_is_continuation THEN start_after ELSE '' END,
            v_sort_ord,
            noncurrent_versions,
            delete_markers,
            start_after_archived_at,
            start_after_version
        ) l;
    ELSE
        -- Use aggregation approach for timestamp sorting
        -- Not efficient for large datasets but supports correct pagination
        RETURN QUERY SELECT * FROM storage.search_by_timestamp(
            prefix, bucket_name, v_limit, levels, start_after,
            v_sort_ord, v_sort_col, sort_column_after,
            noncurrent_versions, delete_markers, start_after_version
        );
    END IF;
END;
$$;


ALTER FUNCTION "storage"."search_v2"("prefix" "text", "bucket_name" "text", "limits" integer, "levels" integer, "start_after" "text", "sort_order" "text", "sort_column" "text", "sort_column_after" "text", "noncurrent_versions" "text", "delete_markers" "text", "start_after_archived_at" timestamp with time zone, "start_after_version" "text", "start_after_is_continuation" boolean) OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


ALTER FUNCTION "storage"."update_updated_at_column"() OWNER TO "supabase_storage_admin";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "actor_id" "uuid",
    "action" "public"."audit_action" NOT NULL,
    "target_table" "text" NOT NULL,
    "target_id" "uuid",
    "before" "jsonb",
    "after" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cart_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "tab_id" "uuid" NOT NULL,
    "participant_id" "uuid",
    "item_id" "uuid" NOT NULL,
    "qty" integer NOT NULL,
    "modifiers" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "shared" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "cart_items_qty_check" CHECK ((("qty" >= 1) AND ("qty" <= 99)))
);


ALTER TABLE "public"."cart_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_sales" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "hour" integer NOT NULL,
    "sales_cents" integer DEFAULT 0 NOT NULL,
    "ivu_state_cents" integer DEFAULT 0 NOT NULL,
    "ivu_municipal_cents" integer DEFAULT 0 NOT NULL,
    "tips_cents" integer DEFAULT 0 NOT NULL,
    "covers" integer DEFAULT 0 NOT NULL,
    "orders" integer DEFAULT 0 NOT NULL,
    "card_cents" integer DEFAULT 0 NOT NULL,
    "ath_cents" integer DEFAULT 0 NOT NULL,
    "cash_cents" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "daily_sales_hour_check" CHECK ((("hour" >= 0) AND ("hour" <= 23)))
);


ALTER TABLE "public"."daily_sales" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."demo_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "restaurant_name" "text",
    "email" "text" NOT NULL,
    "phone" "text",
    "message" "text",
    "locale" "public"."app_locale" DEFAULT 'es'::"public"."app_locale" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "demo_requests_email_check" CHECK (("email" ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'::"text")),
    CONSTRAINT "demo_requests_message_check" CHECK (("length"("message") <= 2000)),
    CONSTRAINT "demo_requests_name_check" CHECK ((("length"("name") >= 1) AND ("length"("name") <= 120))),
    CONSTRAINT "demo_requests_restaurant_name_check" CHECK (("length"("restaurant_name") <= 120))
);


ALTER TABLE "public"."demo_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."devices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "kind" "public"."device_kind" NOT NULL,
    "last_seen_at" timestamp with time zone,
    "app_version" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."devices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dining_tables" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "label" "text" NOT NULL,
    "seats" integer,
    "area" "text",
    "qr_token_hash" "text",
    "token_version" integer DEFAULT 1 NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "shape" "text" DEFAULT 'square'::"text" NOT NULL,
    "pos_x" numeric(5,2),
    "pos_y" numeric(5,2),
    CONSTRAINT "dining_tables_label_check" CHECK ((("length"("label") >= 1) AND ("length"("label") <= 20))),
    CONSTRAINT "dining_tables_pos_x_check" CHECK ((("pos_x" >= (0)::numeric) AND ("pos_x" <= (100)::numeric))),
    CONSTRAINT "dining_tables_pos_y_check" CHECK ((("pos_y" >= (0)::numeric) AND ("pos_y" <= (100)::numeric))),
    CONSTRAINT "dining_tables_seats_check" CHECK ((("seats" >= 1) AND ("seats" <= 40))),
    CONSTRAINT "dining_tables_shape_check" CHECK (("shape" = ANY (ARRAY['square'::"text", 'round'::"text", 'long'::"text"]))),
    CONSTRAINT "dining_tables_token_version_check" CHECK (("token_version" >= 1))
);


ALTER TABLE "public"."dining_tables" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "kind" "public"."export_kind" NOT NULL,
    "period" "text",
    "file_path" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."exports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."guests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "phone_e164" "text",
    "consent_at" timestamp with time zone,
    "preferred_language" "public"."app_locale",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "guests_phone_e164_check" CHECK (("phone_e164" ~ '^\+[1-9][0-9]{6,14}$'::"text"))
);


ALTER TABLE "public"."guests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."item_availability_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "sold_out_at" timestamp with time zone NOT NULL,
    "back_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "item_availability_events_check" CHECK ((("back_at" IS NULL) OR ("back_at" >= "sold_out_at")))
);


ALTER TABLE "public"."item_availability_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."item_hotspots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "page_id" "uuid" NOT NULL,
    "x" numeric(6,5) NOT NULL,
    "y" numeric(6,5) NOT NULL,
    "width" numeric(6,5) NOT NULL,
    "height" numeric(6,5) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "item_hotspots_check" CHECK (((("x" + "width") <= 1.00001) AND (("y" + "height") <= 1.00001))),
    CONSTRAINT "item_hotspots_height_check" CHECK ((("height" > (0)::numeric) AND ("height" <= (1)::numeric))),
    CONSTRAINT "item_hotspots_width_check" CHECK ((("width" > (0)::numeric) AND ("width" <= (1)::numeric))),
    CONSTRAINT "item_hotspots_x_check" CHECK ((("x" >= (0)::numeric) AND ("x" <= (1)::numeric))),
    CONSTRAINT "item_hotspots_y_check" CHECK ((("y" >= (0)::numeric) AND ("y" <= (1)::numeric)))
);


ALTER TABLE "public"."item_hotspots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."item_modifier_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "group_id" "uuid" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."item_modifier_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."item_sales_daily" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "units" integer DEFAULT 0 NOT NULL,
    "revenue_cents" integer DEFAULT 0 NOT NULL,
    "modifier_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."item_sales_daily" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."ivu_monthly" WITH ("security_invoker"='true') AS
 SELECT "restaurant_id",
    ("date_trunc"('month'::"text", ("date")::timestamp with time zone))::"date" AS "month",
    "sum"("sales_cents") AS "sales_cents",
    "sum"("ivu_state_cents") AS "ivu_state_cents",
    "sum"("ivu_municipal_cents") AS "ivu_municipal_cents",
    "sum"("tips_cents") AS "tips_cents"
   FROM "public"."daily_sales" "d"
  GROUP BY "restaurant_id", ("date_trunc"('month'::"text", ("date")::timestamp with time zone));


ALTER VIEW "public"."ivu_monthly" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."memberships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."member_role" NOT NULL,
    "pin_hash" "text",
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."memberships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."menu_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "section_id" "uuid" NOT NULL,
    "name_es" "text" NOT NULL,
    "name_en" "text" NOT NULL,
    "description_es" "text",
    "description_en" "text",
    "price_cents" integer NOT NULL,
    "photo_path" "text",
    "is_available" boolean DEFAULT true NOT NULL,
    "sold_out_since" timestamp with time zone,
    "ai_confidence" numeric(3,2),
    "sort_order" integer DEFAULT 0 NOT NULL,
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    CONSTRAINT "menu_items_ai_confidence_check" CHECK ((("ai_confidence" >= (0)::numeric) AND ("ai_confidence" <= (1)::numeric))),
    CONSTRAINT "menu_items_check" CHECK (("is_available" OR ("sold_out_since" IS NOT NULL))),
    CONSTRAINT "menu_items_price_cents_check" CHECK (("price_cents" >= 0)),
    CONSTRAINT "menu_items_tags_check" CHECK (("tags" <@ ARRAY['vegetariano'::"text", 'sin_gluten'::"text", 'picante'::"text"]))
);


ALTER TABLE "public"."menu_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."menu_sections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "name_es" "text" NOT NULL,
    "name_en" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."menu_sections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."menu_themes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "palette" "jsonb" NOT NULL,
    "display_font" "text" NOT NULL,
    "body_font" "text" NOT NULL,
    "ornament" "text",
    "paper_texture" "public"."paper_texture" DEFAULT 'none'::"public"."paper_texture" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."menu_themes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."menu_uploads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "mime_type" "text" NOT NULL,
    "status" "public"."upload_status" DEFAULT 'processing'::"public"."upload_status" NOT NULL,
    "ai_result" "jsonb",
    "reviewed_by" "uuid",
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."menu_uploads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."modifier_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "name_es" "text" NOT NULL,
    "name_en" "text" NOT NULL,
    "min_select" integer DEFAULT 0 NOT NULL,
    "max_select" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "modifier_groups_check" CHECK (("max_select" >= "min_select")),
    CONSTRAINT "modifier_groups_max_select_check" CHECK (("max_select" >= 1)),
    CONSTRAINT "modifier_groups_min_select_check" CHECK (("min_select" >= 0))
);


ALTER TABLE "public"."modifier_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."modifier_options" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "group_id" "uuid" NOT NULL,
    "name_es" "text" NOT NULL,
    "name_en" "text" NOT NULL,
    "price_cents" integer DEFAULT 0 NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "modifier_options_price_cents_check" CHECK (("price_cents" >= 0))
);


ALTER TABLE "public"."modifier_options" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_item_shares" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "order_item_id" "uuid" NOT NULL,
    "participant_id" "uuid" NOT NULL,
    "cents" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "order_item_shares_cents_check" CHECK (("cents" >= 0))
);


ALTER TABLE "public"."order_item_shares" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "order_id" "uuid" NOT NULL,
    "item_id" "uuid",
    "name_snapshot_es" "text" NOT NULL,
    "name_snapshot_en" "text" NOT NULL,
    "unit_price_cents" integer NOT NULL,
    "qty" integer NOT NULL,
    "modifiers_snapshot" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "participant_id" "uuid",
    "shared" boolean DEFAULT false NOT NULL,
    "note" "text",
    "status" "public"."order_status" DEFAULT 'new'::"public"."order_status" NOT NULL,
    "voided_at" timestamp with time zone,
    "voided_by" "uuid",
    "void_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "order_items_check" CHECK ((("voided_at" IS NULL) = ("void_reason" IS NULL))),
    CONSTRAINT "order_items_note_check" CHECK (("length"("note") <= 200)),
    CONSTRAINT "order_items_qty_check" CHECK ((("qty" >= 1) AND ("qty" <= 99))),
    CONSTRAINT "order_items_unit_price_cents_check" CHECK (("unit_price_cents" >= 0))
);


ALTER TABLE "public"."order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "tab_id" "uuid" NOT NULL,
    "number" integer NOT NULL,
    "source" "public"."order_source" NOT NULL,
    "idempotency_key" "text" NOT NULL,
    "status" "public"."order_status" DEFAULT 'new'::"public"."order_status" NOT NULL,
    "guest_language" "public"."app_locale" DEFAULT 'es'::"public"."app_locale" NOT NULL,
    "created_by" "uuid",
    "device_id" "uuid",
    "synced_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "participant_id" "uuid",
    "opened_tab" boolean DEFAULT false NOT NULL,
    "after_payment" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."original_menu_pages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "image_path" "text" NOT NULL,
    "width" integer NOT NULL,
    "height" integer NOT NULL,
    "page_number" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "original_menu_pages_height_check" CHECK (("height" > 0)),
    CONSTRAINT "original_menu_pages_page_number_check" CHECK (("page_number" >= 1)),
    CONSTRAINT "original_menu_pages_width_check" CHECK (("width" > 0))
);


ALTER TABLE "public"."original_menu_pages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "provider" "public"."payment_provider" NOT NULL,
    "stripe_account_id" "text",
    "ath_keys_secret_id" "uuid",
    "status" "public"."provider_status" DEFAULT 'not_connected'::"public"."provider_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."payment_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_allocations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "payment_id" "uuid" NOT NULL,
    "order_item_id" "uuid" NOT NULL,
    "share_id" "uuid",
    "cents" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payment_allocations_cents_check" CHECK (("cents" > 0))
);


ALTER TABLE "public"."payment_allocations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "tab_id" "uuid" NOT NULL,
    "participant_id" "uuid",
    "method" "public"."payment_method" NOT NULL,
    "amount_cents" integer NOT NULL,
    "tip_cents" integer DEFAULT 0 NOT NULL,
    "ivu_state_cents" integer DEFAULT 0 NOT NULL,
    "ivu_municipal_cents" integer DEFAULT 0 NOT NULL,
    "status" "public"."payment_status" DEFAULT 'pending'::"public"."payment_status" NOT NULL,
    "provider_ref" "text",
    "idempotency_key" "text" NOT NULL,
    "fiscal_control_number" "text",
    "paid_at" timestamp with time zone,
    "confirmed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "split_option" "text",
    "for_participant_id" "uuid",
    "plan_id" "uuid",
    "plan_parts" integer,
    CONSTRAINT "payments_amount_cents_check" CHECK (("amount_cents" >= 0)),
    CONSTRAINT "payments_check" CHECK ((("status" = 'pending'::"public"."payment_status") OR ("status" = 'failed'::"public"."payment_status") OR ("paid_at" IS NOT NULL))),
    CONSTRAINT "payments_ivu_municipal_cents_check" CHECK (("ivu_municipal_cents" >= 0)),
    CONSTRAINT "payments_ivu_state_cents_check" CHECK (("ivu_state_cents" >= 0)),
    CONSTRAINT "payments_plan_parts_check" CHECK ((("plan_parts" >= 1) AND ("plan_parts" <= 20))),
    CONSTRAINT "payments_split_option_check" CHECK (("split_option" = ANY (ARRAY['mine'::"text", 'person'::"text", 'balance'::"text", 'plan'::"text"]))),
    CONSTRAINT "payments_tip_cents_check" CHECK (("tip_cents" >= 0))
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_admins" (
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."platform_admins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."print_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "order_id" "uuid" NOT NULL,
    "printer_id" "uuid",
    "kind" "public"."ticket_kind" NOT NULL,
    "status" "public"."print_status" DEFAULT 'queued'::"public"."print_status" NOT NULL,
    "error" "text",
    "printed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."print_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."printers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "model" "text",
    "ip_address" "text",
    "protocol" "public"."printer_protocol" DEFAULT 'browser'::"public"."printer_protocol" NOT NULL,
    "role" "public"."ticket_kind" NOT NULL,
    "width_chars" integer DEFAULT 42 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "printers_width_chars_check" CHECK ((("width_chars" >= 24) AND ("width_chars" <= 64)))
);


ALTER TABLE "public"."printers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "user_id" "uuid" NOT NULL,
    "full_name" "text",
    "phone" "text",
    "preferred_language" "public"."app_locale",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."qr_designs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "preset" "text" DEFAULT 'house'::"text" NOT NULL,
    "fg" "text" DEFAULT '#1E2B7E'::"text" NOT NULL,
    "bg" "text" DEFAULT '#FFFFFF'::"text" NOT NULL,
    "frame" "text" DEFAULT '#1E2B7E'::"text" NOT NULL,
    "frame_ink" "text" DEFAULT '#FFFFFF'::"text" NOT NULL,
    "dot_style" "public"."qr_dot_style" DEFAULT 'rounded'::"public"."qr_dot_style" NOT NULL,
    "eye_style" "public"."qr_eye_style" DEFAULT 'rounded'::"public"."qr_eye_style" NOT NULL,
    "logo_mode" "public"."qr_logo_mode" DEFAULT 'none'::"public"."qr_logo_mode" NOT NULL,
    "logo_path" "text",
    "frame_text_es" "text" DEFAULT 'Escanea para ordenar y pagar'::"text" NOT NULL,
    "frame_text_en" "text" DEFAULT 'Scan to order and pay'::"text" NOT NULL,
    "font" "public"."qr_font" DEFAULT 'modern'::"public"."qr_font" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "qr_designs_bg_check" CHECK (("bg" ~ '^#[0-9A-Fa-f]{6}$'::"text")),
    CONSTRAINT "qr_designs_check" CHECK ((("logo_mode" <> 'upload'::"public"."qr_logo_mode") OR ("logo_path" IS NOT NULL))),
    CONSTRAINT "qr_designs_fg_check" CHECK (("fg" ~ '^#[0-9A-Fa-f]{6}$'::"text")),
    CONSTRAINT "qr_designs_frame_check" CHECK (("frame" ~ '^#[0-9A-Fa-f]{6}$'::"text")),
    CONSTRAINT "qr_designs_frame_ink_check" CHECK (("frame_ink" ~ '^#[0-9A-Fa-f]{6}$'::"text"))
);


ALTER TABLE "public"."qr_designs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rate_limits" (
    "key" "text" NOT NULL,
    "window_start" timestamp with time zone NOT NULL,
    "hits" integer NOT NULL,
    CONSTRAINT "rate_limits_key_check" CHECK (("length"("key") <= 200))
);


ALTER TABLE "public"."rate_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."refunds" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "payment_id" "uuid" NOT NULL,
    "amount_cents" integer NOT NULL,
    "reason" "text" NOT NULL,
    "approved_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "refunds_amount_cents_check" CHECK (("amount_cents" > 0)),
    CONSTRAINT "refunds_reason_check" CHECK ((("length"("reason") >= 1) AND ("length"("reason") <= 500)))
);


ALTER TABLE "public"."refunds" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."restaurants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "address" "text",
    "phone" "text",
    "timezone" "text" DEFAULT 'America/Puerto_Rico'::"text" NOT NULL,
    "default_language" "public"."app_locale" DEFAULT 'es'::"public"."app_locale" NOT NULL,
    "default_menu_style" "public"."menu_style" DEFAULT 'house'::"public"."menu_style" NOT NULL,
    "ivu_state_bps" integer DEFAULT 1050 NOT NULL,
    "ivu_municipal_bps" integer DEFAULT 100 NOT NULL,
    "fiscal_mode" "public"."fiscal_mode" DEFAULT 'sit_beside'::"public"."fiscal_mode" NOT NULL,
    "plan" "text" DEFAULT 'A'::"text" NOT NULL,
    "status" "public"."restaurant_status" DEFAULT 'trial'::"public"."restaurant_status" NOT NULL,
    "trial_ends_at" timestamp with time zone,
    "onboarding_step" integer DEFAULT 1 NOT NULL,
    "next_order_number" integer DEFAULT 1001 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "brand_color" "text",
    "cover_path" "text",
    "qr_max_order_cents" integer DEFAULT 30000 NOT NULL,
    "qr_max_line_qty" integer DEFAULT 20 NOT NULL,
    "qr_max_tab_cents" integer DEFAULT 150000 NOT NULL,
    "max_people_per_table" integer DEFAULT 20 NOT NULL,
    CONSTRAINT "restaurants_brand_color_check" CHECK (("brand_color" ~ '^#[0-9A-Fa-f]{6}$'::"text")),
    CONSTRAINT "restaurants_ivu_municipal_bps_check" CHECK ((("ivu_municipal_bps" >= 0) AND ("ivu_municipal_bps" <= 10000))),
    CONSTRAINT "restaurants_ivu_state_bps_check" CHECK ((("ivu_state_bps" >= 0) AND ("ivu_state_bps" <= 10000))),
    CONSTRAINT "restaurants_max_people_per_table_check" CHECK ((("max_people_per_table" >= 2) AND ("max_people_per_table" <= 40))),
    CONSTRAINT "restaurants_name_check" CHECK ((("length"("name") >= 1) AND ("length"("name") <= 120))),
    CONSTRAINT "restaurants_next_order_number_check" CHECK (("next_order_number" >= 1001)),
    CONSTRAINT "restaurants_onboarding_step_check" CHECK ((("onboarding_step" >= 1) AND ("onboarding_step" <= 7))),
    CONSTRAINT "restaurants_qr_max_line_qty_check" CHECK ((("qr_max_line_qty" >= 1) AND ("qr_max_line_qty" <= 99))),
    CONSTRAINT "restaurants_qr_max_order_cents_check" CHECK ((("qr_max_order_cents" >= 500) AND ("qr_max_order_cents" <= 1000000))),
    CONSTRAINT "restaurants_qr_max_tab_cents_check" CHECK ((("qr_max_tab_cents" >= 500) AND ("qr_max_tab_cents" <= 5000000))),
    CONSTRAINT "restaurants_slug_check" CHECK ((("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::"text") AND (("length"("slug") >= 2) AND ("length"("slug") <= 60))))
);


ALTER TABLE "public"."restaurants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "tab_id" "uuid" NOT NULL,
    "kind" "public"."service_request_kind" NOT NULL,
    "status" "public"."service_request_status" DEFAULT 'open'::"public"."service_request_status" NOT NULL,
    "handled_by" "uuid",
    "handled_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."service_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."split_plan_units" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "order_item_id" "uuid" NOT NULL,
    "share_id" "uuid"
);


ALTER TABLE "public"."split_plan_units" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."split_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "tab_id" "uuid" NOT NULL,
    "parts" integer NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_by_participant" "uuid",
    "created_by_user" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "split_plans_parts_check" CHECK ((("parts" >= 2) AND ("parts" <= 20))),
    CONSTRAINT "split_plans_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'cancelled'::"text", 'done'::"text"])))
);


ALTER TABLE "public"."split_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "plan" "text" NOT NULL,
    "stripe_customer_id" "text",
    "status" "public"."subscription_status" DEFAULT 'trial'::"public"."subscription_status" NOT NULL,
    "trial_ends_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."support_access_grants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "requested_by" "uuid",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "expires_at" timestamp with time zone NOT NULL,
    "reason" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "support_access_grants_check" CHECK ((("approved_by" IS NULL) = ("approved_at" IS NULL))),
    CONSTRAINT "support_access_grants_reason_check" CHECK ((("length"("reason") >= 1) AND ("length"("reason") <= 500)))
);


ALTER TABLE "public"."support_access_grants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tab_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "tab_id" "uuid" NOT NULL,
    "auth_user_id" "uuid",
    "display_name" "text",
    "guest_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "guest_number" integer,
    "device_hash" "text",
    CONSTRAINT "tab_participants_device_hash_check" CHECK (("length"("device_hash") = 64)),
    CONSTRAINT "tab_participants_display_name_length" CHECK ((("length"("display_name") >= 1) AND ("length"("display_name") <= 24))),
    CONSTRAINT "tab_participants_guest_number_check" CHECK ((("guest_number" >= 1) AND ("guest_number" <= 999)))
);


ALTER TABLE "public"."tab_participants" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."tab_totals" AS
SELECT
    NULL::"uuid" AS "tab_id",
    NULL::"uuid" AS "restaurant_id",
    NULL::"uuid" AS "table_id",
    NULL::"public"."tab_status" AS "status",
    NULL::integer AS "subtotal_cents",
    NULL::integer AS "line_count";


ALTER VIEW "public"."tab_totals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tabs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "table_id" "uuid" NOT NULL,
    "status" "public"."tab_status" DEFAULT 'open'::"public"."tab_status" NOT NULL,
    "split_mode" "public"."split_mode" DEFAULT 'one'::"public"."split_mode" NOT NULL,
    "split_count" integer,
    "party_size" integer,
    "opened_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "closed_at" timestamp with time zone,
    "pos_closed_at" timestamp with time zone,
    "pos_closed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "qr_limit_extra_cents" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "tabs_party_size_check" CHECK ((("party_size" >= 1) AND ("party_size" <= 40))),
    CONSTRAINT "tabs_qr_limit_extra_cents_check" CHECK ((("qr_limit_extra_cents" >= 0) AND ("qr_limit_extra_cents" <= 50000000))),
    CONSTRAINT "tabs_split_count_check" CHECK ((("split_count" >= 2) AND ("split_count" <= 20)))
);


ALTER TABLE "public"."tabs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."usage_fees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "period" "date" NOT NULL,
    "card_volume_cents" integer DEFAULT 0 NOT NULL,
    "ath_volume_cents" integer DEFAULT 0 NOT NULL,
    "fee_cents" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."usage_fees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."webhook_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider" "text" NOT NULL,
    "event_id" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "processed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."webhook_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."write_off_allocations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "write_off_id" "uuid" NOT NULL,
    "order_item_id" "uuid" NOT NULL,
    "share_id" "uuid",
    "cents" integer NOT NULL,
    CONSTRAINT "write_off_allocations_cents_check" CHECK (("cents" > 0))
);


ALTER TABLE "public"."write_off_allocations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."write_offs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "tab_id" "uuid" NOT NULL,
    "participant_id" "uuid",
    "scope" "text" NOT NULL,
    "cents" integer NOT NULL,
    "reason" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "write_offs_cents_check" CHECK (("cents" > 0)),
    CONSTRAINT "write_offs_reason_check" CHECK ((("length"("btrim"("reason")) >= 3) AND ("length"("btrim"("reason")) <= 300))),
    CONSTRAINT "write_offs_scope_check" CHECK (("scope" = ANY (ARRAY['person'::"text", 'table'::"text", 'balance'::"text"])))
);


ALTER TABLE "public"."write_offs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "storage"."buckets" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "owner" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "public" boolean DEFAULT false,
    "avif_autodetection" boolean DEFAULT false,
    "file_size_limit" bigint,
    "allowed_mime_types" "text"[],
    "owner_id" "text",
    "type" "storage"."buckettype" DEFAULT 'STANDARD'::"storage"."buckettype" NOT NULL,
    "versioning_status" "text" DEFAULT 'DISABLED'::"text" NOT NULL,
    "lifecycle_configuration" "jsonb",
    "lifecycle_configuration_generation" "uuid",
    CONSTRAINT "buckets_lifecycle_configuration_pair_check" CHECK ((("lifecycle_configuration" IS NULL) = ("lifecycle_configuration_generation" IS NULL))),
    CONSTRAINT "buckets_lifecycle_configuration_shape_check" CHECK ((("lifecycle_configuration" IS NULL) OR (("jsonb_typeof"("lifecycle_configuration") = 'object'::"text") AND ("lifecycle_configuration" ? 'rules'::"text") AND
CASE
    WHEN ("jsonb_typeof"(("lifecycle_configuration" -> 'rules'::"text")) = 'array'::"text") THEN (("jsonb_array_length"(("lifecycle_configuration" -> 'rules'::"text")) >= 1) AND ("jsonb_array_length"(("lifecycle_configuration" -> 'rules'::"text")) <= 1000))
    ELSE false
END))),
    CONSTRAINT "buckets_lifecycle_configuration_standard_only_check" CHECK ((("type" = 'STANDARD'::"storage"."buckettype") OR (("lifecycle_configuration" IS NULL) AND ("lifecycle_configuration_generation" IS NULL)))),
    CONSTRAINT "buckets_versioning_dark_check" CHECK (("versioning_status" = 'DISABLED'::"text")),
    CONSTRAINT "buckets_versioning_standard_only_check" CHECK ((("type" = 'STANDARD'::"storage"."buckettype") OR ("versioning_status" = 'DISABLED'::"text"))),
    CONSTRAINT "buckets_versioning_status_check" CHECK (("versioning_status" = ANY (ARRAY['DISABLED'::"text", 'ENABLED'::"text", 'SUSPENDED'::"text"])))
);


ALTER TABLE "storage"."buckets" OWNER TO "supabase_storage_admin";


COMMENT ON COLUMN "storage"."buckets"."owner" IS 'Field is deprecated, use owner_id instead';



CREATE TABLE IF NOT EXISTS "storage"."buckets_analytics" (
    "name" "text" NOT NULL,
    "type" "storage"."buckettype" DEFAULT 'ANALYTICS'::"storage"."buckettype" NOT NULL,
    "format" "text" DEFAULT 'ICEBERG'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "storage"."buckets_analytics" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."buckets_vectors" (
    "id" "text" NOT NULL,
    "type" "storage"."buckettype" DEFAULT 'VECTOR'::"storage"."buckettype" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "storage"."buckets_vectors" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."migrations" (
    "id" integer NOT NULL,
    "name" character varying(100) NOT NULL,
    "hash" character varying(40) NOT NULL,
    "executed_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "storage"."migrations" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."objects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bucket_id" "text",
    "name" "text",
    "owner" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_accessed_at" timestamp with time zone DEFAULT "now"(),
    "metadata" "jsonb",
    "path_tokens" "text"[] GENERATED ALWAYS AS ("string_to_array"("name", '/'::"text")) STORED,
    "version" "text",
    "owner_id" "text",
    "user_metadata" "jsonb",
    "archived_at" timestamp with time zone,
    "is_delete_marker" boolean DEFAULT false NOT NULL,
    "is_versioned" boolean DEFAULT false NOT NULL
);


ALTER TABLE "storage"."objects" OWNER TO "supabase_storage_admin";


COMMENT ON COLUMN "storage"."objects"."owner" IS 'Field is deprecated, use owner_id instead';



CREATE TABLE IF NOT EXISTS "storage"."s3_multipart_uploads" (
    "id" "text" NOT NULL,
    "in_progress_size" bigint DEFAULT 0 NOT NULL,
    "upload_signature" "text" NOT NULL,
    "bucket_id" "text" NOT NULL,
    "key" "text" NOT NULL COLLATE "pg_catalog"."C",
    "version" "text" NOT NULL,
    "owner_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_metadata" "jsonb",
    "metadata" "jsonb"
);


ALTER TABLE "storage"."s3_multipart_uploads" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."s3_multipart_uploads_parts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "upload_id" "text" NOT NULL,
    "size" bigint DEFAULT 0 NOT NULL,
    "part_number" integer NOT NULL,
    "bucket_id" "text" NOT NULL,
    "key" "text" NOT NULL COLLATE "pg_catalog"."C",
    "etag" "text" NOT NULL,
    "owner_id" "text",
    "version" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "storage"."s3_multipart_uploads_parts" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."vector_indexes" (
    "id" "text" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL COLLATE "pg_catalog"."C",
    "bucket_id" "text" NOT NULL,
    "data_type" "text" NOT NULL,
    "dimension" integer NOT NULL,
    "distance_metric" "text" NOT NULL,
    "metadata_configuration" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "storage"."vector_indexes" OWNER TO "supabase_storage_admin";


ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_sales"
    ADD CONSTRAINT "daily_sales_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_sales"
    ADD CONSTRAINT "daily_sales_restaurant_id_date_hour_key" UNIQUE ("restaurant_id", "date", "hour");



ALTER TABLE ONLY "public"."demo_requests"
    ADD CONSTRAINT "demo_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."devices"
    ADD CONSTRAINT "devices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."devices"
    ADD CONSTRAINT "devices_restaurant_id_id_key" UNIQUE ("restaurant_id", "id");



ALTER TABLE ONLY "public"."dining_tables"
    ADD CONSTRAINT "dining_tables_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dining_tables"
    ADD CONSTRAINT "dining_tables_qr_token_hash_key" UNIQUE ("qr_token_hash");



ALTER TABLE ONLY "public"."dining_tables"
    ADD CONSTRAINT "dining_tables_restaurant_id_id_key" UNIQUE ("restaurant_id", "id");



ALTER TABLE ONLY "public"."dining_tables"
    ADD CONSTRAINT "dining_tables_restaurant_id_label_key" UNIQUE ("restaurant_id", "label");



ALTER TABLE ONLY "public"."exports"
    ADD CONSTRAINT "exports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."guests"
    ADD CONSTRAINT "guests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."guests"
    ADD CONSTRAINT "guests_restaurant_id_id_key" UNIQUE ("restaurant_id", "id");



ALTER TABLE ONLY "public"."item_availability_events"
    ADD CONSTRAINT "item_availability_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."item_hotspots"
    ADD CONSTRAINT "item_hotspots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."item_modifier_groups"
    ADD CONSTRAINT "item_modifier_groups_item_id_group_id_key" UNIQUE ("item_id", "group_id");



ALTER TABLE ONLY "public"."item_modifier_groups"
    ADD CONSTRAINT "item_modifier_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."item_sales_daily"
    ADD CONSTRAINT "item_sales_daily_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."item_sales_daily"
    ADD CONSTRAINT "item_sales_daily_restaurant_id_item_id_date_key" UNIQUE ("restaurant_id", "item_id", "date");



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_user_id_restaurant_id_key" UNIQUE ("user_id", "restaurant_id");



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_restaurant_id_id_key" UNIQUE ("restaurant_id", "id");



ALTER TABLE ONLY "public"."menu_sections"
    ADD CONSTRAINT "menu_sections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."menu_sections"
    ADD CONSTRAINT "menu_sections_restaurant_id_id_key" UNIQUE ("restaurant_id", "id");



ALTER TABLE ONLY "public"."menu_themes"
    ADD CONSTRAINT "menu_themes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."menu_themes"
    ADD CONSTRAINT "menu_themes_restaurant_id_key" UNIQUE ("restaurant_id");



ALTER TABLE ONLY "public"."menu_uploads"
    ADD CONSTRAINT "menu_uploads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."modifier_groups"
    ADD CONSTRAINT "modifier_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."modifier_groups"
    ADD CONSTRAINT "modifier_groups_restaurant_id_id_key" UNIQUE ("restaurant_id", "id");



ALTER TABLE ONLY "public"."modifier_options"
    ADD CONSTRAINT "modifier_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."modifier_options"
    ADD CONSTRAINT "modifier_options_restaurant_id_id_key" UNIQUE ("restaurant_id", "id");



ALTER TABLE ONLY "public"."order_item_shares"
    ADD CONSTRAINT "order_item_shares_order_item_id_participant_id_key" UNIQUE ("order_item_id", "participant_id");



ALTER TABLE ONLY "public"."order_item_shares"
    ADD CONSTRAINT "order_item_shares_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_restaurant_id_id_key" UNIQUE ("restaurant_id", "id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_restaurant_id_idempotency_key_key" UNIQUE ("restaurant_id", "idempotency_key");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_restaurant_id_number_key" UNIQUE ("restaurant_id", "number");



ALTER TABLE ONLY "public"."original_menu_pages"
    ADD CONSTRAINT "original_menu_pages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."original_menu_pages"
    ADD CONSTRAINT "original_menu_pages_restaurant_id_id_key" UNIQUE ("restaurant_id", "id");



ALTER TABLE ONLY "public"."original_menu_pages"
    ADD CONSTRAINT "original_menu_pages_restaurant_id_page_number_key" UNIQUE ("restaurant_id", "page_number");



ALTER TABLE ONLY "public"."payment_accounts"
    ADD CONSTRAINT "payment_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_accounts"
    ADD CONSTRAINT "payment_accounts_restaurant_id_provider_key" UNIQUE ("restaurant_id", "provider");



ALTER TABLE ONLY "public"."payment_allocations"
    ADD CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_restaurant_id_id_key" UNIQUE ("restaurant_id", "id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_restaurant_id_idempotency_key_key" UNIQUE ("restaurant_id", "idempotency_key");



ALTER TABLE ONLY "public"."platform_admins"
    ADD CONSTRAINT "platform_admins_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."print_jobs"
    ADD CONSTRAINT "print_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."printers"
    ADD CONSTRAINT "printers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."printers"
    ADD CONSTRAINT "printers_restaurant_id_id_key" UNIQUE ("restaurant_id", "id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."qr_designs"
    ADD CONSTRAINT "qr_designs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."qr_designs"
    ADD CONSTRAINT "qr_designs_restaurant_id_key" UNIQUE ("restaurant_id");



ALTER TABLE ONLY "public"."rate_limits"
    ADD CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."refunds"
    ADD CONSTRAINT "refunds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurants"
    ADD CONSTRAINT "restaurants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurants"
    ADD CONSTRAINT "restaurants_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."service_requests"
    ADD CONSTRAINT "service_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."split_plan_units"
    ADD CONSTRAINT "split_plan_units_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."split_plans"
    ADD CONSTRAINT "split_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."split_plans"
    ADD CONSTRAINT "split_plans_restaurant_id_id_key" UNIQUE ("restaurant_id", "id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_restaurant_id_key" UNIQUE ("restaurant_id");



ALTER TABLE ONLY "public"."support_access_grants"
    ADD CONSTRAINT "support_access_grants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tab_participants"
    ADD CONSTRAINT "tab_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tab_participants"
    ADD CONSTRAINT "tab_participants_restaurant_id_id_key" UNIQUE ("restaurant_id", "id");



ALTER TABLE ONLY "public"."tabs"
    ADD CONSTRAINT "tabs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tabs"
    ADD CONSTRAINT "tabs_restaurant_id_id_key" UNIQUE ("restaurant_id", "id");



ALTER TABLE ONLY "public"."usage_fees"
    ADD CONSTRAINT "usage_fees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."usage_fees"
    ADD CONSTRAINT "usage_fees_restaurant_id_period_key" UNIQUE ("restaurant_id", "period");



ALTER TABLE ONLY "public"."webhook_events"
    ADD CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."webhook_events"
    ADD CONSTRAINT "webhook_events_provider_event_id_key" UNIQUE ("provider", "event_id");



ALTER TABLE ONLY "public"."write_off_allocations"
    ADD CONSTRAINT "write_off_allocations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."write_offs"
    ADD CONSTRAINT "write_offs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."write_offs"
    ADD CONSTRAINT "write_offs_restaurant_id_id_key" UNIQUE ("restaurant_id", "id");



ALTER TABLE ONLY "storage"."buckets_analytics"
    ADD CONSTRAINT "buckets_analytics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."buckets"
    ADD CONSTRAINT "buckets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."buckets_vectors"
    ADD CONSTRAINT "buckets_vectors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."migrations"
    ADD CONSTRAINT "migrations_name_key" UNIQUE ("name");



ALTER TABLE ONLY "storage"."migrations"
    ADD CONSTRAINT "migrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."objects"
    ADD CONSTRAINT "objects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads_parts"
    ADD CONSTRAINT "s3_multipart_uploads_parts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads"
    ADD CONSTRAINT "s3_multipart_uploads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."vector_indexes"
    ADD CONSTRAINT "vector_indexes_pkey" PRIMARY KEY ("id");



CREATE INDEX "audit_log_restaurant_idx" ON "public"."audit_log" USING "btree" ("restaurant_id", "created_at" DESC);



CREATE INDEX "item_availability_events_item_idx" ON "public"."item_availability_events" USING "btree" ("restaurant_id", "item_id", "sold_out_at");



CREATE UNIQUE INDEX "item_availability_events_open_idx" ON "public"."item_availability_events" USING "btree" ("item_id") WHERE ("back_at" IS NULL);



CREATE INDEX "memberships_restaurant_idx" ON "public"."memberships" USING "btree" ("restaurant_id");



CREATE INDEX "menu_items_section_idx" ON "public"."menu_items" USING "btree" ("restaurant_id", "section_id", "sort_order");



CREATE INDEX "menu_sections_order_idx" ON "public"."menu_sections" USING "btree" ("restaurant_id", "sort_order");



CREATE INDEX "menu_uploads_restaurant_idx" ON "public"."menu_uploads" USING "btree" ("restaurant_id", "created_at" DESC);



CREATE INDEX "modifier_options_group_idx" ON "public"."modifier_options" USING "btree" ("group_id", "sort_order");



CREATE INDEX "order_item_shares_item_idx" ON "public"."order_item_shares" USING "btree" ("order_item_id");



CREATE INDEX "order_items_item_idx" ON "public"."order_items" USING "btree" ("restaurant_id", "item_id");



CREATE INDEX "order_items_order_idx" ON "public"."order_items" USING "btree" ("order_id");



CREATE INDEX "orders_status_idx" ON "public"."orders" USING "btree" ("restaurant_id", "status", "created_at");



CREATE INDEX "orders_tab_idx" ON "public"."orders" USING "btree" ("tab_id");



CREATE INDEX "orders_updated_idx" ON "public"."orders" USING "btree" ("restaurant_id", "updated_at");



CREATE INDEX "payment_allocations_item" ON "public"."payment_allocations" USING "btree" ("order_item_id");



CREATE UNIQUE INDEX "payment_allocations_unit" ON "public"."payment_allocations" USING "btree" ("payment_id", "order_item_id", COALESCE("share_id", '00000000-0000-0000-0000-000000000000'::"uuid"));



CREATE INDEX "payments_paid_idx" ON "public"."payments" USING "btree" ("restaurant_id", "paid_at");



CREATE INDEX "payments_tab_idx" ON "public"."payments" USING "btree" ("tab_id");



CREATE INDEX "payments_updated_idx" ON "public"."payments" USING "btree" ("restaurant_id", "updated_at");



CREATE INDEX "print_jobs_status_idx" ON "public"."print_jobs" USING "btree" ("restaurant_id", "status", "created_at");



CREATE INDEX "refunds_created_idx" ON "public"."refunds" USING "btree" ("restaurant_id", "created_at");



CREATE INDEX "refunds_payment_idx" ON "public"."refunds" USING "btree" ("payment_id");



CREATE INDEX "service_requests_open_idx" ON "public"."service_requests" USING "btree" ("restaurant_id", "status", "created_at");



CREATE INDEX "split_plan_units_item" ON "public"."split_plan_units" USING "btree" ("order_item_id");



CREATE UNIQUE INDEX "split_plan_units_unit" ON "public"."split_plan_units" USING "btree" ("plan_id", "order_item_id", COALESCE("share_id", '00000000-0000-0000-0000-000000000000'::"uuid"));



CREATE UNIQUE INDEX "split_plans_one_active" ON "public"."split_plans" USING "btree" ("tab_id") WHERE ("status" = 'active'::"text");



CREATE UNIQUE INDEX "tab_participants_device_idx" ON "public"."tab_participants" USING "btree" ("tab_id", "device_hash");



CREATE UNIQUE INDEX "tab_participants_name_idx" ON "public"."tab_participants" USING "btree" ("tab_id", "lower"("display_name"));



CREATE UNIQUE INDEX "tab_participants_number_idx" ON "public"."tab_participants" USING "btree" ("tab_id", "guest_number");



CREATE UNIQUE INDEX "tabs_one_live_per_table" ON "public"."tabs" USING "btree" ("table_id") WHERE ("status" <> 'closed'::"public"."tab_status");



CREATE INDEX "tabs_restaurant_idx" ON "public"."tabs" USING "btree" ("restaurant_id", "opened_at" DESC);



CREATE INDEX "write_off_allocations_item" ON "public"."write_off_allocations" USING "btree" ("order_item_id");



CREATE INDEX "write_offs_restaurant_idx" ON "public"."write_offs" USING "btree" ("restaurant_id", "created_at");



CREATE UNIQUE INDEX "bname" ON "storage"."buckets" USING "btree" ("name");



CREATE UNIQUE INDEX "buckets_analytics_unique_name_idx" ON "storage"."buckets_analytics" USING "btree" ("name") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_multipart_uploads_list" ON "storage"."s3_multipart_uploads" USING "btree" ("bucket_id", "key", "created_at");



CREATE INDEX "idx_objects_bucket_id_name" ON "storage"."objects" USING "btree" ("bucket_id", "name" COLLATE "C");



CREATE INDEX "idx_objects_bucket_id_name_lower" ON "storage"."objects" USING "btree" ("bucket_id", "lower"("name") COLLATE "C");



CREATE UNIQUE INDEX "idx_objects_current_version" ON "storage"."objects" USING "btree" ("bucket_id", "name" COLLATE "C") WHERE ("archived_at" IS NULL);



CREATE INDEX "idx_objects_delete_markers" ON "storage"."objects" USING "btree" ("bucket_id", "name" COLLATE "C") WHERE "is_delete_marker";



CREATE UNIQUE INDEX "idx_objects_null_version" ON "storage"."objects" USING "btree" ("bucket_id", "name" COLLATE "C") WHERE (NOT "is_versioned");



CREATE INDEX "name_prefix_search" ON "storage"."objects" USING "btree" ("name" "text_pattern_ops");



CREATE UNIQUE INDEX "objects_bucket_id_name_version_key" ON "storage"."objects" USING "btree" ("bucket_id", "name" COLLATE "C", "version") NULLS NOT DISTINCT;



CREATE UNIQUE INDEX "vector_indexes_name_bucket_id_idx" ON "storage"."vector_indexes" USING "btree" ("name", "bucket_id");



CREATE OR REPLACE VIEW "public"."tab_totals" WITH ("security_invoker"='true') AS
 SELECT "t"."id" AS "tab_id",
    "t"."restaurant_id",
    "t"."table_id",
    "t"."status",
    (COALESCE("sum"(("oi"."qty" * "oi"."unit_price_cents")) FILTER (WHERE (("oi"."voided_at" IS NULL) AND ("o"."status" <> 'void'::"public"."order_status"))), (0)::bigint))::integer AS "subtotal_cents",
    ("count"("oi"."id") FILTER (WHERE (("oi"."voided_at" IS NULL) AND ("o"."status" <> 'void'::"public"."order_status"))))::integer AS "line_count"
   FROM (("public"."tabs" "t"
     LEFT JOIN "public"."orders" "o" ON (("o"."tab_id" = "t"."id")))
     LEFT JOIN "public"."order_items" "oi" ON (("oi"."order_id" = "o"."id")))
  GROUP BY "t"."id";



CREATE OR REPLACE TRIGGER "menu_items_audit_price" AFTER UPDATE OF "price_cents" ON "public"."menu_items" FOR EACH ROW EXECUTE FUNCTION "public"."audit_price_change"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."audit_log" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."cart_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."daily_sales" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."demo_requests" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."devices" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."dining_tables" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."exports" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."guests" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."item_availability_events" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."item_hotspots" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."item_modifier_groups" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."item_sales_daily" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."memberships" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."menu_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."menu_sections" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."menu_themes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."menu_uploads" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."modifier_groups" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."modifier_options" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."order_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."original_menu_pages" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."payment_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."print_jobs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."printers" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."qr_designs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."refunds" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."restaurants" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."service_requests" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."support_access_grants" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."tab_participants" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."tabs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."usage_fees" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."webhook_events" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "enforce_bucket_name_length_trigger" BEFORE INSERT OR UPDATE OF "name" ON "storage"."buckets" FOR EACH ROW EXECUTE FUNCTION "storage"."enforce_bucket_name_length"();



CREATE OR REPLACE TRIGGER "protect_bucket_control_insert" BEFORE INSERT ON "storage"."buckets" FOR EACH ROW EXECUTE FUNCTION "storage"."protect_bucket_control_columns"('service_role');



CREATE OR REPLACE TRIGGER "protect_bucket_control_update" BEFORE UPDATE OF "lifecycle_configuration", "lifecycle_configuration_generation" ON "storage"."buckets" FOR EACH ROW EXECUTE FUNCTION "storage"."protect_bucket_control_columns"();



CREATE OR REPLACE TRIGGER "protect_bucket_control_update_role" AFTER UPDATE OF "lifecycle_configuration", "lifecycle_configuration_generation" ON "storage"."buckets" FOR EACH ROW EXECUTE FUNCTION "storage"."enforce_bucket_lifecycle_service_role"('service_role');



CREATE OR REPLACE TRIGGER "protect_buckets_delete" BEFORE DELETE ON "storage"."buckets" FOR EACH STATEMENT EXECUTE FUNCTION "storage"."protect_delete"();



CREATE OR REPLACE TRIGGER "protect_objects_delete" BEFORE DELETE ON "storage"."objects" FOR EACH STATEMENT EXECUTE FUNCTION "storage"."protect_delete"();



CREATE OR REPLACE TRIGGER "update_objects_updated_at" BEFORE UPDATE ON "storage"."objects" FOR EACH ROW EXECUTE FUNCTION "storage"."update_updated_at_column"();



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_restaurant_id_item_id_fkey" FOREIGN KEY ("restaurant_id", "item_id") REFERENCES "public"."menu_items"("restaurant_id", "id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_restaurant_id_participant_id_fkey" FOREIGN KEY ("restaurant_id", "participant_id") REFERENCES "public"."tab_participants"("restaurant_id", "id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_restaurant_id_tab_id_fkey" FOREIGN KEY ("restaurant_id", "tab_id") REFERENCES "public"."tabs"("restaurant_id", "id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_sales"
    ADD CONSTRAINT "daily_sales_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."devices"
    ADD CONSTRAINT "devices_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dining_tables"
    ADD CONSTRAINT "dining_tables_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exports"
    ADD CONSTRAINT "exports_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."exports"
    ADD CONSTRAINT "exports_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."guests"
    ADD CONSTRAINT "guests_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."item_availability_events"
    ADD CONSTRAINT "item_availability_events_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."item_availability_events"
    ADD CONSTRAINT "item_availability_events_restaurant_id_item_id_fkey" FOREIGN KEY ("restaurant_id", "item_id") REFERENCES "public"."menu_items"("restaurant_id", "id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."item_hotspots"
    ADD CONSTRAINT "item_hotspots_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."item_hotspots"
    ADD CONSTRAINT "item_hotspots_restaurant_id_item_id_fkey" FOREIGN KEY ("restaurant_id", "item_id") REFERENCES "public"."menu_items"("restaurant_id", "id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."item_hotspots"
    ADD CONSTRAINT "item_hotspots_restaurant_id_page_id_fkey" FOREIGN KEY ("restaurant_id", "page_id") REFERENCES "public"."original_menu_pages"("restaurant_id", "id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."item_modifier_groups"
    ADD CONSTRAINT "item_modifier_groups_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."item_modifier_groups"
    ADD CONSTRAINT "item_modifier_groups_restaurant_id_group_id_fkey" FOREIGN KEY ("restaurant_id", "group_id") REFERENCES "public"."modifier_groups"("restaurant_id", "id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."item_modifier_groups"
    ADD CONSTRAINT "item_modifier_groups_restaurant_id_item_id_fkey" FOREIGN KEY ("restaurant_id", "item_id") REFERENCES "public"."menu_items"("restaurant_id", "id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."item_sales_daily"
    ADD CONSTRAINT "item_sales_daily_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."item_sales_daily"
    ADD CONSTRAINT "item_sales_daily_restaurant_id_item_id_fkey" FOREIGN KEY ("restaurant_id", "item_id") REFERENCES "public"."menu_items"("restaurant_id", "id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_restaurant_id_section_id_fkey" FOREIGN KEY ("restaurant_id", "section_id") REFERENCES "public"."menu_sections"("restaurant_id", "id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."menu_sections"
    ADD CONSTRAINT "menu_sections_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."menu_themes"
    ADD CONSTRAINT "menu_themes_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."menu_uploads"
    ADD CONSTRAINT "menu_uploads_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."menu_uploads"
    ADD CONSTRAINT "menu_uploads_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."modifier_groups"
    ADD CONSTRAINT "modifier_groups_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."modifier_options"
    ADD CONSTRAINT "modifier_options_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."modifier_options"
    ADD CONSTRAINT "modifier_options_restaurant_id_group_id_fkey" FOREIGN KEY ("restaurant_id", "group_id") REFERENCES "public"."modifier_groups"("restaurant_id", "id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_item_shares"
    ADD CONSTRAINT "order_item_shares_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_item_shares"
    ADD CONSTRAINT "order_item_shares_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_item_shares"
    ADD CONSTRAINT "order_item_shares_restaurant_id_participant_id_fkey" FOREIGN KEY ("restaurant_id", "participant_id") REFERENCES "public"."tab_participants"("restaurant_id", "id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_restaurant_id_item_id_fkey" FOREIGN KEY ("restaurant_id", "item_id") REFERENCES "public"."menu_items"("restaurant_id", "id") ON DELETE SET NULL ("item_id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_restaurant_id_order_id_fkey" FOREIGN KEY ("restaurant_id", "order_id") REFERENCES "public"."orders"("restaurant_id", "id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_restaurant_id_participant_id_fkey" FOREIGN KEY ("restaurant_id", "participant_id") REFERENCES "public"."tab_participants"("restaurant_id", "id") ON DELETE SET NULL ("participant_id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_voided_by_fkey" FOREIGN KEY ("voided_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_restaurant_id_device_id_fkey" FOREIGN KEY ("restaurant_id", "device_id") REFERENCES "public"."devices"("restaurant_id", "id") ON DELETE SET NULL ("device_id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_restaurant_id_participant_id_fkey" FOREIGN KEY ("restaurant_id", "participant_id") REFERENCES "public"."tab_participants"("restaurant_id", "id") ON DELETE SET NULL ("participant_id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_restaurant_id_tab_id_fkey" FOREIGN KEY ("restaurant_id", "tab_id") REFERENCES "public"."tabs"("restaurant_id", "id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."original_menu_pages"
    ADD CONSTRAINT "original_menu_pages_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_accounts"
    ADD CONSTRAINT "payment_accounts_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_allocations"
    ADD CONSTRAINT "payment_allocations_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payment_allocations"
    ADD CONSTRAINT "payment_allocations_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_allocations"
    ADD CONSTRAINT "payment_allocations_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_allocations"
    ADD CONSTRAINT "payment_allocations_share_id_fkey" FOREIGN KEY ("share_id") REFERENCES "public"."order_item_shares"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_restaurant_id_for_participant_id_fkey" FOREIGN KEY ("restaurant_id", "for_participant_id") REFERENCES "public"."tab_participants"("restaurant_id", "id") ON DELETE SET NULL ("for_participant_id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_restaurant_id_participant_id_fkey" FOREIGN KEY ("restaurant_id", "participant_id") REFERENCES "public"."tab_participants"("restaurant_id", "id") ON DELETE SET NULL ("participant_id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_restaurant_id_plan_id_fkey" FOREIGN KEY ("restaurant_id", "plan_id") REFERENCES "public"."split_plans"("restaurant_id", "id") ON DELETE SET NULL ("plan_id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_restaurant_id_tab_id_fkey" FOREIGN KEY ("restaurant_id", "tab_id") REFERENCES "public"."tabs"("restaurant_id", "id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."platform_admins"
    ADD CONSTRAINT "platform_admins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."print_jobs"
    ADD CONSTRAINT "print_jobs_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."print_jobs"
    ADD CONSTRAINT "print_jobs_restaurant_id_order_id_fkey" FOREIGN KEY ("restaurant_id", "order_id") REFERENCES "public"."orders"("restaurant_id", "id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."print_jobs"
    ADD CONSTRAINT "print_jobs_restaurant_id_printer_id_fkey" FOREIGN KEY ("restaurant_id", "printer_id") REFERENCES "public"."printers"("restaurant_id", "id") ON DELETE SET NULL ("printer_id");



ALTER TABLE ONLY "public"."printers"
    ADD CONSTRAINT "printers_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."qr_designs"
    ADD CONSTRAINT "qr_designs_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."refunds"
    ADD CONSTRAINT "refunds_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."refunds"
    ADD CONSTRAINT "refunds_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."refunds"
    ADD CONSTRAINT "refunds_restaurant_id_payment_id_fkey" FOREIGN KEY ("restaurant_id", "payment_id") REFERENCES "public"."payments"("restaurant_id", "id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_requests"
    ADD CONSTRAINT "service_requests_handled_by_fkey" FOREIGN KEY ("handled_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_requests"
    ADD CONSTRAINT "service_requests_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_requests"
    ADD CONSTRAINT "service_requests_restaurant_id_tab_id_fkey" FOREIGN KEY ("restaurant_id", "tab_id") REFERENCES "public"."tabs"("restaurant_id", "id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."split_plan_units"
    ADD CONSTRAINT "split_plan_units_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."split_plan_units"
    ADD CONSTRAINT "split_plan_units_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."split_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."split_plan_units"
    ADD CONSTRAINT "split_plan_units_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."split_plan_units"
    ADD CONSTRAINT "split_plan_units_share_id_fkey" FOREIGN KEY ("share_id") REFERENCES "public"."order_item_shares"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."split_plans"
    ADD CONSTRAINT "split_plans_created_by_user_fkey" FOREIGN KEY ("created_by_user") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."split_plans"
    ADD CONSTRAINT "split_plans_restaurant_id_created_by_participant_fkey" FOREIGN KEY ("restaurant_id", "created_by_participant") REFERENCES "public"."tab_participants"("restaurant_id", "id") ON DELETE SET NULL ("created_by_participant");



ALTER TABLE ONLY "public"."split_plans"
    ADD CONSTRAINT "split_plans_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."split_plans"
    ADD CONSTRAINT "split_plans_restaurant_id_tab_id_fkey" FOREIGN KEY ("restaurant_id", "tab_id") REFERENCES "public"."tabs"("restaurant_id", "id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."support_access_grants"
    ADD CONSTRAINT "support_access_grants_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."support_access_grants"
    ADD CONSTRAINT "support_access_grants_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."support_access_grants"
    ADD CONSTRAINT "support_access_grants_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tab_participants"
    ADD CONSTRAINT "tab_participants_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tab_participants"
    ADD CONSTRAINT "tab_participants_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tab_participants"
    ADD CONSTRAINT "tab_participants_restaurant_id_guest_id_fkey" FOREIGN KEY ("restaurant_id", "guest_id") REFERENCES "public"."guests"("restaurant_id", "id") ON DELETE SET NULL ("guest_id");



ALTER TABLE ONLY "public"."tab_participants"
    ADD CONSTRAINT "tab_participants_restaurant_id_tab_id_fkey" FOREIGN KEY ("restaurant_id", "tab_id") REFERENCES "public"."tabs"("restaurant_id", "id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tabs"
    ADD CONSTRAINT "tabs_pos_closed_by_fkey" FOREIGN KEY ("pos_closed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tabs"
    ADD CONSTRAINT "tabs_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tabs"
    ADD CONSTRAINT "tabs_restaurant_id_table_id_fkey" FOREIGN KEY ("restaurant_id", "table_id") REFERENCES "public"."dining_tables"("restaurant_id", "id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."usage_fees"
    ADD CONSTRAINT "usage_fees_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."write_off_allocations"
    ADD CONSTRAINT "write_off_allocations_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."write_off_allocations"
    ADD CONSTRAINT "write_off_allocations_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."write_off_allocations"
    ADD CONSTRAINT "write_off_allocations_share_id_fkey" FOREIGN KEY ("share_id") REFERENCES "public"."order_item_shares"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."write_off_allocations"
    ADD CONSTRAINT "write_off_allocations_write_off_id_fkey" FOREIGN KEY ("write_off_id") REFERENCES "public"."write_offs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."write_offs"
    ADD CONSTRAINT "write_offs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."write_offs"
    ADD CONSTRAINT "write_offs_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."write_offs"
    ADD CONSTRAINT "write_offs_restaurant_id_participant_id_fkey" FOREIGN KEY ("restaurant_id", "participant_id") REFERENCES "public"."tab_participants"("restaurant_id", "id") ON DELETE SET NULL ("participant_id");



ALTER TABLE ONLY "public"."write_offs"
    ADD CONSTRAINT "write_offs_restaurant_id_tab_id_fkey" FOREIGN KEY ("restaurant_id", "tab_id") REFERENCES "public"."tabs"("restaurant_id", "id") ON DELETE CASCADE;



ALTER TABLE ONLY "storage"."objects"
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets"("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads"
    ADD CONSTRAINT "s3_multipart_uploads_bucket_id_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets"("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads_parts"
    ADD CONSTRAINT "s3_multipart_uploads_parts_bucket_id_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets"("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads_parts"
    ADD CONSTRAINT "s3_multipart_uploads_parts_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "storage"."s3_multipart_uploads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "storage"."vector_indexes"
    ADD CONSTRAINT "vector_indexes_bucket_id_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets_vectors"("id");



ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_log_owner_all" ON "public"."audit_log" TO "authenticated" USING ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[]));



CREATE POLICY "audit_log_select_manager" ON "public"."audit_log" FOR SELECT TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[]));



ALTER TABLE "public"."cart_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cart_items_delete_manager_server" ON "public"."cart_items" FOR DELETE TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager,server}'::"public"."member_role"[]));



CREATE POLICY "cart_items_insert_manager_server" ON "public"."cart_items" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"("restaurant_id", '{manager,server}'::"public"."member_role"[]));



CREATE POLICY "cart_items_owner_all" ON "public"."cart_items" TO "authenticated" USING ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[]));



CREATE POLICY "cart_items_select_manager_server" ON "public"."cart_items" FOR SELECT TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager,server}'::"public"."member_role"[]));



CREATE POLICY "cart_items_update_manager_server" ON "public"."cart_items" FOR UPDATE TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager,server}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{manager,server}'::"public"."member_role"[]));



ALTER TABLE "public"."daily_sales" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "daily_sales_owner_all" ON "public"."daily_sales" TO "authenticated" USING ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[]));



CREATE POLICY "daily_sales_select_manager" ON "public"."daily_sales" FOR SELECT TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[]));



ALTER TABLE "public"."demo_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."devices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "devices_delete_manager" ON "public"."devices" FOR DELETE TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[]));



CREATE POLICY "devices_insert_manager_server_kitchen" ON "public"."devices" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"("restaurant_id", '{manager,server,kitchen}'::"public"."member_role"[]));



CREATE POLICY "devices_owner_all" ON "public"."devices" TO "authenticated" USING ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[]));



CREATE POLICY "devices_select_manager_server_kitchen" ON "public"."devices" FOR SELECT TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager,server,kitchen}'::"public"."member_role"[]));



CREATE POLICY "devices_update_manager_server_kitchen" ON "public"."devices" FOR UPDATE TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager,server,kitchen}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{manager,server,kitchen}'::"public"."member_role"[]));



ALTER TABLE "public"."dining_tables" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "dining_tables_delete_manager" ON "public"."dining_tables" FOR DELETE TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[]));



CREATE POLICY "dining_tables_insert_manager" ON "public"."dining_tables" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[]));



CREATE POLICY "dining_tables_owner_all" ON "public"."dining_tables" TO "authenticated" USING ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[]));



CREATE POLICY "dining_tables_select_manager_server_kitchen" ON "public"."dining_tables" FOR SELECT TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager,server,kitchen}'::"public"."member_role"[]));



CREATE POLICY "dining_tables_update_manager" ON "public"."dining_tables" FOR UPDATE TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[]));



ALTER TABLE "public"."exports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "exports_insert_manager" ON "public"."exports" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[]));



CREATE POLICY "exports_owner_all" ON "public"."exports" TO "authenticated" USING ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[]));



CREATE POLICY "exports_select_manager" ON "public"."exports" FOR SELECT TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[]));



ALTER TABLE "public"."guests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "guests_insert_manager_server" ON "public"."guests" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"("restaurant_id", '{manager,server}'::"public"."member_role"[]));



CREATE POLICY "guests_owner_all" ON "public"."guests" TO "authenticated" USING ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[]));



CREATE POLICY "guests_select_manager_server" ON "public"."guests" FOR SELECT TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager,server}'::"public"."member_role"[]));



ALTER TABLE "public"."item_availability_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "item_availability_events_delete_manager" ON "public"."item_availability_events" FOR DELETE TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[]));



CREATE POLICY "item_availability_events_insert_manager" ON "public"."item_availability_events" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[]));



CREATE POLICY "item_availability_events_owner_all" ON "public"."item_availability_events" TO "authenticated" USING ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[]));



CREATE POLICY "item_availability_events_select_manager_server_kitchen" ON "public"."item_availability_events" FOR SELECT TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager,server,kitchen}'::"public"."member_role"[]));



CREATE POLICY "item_availability_events_update_manager" ON "public"."item_availability_events" FOR UPDATE TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[]));



ALTER TABLE "public"."item_hotspots" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "item_hotspots_delete_manager" ON "public"."item_hotspots" FOR DELETE TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[]));



CREATE POLICY "item_hotspots_insert_manager" ON "public"."item_hotspots" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[]));



CREATE POLICY "item_hotspots_owner_all" ON "public"."item_hotspots" TO "authenticated" USING ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[]));



CREATE POLICY "item_hotspots_select_manager_server_kitchen" ON "public"."item_hotspots" FOR SELECT TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager,server,kitchen}'::"public"."member_role"[]));



CREATE POLICY "item_hotspots_update_manager" ON "public"."item_hotspots" FOR UPDATE TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[]));



ALTER TABLE "public"."item_modifier_groups" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "item_modifier_groups_delete_manager" ON "public"."item_modifier_groups" FOR DELETE TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[]));



CREATE POLICY "item_modifier_groups_insert_manager" ON "public"."item_modifier_groups" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[]));



CREATE POLICY "item_modifier_groups_owner_all" ON "public"."item_modifier_groups" TO "authenticated" USING ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[]));



CREATE POLICY "item_modifier_groups_select_manager_server_kitchen" ON "public"."item_modifier_groups" FOR SELECT TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager,server,kitchen}'::"public"."member_role"[]));



CREATE POLICY "item_modifier_groups_update_manager" ON "public"."item_modifier_groups" FOR UPDATE TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[]));



ALTER TABLE "public"."item_sales_daily" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "item_sales_daily_owner_all" ON "public"."item_sales_daily" TO "authenticated" USING ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[]));



CREATE POLICY "item_sales_daily_select_manager" ON "public"."item_sales_daily" FOR SELECT TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[]));



ALTER TABLE "public"."memberships" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "memberships_insert_manager" ON "public"."memberships" FOR INSERT TO "authenticated" WITH CHECK (("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[]) AND ("role" <> 'owner'::"public"."member_role")));



CREATE POLICY "memberships_owner_all" ON "public"."memberships" TO "authenticated" USING ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[]));



CREATE POLICY "memberships_select_manager" ON "public"."memberships" FOR SELECT TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[]));



CREATE POLICY "memberships_select_self" ON "public"."memberships" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "memberships_update_manager" ON "public"."memberships" FOR UPDATE TO "authenticated" USING (("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[]) AND ("role" <> 'owner'::"public"."member_role"))) WITH CHECK (("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[]) AND ("role" <> 'owner'::"public"."member_role")));



ALTER TABLE "public"."menu_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "menu_items_delete_manager" ON "public"."menu_items" FOR DELETE TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[]));



CREATE POLICY "menu_items_insert_manager" ON "public"."menu_items" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[]));



CREATE POLICY "menu_items_owner_all" ON "public"."menu_items" TO "authenticated" USING ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[]));



CREATE POLICY "menu_items_select_manager_server_kitchen" ON "public"."menu_items" FOR SELECT TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager,server,kitchen}'::"public"."member_role"[]));



CREATE POLICY "menu_items_update_manager" ON "public"."menu_items" FOR UPDATE TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[]));



ALTER TABLE "public"."menu_sections" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "menu_sections_delete_manager" ON "public"."menu_sections" FOR DELETE TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[]));



CREATE POLICY "menu_sections_insert_manager" ON "public"."menu_sections" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[]));



CREATE POLICY "menu_sections_owner_all" ON "public"."menu_sections" TO "authenticated" USING ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[]));



CREATE POLICY "menu_sections_select_manager_server_kitchen" ON "public"."menu_sections" FOR SELECT TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager,server,kitchen}'::"public"."member_role"[]));



CREATE POLICY "menu_sections_update_manager" ON "public"."menu_sections" FOR UPDATE TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[]));



ALTER TABLE "public"."menu_themes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "menu_themes_delete_manager" ON "public"."menu_themes" FOR DELETE TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[]));



CREATE POLICY "menu_themes_insert_manager" ON "public"."menu_themes" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[]));



CREATE POLICY "menu_themes_owner_all" ON "public"."menu_themes" TO "authenticated" USING ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[]));



CREATE POLICY "menu_themes_select_manager_server_kitchen" ON "public"."menu_themes" FOR SELECT TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager,server,kitchen}'::"public"."member_role"[]));



CREATE POLICY "menu_themes_update_manager" ON "public"."menu_themes" FOR UPDATE TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[]));



ALTER TABLE "public"."menu_uploads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "menu_uploads_delete_manager" ON "public"."menu_uploads" FOR DELETE TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[]));



CREATE POLICY "menu_uploads_insert_manager" ON "public"."menu_uploads" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[]));



CREATE POLICY "menu_uploads_owner_all" ON "public"."menu_uploads" TO "authenticated" USING ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[]));



CREATE POLICY "menu_uploads_select_manager_server_kitchen" ON "public"."menu_uploads" FOR SELECT TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager,server,kitchen}'::"public"."member_role"[]));



CREATE POLICY "menu_uploads_update_manager" ON "public"."menu_uploads" FOR UPDATE TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[]));



ALTER TABLE "public"."modifier_groups" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "modifier_groups_delete_manager" ON "public"."modifier_groups" FOR DELETE TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[]));



CREATE POLICY "modifier_groups_insert_manager" ON "public"."modifier_groups" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[]));



CREATE POLICY "modifier_groups_owner_all" ON "public"."modifier_groups" TO "authenticated" USING ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[]));



CREATE POLICY "modifier_groups_select_manager_server_kitchen" ON "public"."modifier_groups" FOR SELECT TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager,server,kitchen}'::"public"."member_role"[]));



CREATE POLICY "modifier_groups_update_manager" ON "public"."modifier_groups" FOR UPDATE TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[]));



ALTER TABLE "public"."modifier_options" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "modifier_options_delete_manager" ON "public"."modifier_options" FOR DELETE TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[]));



CREATE POLICY "modifier_options_insert_manager" ON "public"."modifier_options" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[]));



CREATE POLICY "modifier_options_owner_all" ON "public"."modifier_options" TO "authenticated" USING ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[]));



CREATE POLICY "modifier_options_select_manager_server_kitchen" ON "public"."modifier_options" FOR SELECT TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager,server,kitchen}'::"public"."member_role"[]));



CREATE POLICY "modifier_options_update_manager" ON "public"."modifier_options" FOR UPDATE TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[]));



ALTER TABLE "public"."order_item_shares" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "order_item_shares_owner_all" ON "public"."order_item_shares" TO "authenticated" USING ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[]));



CREATE POLICY "order_item_shares_select_manager_server" ON "public"."order_item_shares" FOR SELECT TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager,server}'::"public"."member_role"[]));



ALTER TABLE "public"."order_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "order_items_owner_all" ON "public"."order_items" TO "authenticated" USING ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[]));



CREATE POLICY "order_items_select_manager_server_kitchen" ON "public"."order_items" FOR SELECT TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager,server,kitchen}'::"public"."member_role"[]));



ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "orders_owner_all" ON "public"."orders" TO "authenticated" USING ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[]));



CREATE POLICY "orders_select_manager_server_kitchen" ON "public"."orders" FOR SELECT TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager,server,kitchen}'::"public"."member_role"[]));



ALTER TABLE "public"."original_menu_pages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "original_menu_pages_delete_manager" ON "public"."original_menu_pages" FOR DELETE TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[]));



CREATE POLICY "original_menu_pages_insert_manager" ON "public"."original_menu_pages" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[]));



CREATE POLICY "original_menu_pages_owner_all" ON "public"."original_menu_pages" TO "authenticated" USING ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[]));



CREATE POLICY "original_menu_pages_select_manager_server_kitchen" ON "public"."original_menu_pages" FOR SELECT TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager,server,kitchen}'::"public"."member_role"[]));



CREATE POLICY "original_menu_pages_update_manager" ON "public"."original_menu_pages" FOR UPDATE TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[]));



ALTER TABLE "public"."payment_accounts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payment_accounts_owner_all" ON "public"."payment_accounts" TO "authenticated" USING ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[]));



ALTER TABLE "public"."payment_allocations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payment_allocations_owner_all" ON "public"."payment_allocations" TO "authenticated" USING ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[]));



CREATE POLICY "payment_allocations_select_manager_server" ON "public"."payment_allocations" FOR SELECT TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager,server}'::"public"."member_role"[]));



ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payments_insert_manager_server" ON "public"."payments" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"("restaurant_id", '{manager,server}'::"public"."member_role"[]));



CREATE POLICY "payments_owner_all" ON "public"."payments" TO "authenticated" USING ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[]));



CREATE POLICY "payments_select_manager_server" ON "public"."payments" FOR SELECT TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager,server}'::"public"."member_role"[]));



CREATE POLICY "payments_update_manager_server" ON "public"."payments" FOR UPDATE TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager,server}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{manager,server}'::"public"."member_role"[]));



ALTER TABLE "public"."platform_admins" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "platform_admins_select_self" ON "public"."platform_admins" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."print_jobs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "print_jobs_insert_manager_server_kitchen" ON "public"."print_jobs" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"("restaurant_id", '{manager,server,kitchen}'::"public"."member_role"[]));



CREATE POLICY "print_jobs_owner_all" ON "public"."print_jobs" TO "authenticated" USING ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[]));



CREATE POLICY "print_jobs_select_manager_server_kitchen" ON "public"."print_jobs" FOR SELECT TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager,server,kitchen}'::"public"."member_role"[]));



CREATE POLICY "print_jobs_update_manager_server_kitchen" ON "public"."print_jobs" FOR UPDATE TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager,server,kitchen}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{manager,server,kitchen}'::"public"."member_role"[]));



ALTER TABLE "public"."printers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "printers_delete_manager" ON "public"."printers" FOR DELETE TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[]));



CREATE POLICY "printers_insert_manager" ON "public"."printers" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[]));



CREATE POLICY "printers_owner_all" ON "public"."printers" TO "authenticated" USING ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[]));



CREATE POLICY "printers_select_manager_server_kitchen" ON "public"."printers" FOR SELECT TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager,server,kitchen}'::"public"."member_role"[]));



CREATE POLICY "printers_update_manager" ON "public"."printers" FOR UPDATE TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[]));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_insert_self" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "profiles_select_self" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "profiles_select_team" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."memberships" "m"
  WHERE (("m"."user_id" = "profiles"."user_id") AND "public"."has_role"("m"."restaurant_id", '{owner,manager}'::"public"."member_role"[])))));



CREATE POLICY "profiles_update_self" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."qr_designs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "qr_designs_delete_manager" ON "public"."qr_designs" FOR DELETE TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[]));



CREATE POLICY "qr_designs_insert_manager" ON "public"."qr_designs" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[]));



CREATE POLICY "qr_designs_owner_all" ON "public"."qr_designs" TO "authenticated" USING ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[]));



CREATE POLICY "qr_designs_select_manager_server_kitchen" ON "public"."qr_designs" FOR SELECT TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager,server,kitchen}'::"public"."member_role"[]));



CREATE POLICY "qr_designs_update_manager" ON "public"."qr_designs" FOR UPDATE TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[]));



ALTER TABLE "public"."rate_limits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."refunds" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "refunds_owner_all" ON "public"."refunds" TO "authenticated" USING ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[]));



CREATE POLICY "refunds_select_manager" ON "public"."refunds" FOR SELECT TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager}'::"public"."member_role"[]));



ALTER TABLE "public"."restaurants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "restaurants_select_members" ON "public"."restaurants" FOR SELECT TO "authenticated" USING ("public"."has_role"("id", '{owner,manager,server,kitchen}'::"public"."member_role"[]));



CREATE POLICY "restaurants_update_owner" ON "public"."restaurants" FOR UPDATE TO "authenticated" USING ("public"."has_role"("id", '{owner}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("id", '{owner}'::"public"."member_role"[]));



ALTER TABLE "public"."service_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_requests_insert_manager_server" ON "public"."service_requests" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"("restaurant_id", '{manager,server}'::"public"."member_role"[]));



CREATE POLICY "service_requests_owner_all" ON "public"."service_requests" TO "authenticated" USING ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[]));



CREATE POLICY "service_requests_select_manager_server" ON "public"."service_requests" FOR SELECT TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager,server}'::"public"."member_role"[]));



CREATE POLICY "service_requests_update_manager_server" ON "public"."service_requests" FOR UPDATE TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager,server}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{manager,server}'::"public"."member_role"[]));



ALTER TABLE "public"."split_plan_units" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "split_plan_units_owner_all" ON "public"."split_plan_units" TO "authenticated" USING ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[]));



CREATE POLICY "split_plan_units_select_manager_server" ON "public"."split_plan_units" FOR SELECT TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager,server}'::"public"."member_role"[]));



ALTER TABLE "public"."split_plans" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "split_plans_owner_all" ON "public"."split_plans" TO "authenticated" USING ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[]));



CREATE POLICY "split_plans_select_manager_server" ON "public"."split_plans" FOR SELECT TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager,server}'::"public"."member_role"[]));



ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "subscriptions_owner_all" ON "public"."subscriptions" TO "authenticated" USING ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[]));



ALTER TABLE "public"."support_access_grants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "support_access_grants_owner_all" ON "public"."support_access_grants" TO "authenticated" USING ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[]));



ALTER TABLE "public"."tab_participants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tab_participants_insert_manager_server" ON "public"."tab_participants" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"("restaurant_id", '{manager,server}'::"public"."member_role"[]));



CREATE POLICY "tab_participants_owner_all" ON "public"."tab_participants" TO "authenticated" USING ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[]));



CREATE POLICY "tab_participants_select_manager_server" ON "public"."tab_participants" FOR SELECT TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager,server}'::"public"."member_role"[]));



CREATE POLICY "tab_participants_update_manager_server" ON "public"."tab_participants" FOR UPDATE TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager,server}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{manager,server}'::"public"."member_role"[]));



ALTER TABLE "public"."tabs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tabs_insert_manager_server" ON "public"."tabs" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"("restaurant_id", '{manager,server}'::"public"."member_role"[]));



CREATE POLICY "tabs_owner_all" ON "public"."tabs" TO "authenticated" USING ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[]));



CREATE POLICY "tabs_select_manager_server_kitchen" ON "public"."tabs" FOR SELECT TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager,server,kitchen}'::"public"."member_role"[]));



CREATE POLICY "tabs_update_manager_server" ON "public"."tabs" FOR UPDATE TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager,server}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{manager,server}'::"public"."member_role"[]));



ALTER TABLE "public"."usage_fees" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "usage_fees_owner_all" ON "public"."usage_fees" TO "authenticated" USING ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[]));



ALTER TABLE "public"."webhook_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."write_off_allocations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "write_off_allocations_owner_all" ON "public"."write_off_allocations" TO "authenticated" USING ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[]));



CREATE POLICY "write_off_allocations_select_manager_server" ON "public"."write_off_allocations" FOR SELECT TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager,server}'::"public"."member_role"[]));



ALTER TABLE "public"."write_offs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "write_offs_owner_all" ON "public"."write_offs" TO "authenticated" USING ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[])) WITH CHECK ("public"."has_role"("restaurant_id", '{owner}'::"public"."member_role"[]));



CREATE POLICY "write_offs_select_manager_server" ON "public"."write_offs" FOR SELECT TO "authenticated" USING ("public"."has_role"("restaurant_id", '{manager,server}'::"public"."member_role"[]));



ALTER TABLE "storage"."buckets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."buckets_analytics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."buckets_vectors" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mezza_exports_insert" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'exports'::"text") AND "public"."has_role"("public"."storage_restaurant_id"("name"), '{owner,manager}'::"public"."member_role"[])));



CREATE POLICY "mezza_exports_select" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'exports'::"text") AND "public"."has_role"("public"."storage_restaurant_id"("name"), '{owner,manager}'::"public"."member_role"[])));



CREATE POLICY "mezza_media_delete" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = ANY (ARRAY['menus'::"text", 'photos'::"text"])) AND "public"."has_role"("public"."storage_restaurant_id"("name"), '{owner,manager}'::"public"."member_role"[])));



CREATE POLICY "mezza_media_insert" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = ANY (ARRAY['menus'::"text", 'photos'::"text"])) AND "public"."has_role"("public"."storage_restaurant_id"("name"), '{owner,manager}'::"public"."member_role"[])));



CREATE POLICY "mezza_media_select" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = ANY (ARRAY['menus'::"text", 'photos'::"text"])) AND "public"."has_role"("public"."storage_restaurant_id"("name"), '{owner,manager,server,kitchen}'::"public"."member_role"[])));



CREATE POLICY "mezza_media_update" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = ANY (ARRAY['menus'::"text", 'photos'::"text"])) AND "public"."has_role"("public"."storage_restaurant_id"("name"), '{owner,manager}'::"public"."member_role"[]))) WITH CHECK ((("bucket_id" = ANY (ARRAY['menus'::"text", 'photos'::"text"])) AND "public"."has_role"("public"."storage_restaurant_id"("name"), '{owner,manager}'::"public"."member_role"[])));



ALTER TABLE "storage"."migrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."objects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."s3_multipart_uploads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."s3_multipart_uploads_parts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."vector_indexes" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT USAGE ON SCHEMA "storage" TO "postgres" WITH GRANT OPTION;
GRANT USAGE ON SCHEMA "storage" TO "anon";
GRANT USAGE ON SCHEMA "storage" TO "authenticated";
GRANT USAGE ON SCHEMA "storage" TO "service_role";
GRANT ALL ON SCHEMA "storage" TO "supabase_storage_admin" WITH GRANT OPTION;
GRANT ALL ON SCHEMA "storage" TO "dashboard_user";



REVOKE ALL ON FUNCTION "public"."active_split_plan"("p_tab_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."active_split_plan"("p_tab_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."attribute_staff_order"("p_order_id" "uuid", "p_participant_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."attribute_staff_order"("p_order_id" "uuid", "p_participant_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."attribute_staff_order"("p_order_id" "uuid", "p_participant_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."audit_price_change"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."audit_price_change"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."cancel_pending_payment"("p_payment_id" "uuid", "p_device_hash" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cancel_pending_payment"("p_payment_id" "uuid", "p_device_hash" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."cancel_split_plan"("p_tab_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cancel_split_plan"("p_tab_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."close_idle_tabs"("p_restaurant_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."close_idle_tabs"("p_restaurant_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."close_idle_tabs"("p_restaurant_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."close_tab"("p_tab_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."close_tab"("p_tab_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."close_tab"("p_tab_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."create_restaurant_with_owner"("p_owner_id" "uuid", "p_name" "text", "p_slug" "text", "p_phone" "text", "p_language" "public"."app_locale") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_restaurant_with_owner"("p_owner_id" "uuid", "p_name" "text", "p_slug" "text", "p_phone" "text", "p_language" "public"."app_locale") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_tab_payment"("p_tab_id" "uuid", "p_option" "text", "p_method" "public"."payment_method", "p_idempotency_key" "text", "p_payer" "uuid", "p_for" "uuid", "p_parts" integer, "p_tip_percent" integer, "p_tip_cents" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_tab_payment"("p_tab_id" "uuid", "p_option" "text", "p_method" "public"."payment_method", "p_idempotency_key" "text", "p_payer" "uuid", "p_for" "uuid", "p_parts" integer, "p_tip_percent" integer, "p_tip_cents" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."ensure_participant"("p_tab_id" "uuid", "p_device_hash" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ensure_participant"("p_tab_id" "uuid", "p_device_hash" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."has_role"("p_restaurant_id" "uuid", "p_roles" "public"."member_role"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."has_role"("p_restaurant_id" "uuid", "p_roles" "public"."member_role"[]) TO "service_role";
GRANT ALL ON FUNCTION "public"."has_role"("p_restaurant_id" "uuid", "p_roles" "public"."member_role"[]) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."is_platform_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_platform_admin"() TO "service_role";
GRANT ALL ON FUNCTION "public"."is_platform_admin"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."ivu_cents"("p_cents" bigint, "p_bps" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ivu_cents"("p_cents" bigint, "p_bps" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."ivu_cents"("p_cents" bigint, "p_bps" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."move_order_item"("p_order_item_id" "uuid", "p_participant_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."move_order_item"("p_order_item_id" "uuid", "p_participant_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."move_order_item"("p_order_item_id" "uuid", "p_participant_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."period_adjustments"("p_restaurant_id" "uuid", "p_from" "date", "p_to" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."period_adjustments"("p_restaurant_id" "uuid", "p_from" "date", "p_to" "date") TO "service_role";
GRANT ALL ON FUNCTION "public"."period_adjustments"("p_restaurant_id" "uuid", "p_from" "date", "p_to" "date") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."place_guest_order"("p_restaurant_id" "uuid", "p_table_id" "uuid", "p_client_order_id" "text", "p_lines" "jsonb", "p_guest_language" "public"."app_locale", "p_device_hash" "text", "p_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."place_guest_order"("p_restaurant_id" "uuid", "p_table_id" "uuid", "p_client_order_id" "text", "p_lines" "jsonb", "p_guest_language" "public"."app_locale", "p_device_hash" "text", "p_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."place_order"("p_restaurant_id" "uuid", "p_table_id" "uuid", "p_client_order_id" "text", "p_source" "public"."order_source", "p_lines" "jsonb", "p_guest_language" "public"."app_locale", "p_created_by" "uuid", "p_device_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."place_order"("p_restaurant_id" "uuid", "p_table_id" "uuid", "p_client_order_id" "text", "p_source" "public"."order_source", "p_lines" "jsonb", "p_guest_language" "public"."app_locale", "p_created_by" "uuid", "p_device_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."publish_menu_import"("p_upload_id" "uuid", "p_payload" "jsonb", "p_reviewed_by" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."publish_menu_import"("p_upload_id" "uuid", "p_payload" "jsonb", "p_reviewed_by" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."publish_original_menu_image"("p_upload_id" "uuid", "p_width" integer, "p_height" integer, "p_reviewed_by" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."publish_original_menu_image"("p_upload_id" "uuid", "p_width" integer, "p_height" integer, "p_reviewed_by" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."raise_tab_limit"("p_tab_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."raise_tab_limit"("p_tab_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."raise_tab_limit"("p_tab_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."rate_limit_hit"("p_key" "text", "p_max" integer, "p_window_seconds" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rate_limit_hit"("p_key" "text", "p_max" integer, "p_window_seconds" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_refund"("p_payment_id" "uuid", "p_amount_cents" integer, "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_refund"("p_payment_id" "uuid", "p_amount_cents" integer, "p_reason" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."record_refund"("p_payment_id" "uuid", "p_amount_cents" integer, "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."refresh_sales_summaries"("p_restaurant_id" "uuid", "p_from" "date", "p_to" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."refresh_sales_summaries"("p_restaurant_id" "uuid", "p_from" "date", "p_to" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rename_participant"("p_tab_id" "uuid", "p_device_hash" "text", "p_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rename_participant"("p_tab_id" "uuid", "p_device_hash" "text", "p_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."report_summary"("p_restaurant_id" "uuid", "p_from" "date", "p_to" "date") TO "service_role";
GRANT ALL ON FUNCTION "public"."report_summary"("p_restaurant_id" "uuid", "p_from" "date", "p_to" "date") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."set_item_availability"("p_item_id" "uuid", "p_available" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_item_availability"("p_item_id" "uuid", "p_available" boolean) TO "service_role";
GRANT ALL ON FUNCTION "public"."set_item_availability"("p_item_id" "uuid", "p_available" boolean) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."set_item_shares"("p_order_item_id" "uuid", "p_participants" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_item_shares"("p_order_item_id" "uuid", "p_participants" "uuid"[]) TO "service_role";
GRANT ALL ON FUNCTION "public"."set_item_shares"("p_order_item_id" "uuid", "p_participants" "uuid"[]) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."set_order_status"("p_order_id" "uuid", "p_status" "public"."order_status") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_order_status"("p_order_id" "uuid", "p_status" "public"."order_status") TO "service_role";
GRANT ALL ON FUNCTION "public"."set_order_status"("p_order_id" "uuid", "p_status" "public"."order_status") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."set_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."split_item_shares"("p_order_item_id" "uuid", "p_participants" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."split_item_shares"("p_order_item_id" "uuid", "p_participants" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."split_plan_left"("p_plan_id" "uuid", OUT "amount_left" bigint, OUT "parts_left" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."split_plan_left"("p_plan_id" "uuid", OUT "amount_left" bigint, OUT "parts_left" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."split_plan_left"("p_plan_id" "uuid", OUT "amount_left" bigint, OUT "parts_left" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."start_split_plan"("p_tab_id" "uuid", "p_parts" integer, "p_by_participant" "uuid", "p_by_user" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."start_split_plan"("p_tab_id" "uuid", "p_parts" integer, "p_by_participant" "uuid", "p_by_user" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."storage_restaurant_id"("p_name" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."storage_restaurant_id"("p_name" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."tab_charges"("p_tab_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."tab_charges"("p_tab_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."tab_charges"("p_tab_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."tab_checkout"("p_tab_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."tab_checkout"("p_tab_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."tab_checkout"("p_tab_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."tab_settled"("p_tab_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."tab_settled"("p_tab_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."tab_settled"("p_tab_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."void_line"("p_order_id" "uuid", "p_reason" "text", "p_order_item_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."void_line"("p_order_id" "uuid", "p_reason" "text", "p_order_item_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."void_line"("p_order_id" "uuid", "p_reason" "text", "p_order_item_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."void_order"("p_order_id" "uuid", "p_reason" "text", "p_order_item_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."void_order"("p_order_id" "uuid", "p_reason" "text", "p_order_item_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."void_order"("p_order_id" "uuid", "p_reason" "text", "p_order_item_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."write_off"("p_tab_id" "uuid", "p_scope" "text", "p_reason" "text", "p_participant_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."write_off"("p_tab_id" "uuid", "p_scope" "text", "p_reason" "text", "p_participant_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."write_off"("p_tab_id" "uuid", "p_scope" "text", "p_reason" "text", "p_participant_id" "uuid") TO "authenticated";



GRANT ALL ON TABLE "public"."audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."cart_items" TO "authenticated";
GRANT ALL ON TABLE "public"."cart_items" TO "service_role";



GRANT ALL ON TABLE "public"."daily_sales" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_sales" TO "service_role";



GRANT ALL ON TABLE "public"."demo_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."demo_requests" TO "service_role";



GRANT ALL ON TABLE "public"."devices" TO "authenticated";
GRANT ALL ON TABLE "public"."devices" TO "service_role";



GRANT ALL ON TABLE "public"."dining_tables" TO "authenticated";
GRANT ALL ON TABLE "public"."dining_tables" TO "service_role";



GRANT ALL ON TABLE "public"."exports" TO "authenticated";
GRANT ALL ON TABLE "public"."exports" TO "service_role";



GRANT ALL ON TABLE "public"."guests" TO "authenticated";
GRANT ALL ON TABLE "public"."guests" TO "service_role";



GRANT ALL ON TABLE "public"."item_availability_events" TO "authenticated";
GRANT ALL ON TABLE "public"."item_availability_events" TO "service_role";



GRANT ALL ON TABLE "public"."item_hotspots" TO "authenticated";
GRANT ALL ON TABLE "public"."item_hotspots" TO "service_role";



GRANT ALL ON TABLE "public"."item_modifier_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."item_modifier_groups" TO "service_role";



GRANT ALL ON TABLE "public"."item_sales_daily" TO "authenticated";
GRANT ALL ON TABLE "public"."item_sales_daily" TO "service_role";



GRANT ALL ON TABLE "public"."ivu_monthly" TO "authenticated";
GRANT ALL ON TABLE "public"."ivu_monthly" TO "service_role";



GRANT ALL ON TABLE "public"."memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."memberships" TO "service_role";



GRANT ALL ON TABLE "public"."menu_items" TO "authenticated";
GRANT ALL ON TABLE "public"."menu_items" TO "service_role";



GRANT ALL ON TABLE "public"."menu_sections" TO "authenticated";
GRANT ALL ON TABLE "public"."menu_sections" TO "service_role";



GRANT ALL ON TABLE "public"."menu_themes" TO "authenticated";
GRANT ALL ON TABLE "public"."menu_themes" TO "service_role";



GRANT ALL ON TABLE "public"."menu_uploads" TO "authenticated";
GRANT ALL ON TABLE "public"."menu_uploads" TO "service_role";



GRANT ALL ON TABLE "public"."modifier_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."modifier_groups" TO "service_role";



GRANT ALL ON TABLE "public"."modifier_options" TO "authenticated";
GRANT ALL ON TABLE "public"."modifier_options" TO "service_role";



GRANT ALL ON TABLE "public"."order_item_shares" TO "authenticated";
GRANT ALL ON TABLE "public"."order_item_shares" TO "service_role";



GRANT ALL ON TABLE "public"."order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."order_items" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."original_menu_pages" TO "authenticated";
GRANT ALL ON TABLE "public"."original_menu_pages" TO "service_role";



GRANT ALL ON TABLE "public"."payment_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."payment_allocations" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_allocations" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."platform_admins" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_admins" TO "service_role";



GRANT ALL ON TABLE "public"."print_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."print_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."printers" TO "authenticated";
GRANT ALL ON TABLE "public"."printers" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."qr_designs" TO "authenticated";
GRANT ALL ON TABLE "public"."qr_designs" TO "service_role";



GRANT ALL ON TABLE "public"."rate_limits" TO "service_role";



GRANT ALL ON TABLE "public"."refunds" TO "authenticated";
GRANT ALL ON TABLE "public"."refunds" TO "service_role";



GRANT ALL ON TABLE "public"."restaurants" TO "authenticated";
GRANT ALL ON TABLE "public"."restaurants" TO "service_role";



GRANT ALL ON TABLE "public"."service_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."service_requests" TO "service_role";



GRANT ALL ON TABLE "public"."split_plan_units" TO "authenticated";
GRANT ALL ON TABLE "public"."split_plan_units" TO "service_role";



GRANT ALL ON TABLE "public"."split_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."split_plans" TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."support_access_grants" TO "authenticated";
GRANT ALL ON TABLE "public"."support_access_grants" TO "service_role";



GRANT ALL ON TABLE "public"."tab_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."tab_participants" TO "service_role";



GRANT ALL ON TABLE "public"."tab_totals" TO "authenticated";
GRANT ALL ON TABLE "public"."tab_totals" TO "service_role";



GRANT ALL ON TABLE "public"."tabs" TO "authenticated";
GRANT ALL ON TABLE "public"."tabs" TO "service_role";



GRANT ALL ON TABLE "public"."usage_fees" TO "authenticated";
GRANT ALL ON TABLE "public"."usage_fees" TO "service_role";



GRANT ALL ON TABLE "public"."webhook_events" TO "authenticated";
GRANT ALL ON TABLE "public"."webhook_events" TO "service_role";



GRANT ALL ON TABLE "public"."write_off_allocations" TO "authenticated";
GRANT ALL ON TABLE "public"."write_off_allocations" TO "service_role";



GRANT ALL ON TABLE "public"."write_offs" TO "authenticated";
GRANT ALL ON TABLE "public"."write_offs" TO "service_role";



REVOKE ALL ON TABLE "storage"."buckets" FROM "supabase_storage_admin";
GRANT ALL ON TABLE "storage"."buckets" TO "supabase_storage_admin" WITH GRANT OPTION;
GRANT ALL ON TABLE "storage"."buckets" TO "service_role";
GRANT ALL ON TABLE "storage"."buckets" TO "authenticated";
GRANT ALL ON TABLE "storage"."buckets" TO "anon";
GRANT ALL ON TABLE "storage"."buckets" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON TABLE "storage"."buckets_analytics" TO "service_role";
GRANT ALL ON TABLE "storage"."buckets_analytics" TO "authenticated";
GRANT ALL ON TABLE "storage"."buckets_analytics" TO "anon";



GRANT SELECT ON TABLE "storage"."buckets_vectors" TO "service_role";
GRANT SELECT ON TABLE "storage"."buckets_vectors" TO "authenticated";
GRANT SELECT ON TABLE "storage"."buckets_vectors" TO "anon";



REVOKE ALL ON TABLE "storage"."objects" FROM "supabase_storage_admin";
GRANT ALL ON TABLE "storage"."objects" TO "supabase_storage_admin" WITH GRANT OPTION;
GRANT ALL ON TABLE "storage"."objects" TO "service_role";
GRANT ALL ON TABLE "storage"."objects" TO "authenticated";
GRANT ALL ON TABLE "storage"."objects" TO "anon";
GRANT ALL ON TABLE "storage"."objects" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON TABLE "storage"."s3_multipart_uploads" TO "service_role";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads" TO "authenticated";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads" TO "anon";



GRANT ALL ON TABLE "storage"."s3_multipart_uploads_parts" TO "service_role";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads_parts" TO "authenticated";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads_parts" TO "anon";



GRANT SELECT ON TABLE "storage"."vector_indexes" TO "service_role";
GRANT SELECT ON TABLE "storage"."vector_indexes" TO "authenticated";
GRANT SELECT ON TABLE "storage"."vector_indexes" TO "anon";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES TO "service_role";




