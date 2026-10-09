-- P2-3 (issue #15): adding an existing account to a team finds it by exact email, not by listing the
-- first 1000 users (an account past the first page was "not found"). Only the service role may look
-- accounts up: anyone else could probe which emails have a Mezza account.
begin;
select no_plan();

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'ana@cafe-lucia.test'),
  ('00000000-0000-4000-8000-0000000000a2', 'ana.maria@cafe-lucia.test');
-- More accounts than one page of the old listUsers lookup.
insert into auth.users (id, email)
  select gen_random_uuid(), 'filler' || g || '@example.test' from generate_series(1, 1001) g;
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a3', 'late@cafe-lucia.test');

select has_function('public', 'auth_user_id_by_email', array['text'], 'the lookup exists');
select ok(not has_function_privilege('anon', 'public.auth_user_id_by_email(text)', 'execute'), 'anon cannot look up accounts');
select ok(not has_function_privilege('authenticated', 'public.auth_user_id_by_email(text)', 'execute'), 'nor can a signed-in user');
select ok(has_function_privilege('service_role', 'public.auth_user_id_by_email(text)', 'execute'), 'the service role can');

set local role service_role;
select is(public.auth_user_id_by_email('ana@cafe-lucia.test'), '00000000-0000-4000-8000-0000000000a1'::uuid, 'finds the account');
select is(public.auth_user_id_by_email('  ANA@Cafe-Lucia.test '), '00000000-0000-4000-8000-0000000000a1'::uuid, 'ignores case and spaces');
select is(public.auth_user_id_by_email('late@cafe-lucia.test'), '00000000-0000-4000-8000-0000000000a3'::uuid, 'finds an account past the first 1000');
select is(public.auth_user_id_by_email('ana%@cafe-lucia.test'), null, 'exact match only, no wildcards');
select is(public.auth_user_id_by_email('nobody@cafe-lucia.test'), null, 'null when there is no account');
reset role;

set local role authenticated;
select throws_ok($$ select public.auth_user_id_by_email('ana@cafe-lucia.test') $$, '42501', null, 'a signed-in call is refused');
reset role;

select * from finish();
rollback;
