-- P2-2 (issue #14): a function or table added by a future migration is not open to everyone by
-- default. Supabase grants EXECUTE on new public functions to anon/authenticated and every privilege
-- on new tables to anon; each migration had to remember to revoke (report_summary was missed).
-- Migrations now grant what they mean to.
begin;
select no_plan();

create function public.zz_probe() returns integer language sql as $$ select 1 $$;
create table public.zz_probe_t (id integer primary key);

select ok(not has_function_privilege('anon', 'public.zz_probe()', 'execute'), 'anon cannot run a new function');
select ok(not has_function_privilege('authenticated', 'public.zz_probe()', 'execute'), 'nor can a signed-in user until granted');
select ok(not has_table_privilege('anon', 'public.zz_probe_t', 'select'), 'anon cannot read a new table');
select ok(not has_table_privilege('anon', 'public.zz_probe_t', 'insert'), 'nor write it');
select ok(not has_function_privilege('anon', 'public.report_summary(uuid, date, date)', 'execute'), 'anon cannot run report_summary');
select ok(not has_function_privilege('anon', 'public.storage_restaurant_id(text)', 'execute'), 'nor storage_restaurant_id');
select ok(has_function_privilege('authenticated', 'public.report_summary(uuid, date, date)', 'execute'), 'signed-in users still can (it checks the role)');
select ok(has_function_privilege('authenticated', 'public.storage_restaurant_id(text)', 'execute'), 'storage policies still work for signed-in users');

select * from finish();
rollback;
