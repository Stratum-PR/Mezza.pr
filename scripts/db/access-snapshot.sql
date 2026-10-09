-- What anon and authenticated may do: RLS per table, table and column privileges, every policy
-- (public and storage), and EXECUTE on every public function. One line each, sorted. Used by
-- scripts/db/access-snapshot.ts (writes the approved list) and supabase/tests/16_access_snapshot.test.sql.
select line from (
  select format('rls %s %s', c.relname, case when c.relrowsecurity then 'on' else 'off' end) as line
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
  union all
  select format('table %s %s %s', c.relname, r.role, p.priv)
  from pg_class c join pg_namespace n on n.oid = c.relnamespace,
    (values ('anon'), ('authenticated')) r(role),
    (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) p(priv)
  where n.nspname = 'public' and c.relkind in ('r', 'v', 'm') and has_table_privilege(r.role, c.oid, p.priv)
  union all
  select format('column %s.%s %s %s', c.relname, a.attname, r.role, p.priv)
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped,
    (values ('anon'), ('authenticated')) r(role),
    (values ('SELECT'), ('INSERT'), ('UPDATE')) p(priv)
  where n.nspname = 'public' and c.relkind in ('r', 'v', 'm')
    and has_column_privilege(r.role, c.oid, a.attnum, p.priv) and not has_table_privilege(r.role, c.oid, p.priv)
  union all
  select format('policy %s.%s %s %s %s %s using(%s) check(%s)', schemaname, tablename, policyname, permissive, cmd, roles::text,
    regexp_replace(coalesce(qual, ''), '\s+', ' ', 'g'), regexp_replace(coalesce(with_check, ''), '\s+', ' ', 'g'))
  from pg_policies where schemaname in ('public', 'storage')
  union all
  select format('function %s %s%s', p.oid::regprocedure, r.role, case when p.prosecdef then ' definer' else '' end)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace, (values ('anon'), ('authenticated')) r(role)
  where n.nspname = 'public' and has_function_privilege(r.role, p.oid, 'EXECUTE')
) x
order by line;
