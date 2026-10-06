begin;
select plan(4);

select is(
  (select array_agg(c.relname::text order by c.relname)
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  null::text[],
  'every table in public has row-level security enabled'
);

select is(
  (select array_agg(t.table_name::text order by t.table_name)
   from information_schema.tables t
   where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
     and not exists (
       select 1 from information_schema.columns c
       where c.table_schema = 'public' and c.table_name = t.table_name and c.column_name = 'restaurant_id'
     )),
  array['demo_requests', 'platform_admins', 'profiles', 'rate_limits', 'restaurants', 'webhook_events'],
  'only the six non-tenant tables lack restaurant_id (rate_limits is shared by every app instance)'
);

select is(
  (select array_agg(c.table_name::text order by c.table_name)
   from information_schema.columns c
   join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
   where c.table_schema = 'public' and t.table_type = 'BASE TABLE'
     and c.column_name = 'restaurant_id' and c.is_nullable = 'YES'),
  null::text[],
  'every tenant table has restaurant_id not null'
);

select is(
  (select array_agg(c.relname::text order by c.relname)
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'v'
     and not coalesce(c.reloptions @> array['security_invoker=true'], false)),
  null::text[],
  'every view runs with security_invoker'
);

select * from finish();
rollback;
