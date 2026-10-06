-- Reportes: every MVP metric for a date range in one call. Runs as the caller (security invoker), so
-- row-level security applies on top of the explicit owner/manager check. Dates are the restaurant's
-- local dates; summaries come from daily_sales / item_sales_daily, the rest from the source tables.

create function public.report_summary(p_restaurant_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
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

grant execute on function public.report_summary(uuid, date, date) to authenticated;

-- item_sales_daily.modifier_count now counts extras only (see the comment inside). Replaces the
-- phase 2 definition; everything else is unchanged.
create or replace function public.refresh_sales_summaries(p_restaurant_id uuid, p_from date, p_to date)
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
