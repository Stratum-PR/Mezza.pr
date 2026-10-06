-- Private buckets. Object paths start with the restaurant id: <restaurant_id>/...
-- Images are served with signed URLs.

insert into storage.buckets (id, name, public)
values ('menus', 'menus', false), ('photos', 'photos', false), ('exports', 'exports', false)
on conflict (id) do nothing;

-- The restaurant id at the start of an object path, or null if the path doesn't start with a uuid.
create function public.storage_restaurant_id(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(p_name, '/', 1)::uuid
  end;
$$;
grant execute on function public.storage_restaurant_id(text) to authenticated, service_role;

-- Menus and photos: staff read, managers and owners write.
create policy mezza_media_select on storage.objects for select to authenticated
  using (
    bucket_id in ('menus', 'photos')
    and public.has_role(public.storage_restaurant_id(name), '{owner,manager,server,kitchen}'::public.member_role[])
  );
create policy mezza_media_insert on storage.objects for insert to authenticated
  with check (
    bucket_id in ('menus', 'photos')
    and public.has_role(public.storage_restaurant_id(name), '{owner,manager}'::public.member_role[])
  );
create policy mezza_media_update on storage.objects for update to authenticated
  using (
    bucket_id in ('menus', 'photos')
    and public.has_role(public.storage_restaurant_id(name), '{owner,manager}'::public.member_role[])
  )
  with check (
    bucket_id in ('menus', 'photos')
    and public.has_role(public.storage_restaurant_id(name), '{owner,manager}'::public.member_role[])
  );
create policy mezza_media_delete on storage.objects for delete to authenticated
  using (
    bucket_id in ('menus', 'photos')
    and public.has_role(public.storage_restaurant_id(name), '{owner,manager}'::public.member_role[])
  );

-- Exports: managers and owners.
create policy mezza_exports_select on storage.objects for select to authenticated
  using (
    bucket_id = 'exports'
    and public.has_role(public.storage_restaurant_id(name), '{owner,manager}'::public.member_role[])
  );
create policy mezza_exports_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'exports'
    and public.has_role(public.storage_restaurant_id(name), '{owner,manager}'::public.member_role[])
  );
