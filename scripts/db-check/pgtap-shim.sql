-- The subset of pgTAP that supabase/tests uses, for running the tests in PGlite (no pgTAP build).
-- Real runs use pgTAP through `supabase test db`. State lives in custom GUCs so it survives
-- `set local role`.

create function extensions._tap_next() returns integer language sql as $$
  select set_config('tap.n', (coalesce(nullif(current_setting('tap.n', true), ''), '0')::integer + 1)::text, false)::integer;
$$;

create function extensions._tap_result(ok boolean, description text, diag text default null) returns text
language plpgsql as $$
declare
  n integer := extensions._tap_next();
begin
  if not coalesce(ok, false) then
    perform set_config('tap.failed', (coalesce(nullif(current_setting('tap.failed', true), ''), '0')::integer + 1)::text, false);
  end if;
  return case when coalesce(ok, false) then 'ok ' else 'not ok ' end || n || ' - ' || coalesce(description, '')
    || case when not coalesce(ok, false) and diag is not null then E'\n# ' || diag else '' end;
end;
$$;

create function extensions.plan(integer) returns text language plpgsql as $$
begin
  perform set_config('tap.n', '0', false);
  perform set_config('tap.failed', '0', false);
  perform set_config('tap.planned', $1::text, false);
  return '1..' || $1;
end;
$$;

create function extensions.no_plan() returns setof boolean language plpgsql as $$
begin
  perform set_config('tap.n', '0', false);
  perform set_config('tap.failed', '0', false);
  perform set_config('tap.planned', '', false);
  return;
end;
$$;

create function extensions.ok(boolean, text default null) returns text language sql as $$
  select extensions._tap_result($1, $2);
$$;

create function extensions.is(anyelement, anyelement, text default null) returns text language sql as $$
  select extensions._tap_result($1 is not distinct from $2, $3, format('have: %s, want: %s', $1, $2));
$$;

create function extensions.isnt(anyelement, anyelement, text default null) returns text language sql as $$
  select extensions._tap_result($1 is distinct from $2, $3, format('both: %s', $1));
$$;

create function extensions.throws_ok(text, text, text, text) returns text language plpgsql as $$
begin
  execute $1;
  return extensions._tap_result(false, $4, 'no exception raised');
exception when others then
  return extensions._tap_result(
    ($2 is null or sqlstate = $2) and ($3 is null or sqlerrm = $3),
    $4,
    format('got %s: %s', sqlstate, sqlerrm)
  );
end;
$$;

create function extensions.lives_ok(text, text default null) returns text language plpgsql as $$
begin
  execute $1;
  return extensions._tap_result(true, $2);
exception when others then
  return extensions._tap_result(false, $2, format('died %s: %s', sqlstate, sqlerrm));
end;
$$;

create function extensions.finish() returns setof text language plpgsql as $$
declare
  n integer := coalesce(nullif(current_setting('tap.n', true), ''), '0')::integer;
  planned text := nullif(current_setting('tap.planned', true), '');
begin
  if planned is null then
    return next '1..' || n;
  elsif planned::integer <> n then
    perform set_config('tap.failed', (coalesce(nullif(current_setting('tap.failed', true), ''), '0')::integer + 1)::text, false);
    return next format('# Looks like you planned %s tests but ran %s', planned, n);
  end if;
  return;
end;
$$;

grant execute on all functions in schema extensions to anon, authenticated, service_role;
