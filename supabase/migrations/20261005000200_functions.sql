-- Database functions. All are security definer with an empty search_path (every name is
-- schema-qualified). The ones that take an actor or bypass row-level security are executable by
-- service_role only and are called from server code after it has checked the caller.

-- ---------------------------------------------------------------------------
-- Role helpers (used by every policy)
-- ---------------------------------------------------------------------------
create function public.has_role(p_restaurant_id uuid, p_roles public.member_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.restaurant_id = p_restaurant_id
      and m.user_id = (select auth.uid())
      and m.active
      and m.role = any (p_roles)
  );
$$;

create function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid()));
$$;

-- ---------------------------------------------------------------------------
-- Signup: restaurant, owner membership, default QR design, trial subscription
-- ---------------------------------------------------------------------------
create function public.create_restaurant_with_owner(
  p_owner_id uuid,
  p_name text,
  p_slug text,
  p_phone text default null,
  p_language public.app_locale default 'es'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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

-- ---------------------------------------------------------------------------
-- place_order: re-reads prices, modifiers and availability; never trusts client prices.
-- Returns { status: 'accepted', order_id, number, replayed } or { status: 'rejected', reason, detail }.
-- p_lines: [{ itemId, qty, modifierOptionIds: [], note?, shared? }]
-- ---------------------------------------------------------------------------
create function public.place_order(
  p_restaurant_id uuid,
  p_table_id uuid,
  p_client_order_id text,
  p_source public.order_source,
  p_lines jsonb,
  p_guest_language public.app_locale default 'es',
  p_created_by uuid default null,
  p_device_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
  perform 1 from public.restaurants r where r.id = p_restaurant_id for update;
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
  if v_tab_id is null then
    insert into public.tabs (restaurant_id, table_id) values (p_restaurant_id, p_table_id) returning id into v_tab_id;
  end if;

  update public.restaurants r
  set next_order_number = r.next_order_number + 1
  where r.id = p_restaurant_id
  returning r.next_order_number - 1 into v_number;

  insert into public.orders (restaurant_id, tab_id, number, source, idempotency_key, guest_language, created_by, device_id)
  values (p_restaurant_id, v_tab_id, v_number, p_source, p_client_order_id, p_guest_language, p_created_by, p_device_id)
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

-- ---------------------------------------------------------------------------
-- publish_menu_import: writes sections, items, modifiers, theme, pages and hotspots in one
-- transaction. Dishes and sections are matched by Spanish name; ones missing from the import are
-- archived (not deleted) so past orders and reports keep them.
-- p_payload: the reviewed MenuImportResult with every price confirmed (priceCents never null).
-- ---------------------------------------------------------------------------
create function public.publish_menu_import(p_upload_id uuid, p_payload jsonb, p_reviewed_by uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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

-- ---------------------------------------------------------------------------
-- refresh_sales_summaries: rebuilds daily_sales and item_sales_daily for a date range,
-- in the restaurant's timezone. daily_sales are gross; refunds are reported from refunds.
-- ---------------------------------------------------------------------------
create function public.refresh_sales_summaries(p_restaurant_id uuid, p_from date, p_to date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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
    coalesce(sum(oi.qty) filter (where jsonb_array_length(oi.modifiers_snapshot) > 0), 0)
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

-- ---------------------------------------------------------------------------
-- Staff actions callable by signed-in users; each checks the caller's role itself.
-- ---------------------------------------------------------------------------

-- Sold-out toggle (kitchen, manager, owner). Writes item_availability_events.
create function public.set_item_availability(p_item_id uuid, p_available boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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

-- Order progress (any staff role): new → in_kitchen → ready → served. Voids use void_order.
create function public.set_order_status(p_order_id uuid, p_status public.order_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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

-- Void an order or one of its lines (manager, owner). Reason required; audited.
create function public.void_order(p_order_id uuid, p_reason text, p_order_item_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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

-- Record a refund against a paid payment (manager, owner). Never exceeds what remains; audited.
create function public.record_refund(p_payment_id uuid, p_amount_cents integer, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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

-- ---------------------------------------------------------------------------
-- Price changes are always audited, whoever makes them. The actor is the signed-in user, or the
-- id server code put in mezza.actor_id when it acts as service_role.
-- ---------------------------------------------------------------------------
create function public.audit_price_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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

create trigger menu_items_audit_price
after update of price_cents on public.menu_items
for each row execute function public.audit_price_change();

-- ---------------------------------------------------------------------------
-- Execute grants
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.has_role(uuid, public.member_role[]) to authenticated, service_role;
grant execute on function public.is_platform_admin() to authenticated, service_role;
grant execute on function public.set_item_availability(uuid, boolean) to authenticated, service_role;
grant execute on function public.set_order_status(uuid, public.order_status) to authenticated, service_role;
grant execute on function public.void_order(uuid, text, uuid) to authenticated, service_role;
grant execute on function public.record_refund(uuid, integer, text) to authenticated, service_role;

-- Server code only (it checks the caller first).
grant execute on function public.create_restaurant_with_owner(uuid, text, text, text, public.app_locale) to service_role;
grant execute on function public.place_order(uuid, uuid, text, public.order_source, jsonb, public.app_locale, uuid, uuid) to service_role;
grant execute on function public.publish_menu_import(uuid, jsonb, uuid) to service_role;
grant execute on function public.refresh_sales_summaries(uuid, date, date) to service_role;

-- Functions created later are not executable by anon/authenticated unless granted explicitly.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
