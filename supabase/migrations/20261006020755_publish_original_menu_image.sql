-- Publish an uploaded image independently of dish extraction. Existing dishes are untouched.
-- Only server code can call this, after staff authorization and validating the image bytes.
create or replace function public.publish_original_menu_image(
  p_upload_id uuid, p_width integer, p_height integer, p_reviewed_by uuid
) returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  v_upload public.menu_uploads%rowtype;
  v_page_id uuid;
begin
  select * into v_upload from public.menu_uploads where id = p_upload_id for update;
  if not found then
    raise exception 'menu upload not found' using errcode = 'P0002';
  end if;
  if p_width is null or p_height is null or p_width <= 0 or p_height <= 0
     or p_width::bigint * p_height::bigint > 40000000 then
    raise exception 'invalid image dimensions' using errcode = '22023';
  end if;
  if not exists (select 1 from public.memberships
    where restaurant_id = v_upload.restaurant_id and user_id = p_reviewed_by
      and active and role in ('owner', 'manager')) then
    raise exception 'menu publication requires an active owner or manager' using errcode = '42501';
  end if;
  if v_upload.mime_type not in ('image/jpeg', 'image/png')
     or v_upload.storage_path not like v_upload.restaurant_id::text || '/uploads/%'
     or not exists (select 1 from storage.objects where bucket_id = 'menus' and name = v_upload.storage_path) then
    raise exception 'original uploaded image is missing or invalid' using errcode = '22023';
  end if;
  -- Serialize image replacement across different uploads for the same restaurant.
  perform 1 from public.restaurants where id = v_upload.restaurant_id for update;
  -- A retry must not erase manually assigned tap zones for the same image.
  if v_upload.status = 'published' then
    select id into v_page_id from public.original_menu_pages
      where restaurant_id = v_upload.restaurant_id and image_path = v_upload.storage_path;
    if v_page_id is null then
      raise exception 'published image has since been replaced' using errcode = '22023';
    end if;
    return v_page_id;
  end if;
  if v_upload.status not in ('processing', 'review') then
    raise exception 'upload cannot be published' using errcode = '22023';
  end if;
  -- Old zones refer to the old page layout; their foreign keys cascade on replacement.
  delete from public.original_menu_pages where restaurant_id = v_upload.restaurant_id;
  insert into public.original_menu_pages (restaurant_id, image_path, width, height, page_number)
    values (v_upload.restaurant_id, v_upload.storage_path, p_width, p_height, 1)
    returning id into v_page_id;
  update public.menu_uploads set status = 'published', reviewed_by = p_reviewed_by,
    published_at = now(), ai_result = jsonb_build_object('kind', 'original_image', 'pages',
      jsonb_build_array(jsonb_build_object('storagePath', v_upload.storage_path,
        'width', p_width, 'height', p_height))) where id = p_upload_id;
  return v_page_id;
end;
$$;
revoke all on function public.publish_original_menu_image(uuid, integer, integer, uuid)
  from public, anon, authenticated;
grant execute on function public.publish_original_menu_image(uuid, integer, integer, uuid) to service_role;
