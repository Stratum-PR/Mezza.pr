begin;
select no_plan();
insert into auth.users (id, email) values
 ('00000000-0000-4000-8000-000000000011','image-owner@test.invalid'),
 ('00000000-0000-4000-8000-000000000012','image-server@test.invalid');
insert into public.restaurants (id,slug,name) values
 ('00000000-0000-4000-8000-000000000021','image-test','Image test');
insert into public.memberships (restaurant_id,user_id,role) values
 ('00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000011','owner'),
 ('00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000012','server');
insert into public.menu_sections (id,restaurant_id,name_es,name_en) values
 ('00000000-0000-4000-8000-000000000031','00000000-0000-4000-8000-000000000021','Comida','Food');
insert into public.menu_items (id,restaurant_id,section_id,name_es,name_en,price_cents) values
 ('00000000-0000-4000-8000-000000000041','00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000031','Mi plato','My dish',1234);
insert into storage.objects (bucket_id,name) values ('menus','00000000-0000-4000-8000-000000000021/uploads/actual.jpg');
insert into public.menu_uploads (id,restaurant_id,storage_path,mime_type,status,ai_result) values
 ('00000000-0000-4000-8000-000000000051','00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000021/uploads/actual.jpg','image/jpeg','review','{"pages":[{"storagePath":"sample.svg"}]}'),
 ('00000000-0000-4000-8000-000000000052','00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000021/uploads/missing.jpg','image/jpeg','review',null);
select ok(not has_function_privilege('authenticated','public.publish_original_menu_image(uuid,integer,integer,uuid)','EXECUTE'),'browser role cannot bypass server image validation');
set local role service_role;
select throws_ok($$select public.publish_original_menu_image('00000000-0000-4000-8000-000000000051',640,800,'00000000-0000-4000-8000-000000000012')$$,'42501',null,'server cannot publish an image');
select lives_ok($$select public.publish_original_menu_image('00000000-0000-4000-8000-000000000051',640,800,'00000000-0000-4000-8000-000000000011')$$,'owner publishes the actual upload');
select is((select image_path from public.original_menu_pages where restaurant_id='00000000-0000-4000-8000-000000000021'),'00000000-0000-4000-8000-000000000021/uploads/actual.jpg','uses the original path instead of the fixture result');
select is((select width from public.original_menu_pages where restaurant_id='00000000-0000-4000-8000-000000000021'),640,'saves actual dimensions');
select is((select status::text from public.menu_uploads where id='00000000-0000-4000-8000-000000000051'),'published','marks upload published');
select is((select price_cents from public.menu_items where id='00000000-0000-4000-8000-000000000041'),1234,'dish prices are unchanged');
select ok((select archived_at is null from public.menu_items where id='00000000-0000-4000-8000-000000000041'),'existing dishes stay active');
select lives_ok($$select public.publish_original_menu_image('00000000-0000-4000-8000-000000000051',640,800,'00000000-0000-4000-8000-000000000011')$$,'retry is idempotent');
select throws_ok($$select public.publish_original_menu_image('00000000-0000-4000-8000-000000000052',640,800,'00000000-0000-4000-8000-000000000011')$$,'22023',null,'missing object is rejected');
select is((select count(*)::int from public.original_menu_pages where restaurant_id='00000000-0000-4000-8000-000000000021'),1,'failed publication preserves the existing page');
select * from finish();
rollback;
