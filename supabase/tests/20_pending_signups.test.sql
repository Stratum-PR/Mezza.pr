-- P2-5 (issue #17): the restaurant is created after the email is confirmed. Until then the details
-- typed at signup wait in pending_signups, which only the service role can read or write (it holds
-- a phone number, and nobody should change the details before confirming).
begin;
select no_plan();

select has_table('public', 'pending_signups', 'pending signups have a table');
select col_is_pk('public', 'pending_signups', 'user_id', 'one pending signup per account');
select fk_ok('public', 'pending_signups', 'user_id', 'auth', 'users', 'id', 'it belongs to an account');
select ok((select relrowsecurity from pg_class where oid = 'public.pending_signups'::regclass), 'RLS is on');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'pending_signups'), 0, 'with no policies');

select ok(not has_table_privilege('anon', 'public.pending_signups', 'select'), 'anon cannot read pending signups');
select ok(not has_table_privilege('anon', 'public.pending_signups', 'insert'), 'nor write them');
select ok(not has_table_privilege('authenticated', 'public.pending_signups', 'select'), 'a signed-in user cannot read them');
select ok(not has_table_privilege('authenticated', 'public.pending_signups', 'insert'), 'nor add one');
select ok(not has_table_privilege('authenticated', 'public.pending_signups', 'update'), 'nor change one');
select ok(has_table_privilege('service_role', 'public.pending_signups', 'insert'), 'the service role writes them');
select ok(has_table_privilege('service_role', 'public.pending_signups', 'delete'), 'and claims them');

insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000b1', 'nueva@fonda.test');
set local role service_role;
insert into public.pending_signups (user_id, full_name, restaurant_name, phone, language)
values ('00000000-0000-4000-8000-0000000000b1', 'Nora Nueva', 'Fonda Nueva', '787-555-0100', 'en');
reset role;
delete from auth.users where id = '00000000-0000-4000-8000-0000000000b1';
select is((select count(*)::int from public.pending_signups), 0, 'deleting the account deletes its pending signup');

select * from finish();
rollback;
