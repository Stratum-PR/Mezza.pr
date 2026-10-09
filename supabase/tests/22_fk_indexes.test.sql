-- P5-1: every foreign key in public has a covering index. Without one, deleting or re-keying a
-- referenced row (a tab, a participant, an order, a user) scans the whole referencing table, and
-- joins along the key can't use an index. The rule matches Supabase's performance advisor
-- (lint 0001_unindexed_foreign_keys): the FK's columns, in order, are the leading columns of a
-- valid index. Partial indexes don't count. The query is generic, so a future FK without an index
-- fails here.
begin;
select no_plan();

create temporary view unindexed_fks as
select c.conrelid::regclass::text || '(' ||
       (select string_agg(a.attname, ', ' order by k.ord)
          from unnest(c.conkey) with ordinality k(attnum, ord)
          join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) || ') ' ||
       c.conname as fk
from pg_constraint c
where c.contype = 'f'
  and c.connamespace = 'public'::regnamespace
  and not exists (
    select 1
    from pg_index i
    where i.indrelid = c.conrelid
      and i.indisvalid
      and i.indpred is null
      and (string_to_array(i.indkey::text, ' ')::int2[])[1:cardinality(c.conkey)] = c.conkey
  );

-- The check itself catches a missing index, including a composite tenant FK.
create table public.zz_fk_probe (
  id integer primary key,
  restaurant_id uuid not null,
  tab_id uuid not null,
  foreign key (restaurant_id, tab_id) references public.tabs (restaurant_id, id)
);
select ok(exists (select 1 from unindexed_fks where fk like 'zz_fk_probe(restaurant_id, tab_id) %'), 'a composite FK without an index is reported');
create index on public.zz_fk_probe (tab_id, restaurant_id);
select ok(exists (select 1 from unindexed_fks where fk like 'zz_fk_probe(%'), 'an index with the FK columns in another order does not count');
create index on public.zz_fk_probe (restaurant_id, tab_id) where tab_id is not null;
select ok(exists (select 1 from unindexed_fks where fk like 'zz_fk_probe(%'), 'nor does a partial index');
create index on public.zz_fk_probe (restaurant_id, tab_id, id);
select ok(not exists (select 1 from unindexed_fks where fk like 'zz_fk_probe(%'), 'an index led by the FK columns covers it');
drop table public.zz_fk_probe;

-- The ones the audit called out first.
select ok(not exists (select 1 from unindexed_fks where fk like 'service_requests(restaurant_id, tab_id) %'), 'service_requests(tab_id) is indexed');
select ok(not exists (select 1 from unindexed_fks where fk like 'cart_items(restaurant_id, tab_id) %'), 'cart_items(tab_id) is indexed');
select ok(not exists (select 1 from unindexed_fks where fk like 'print_jobs(restaurant_id, order_id) %'), 'print_jobs(order_id) is indexed');
select ok(not exists (select 1 from unindexed_fks where fk like 'payments(restaurant_id, participant_id) %'), 'payments(participant_id) is indexed');
select ok(not exists (select 1 from unindexed_fks where fk like 'order_items(restaurant_id, participant_id) %'), 'order_items(participant_id) is indexed');

-- And all of them.
select is_empty('select fk from unindexed_fks order by fk', 'every foreign key in public has a covering index');

select * from finish();
rollback;
