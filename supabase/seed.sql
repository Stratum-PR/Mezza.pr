-- Static seed: restaurants, menus, themes and QR designs. `pnpm seed` adds the logins, tables with
-- QR tokens, printed-menu page and photos, and 90 days of generated history.
-- Menu data is the prototype's SECTIONS, MENU and MODS (reference/mezza-prototype.html).

-- ---------------------------------------------------------------------------
-- Café Lucía (Viejo San Juan, since 1962)
-- ---------------------------------------------------------------------------
insert into public.restaurants (
  id, slug, name, address, phone, timezone, default_language, default_menu_style,
  status, trial_ends_at, onboarding_step
) values (
  'c0ffee00-0000-4000-8000-000000000001', 'cafe-lucia', 'Café Lucía',
  'Calle San Sebastián, Viejo San Juan, PR', '787-555-0142', 'America/Puerto_Rico', 'es', 'house',
  'active', null, 7
);

insert into public.menu_themes (restaurant_id, palette, display_font, body_font, ornament, paper_texture) values (
  'c0ffee00-0000-4000-8000-000000000001',
  '{"ink":"#1F4D3A","paper":"#F3E9D2","accent":"#8C2F2B","muted":"#B08D57"}',
  'Playfair Display', 'Josefin Sans', '◆', 'parchment'
);

insert into public.menu_sections (id, restaurant_id, name_es, name_en, sort_order) values
  ('c0ffee00-0001-4000-8000-000000000001', 'c0ffee00-0000-4000-8000-000000000001', 'Café', 'Coffee', 0),
  ('c0ffee00-0001-4000-8000-000000000002', 'c0ffee00-0000-4000-8000-000000000001', 'Desayunos', 'Breakfast', 1),
  ('c0ffee00-0001-4000-8000-000000000003', 'c0ffee00-0000-4000-8000-000000000001', 'Sándwiches', 'Sandwiches', 2),
  ('c0ffee00-0001-4000-8000-000000000004', 'c0ffee00-0000-4000-8000-000000000001', 'Dulces', 'Pastries', 3),
  ('c0ffee00-0001-4000-8000-000000000005', 'c0ffee00-0000-4000-8000-000000000001', 'Bebidas', 'Drinks', 4);

insert into public.menu_items (
  id, restaurant_id, section_id, name_es, name_en, description_es, description_en, price_cents, sort_order,
  is_available, sold_out_since
) values
  ('c0ffee00-0002-4000-8000-000000000001', 'c0ffee00-0000-4000-8000-000000000001', 'c0ffee00-0001-4000-8000-000000000001',
   'Café con leche', 'Café con leche', 'Colado puertorriqueño con leche espumada', 'Puerto Rican brew with steamed milk', 250, 0, true, null),
  ('c0ffee00-0002-4000-8000-000000000002', 'c0ffee00-0000-4000-8000-000000000001', 'c0ffee00-0001-4000-8000-000000000001',
   'Cortadito', 'Cortadito', 'Espresso con un toque de leche', 'Espresso with a splash of milk', 225, 1, true, null),
  ('c0ffee00-0002-4000-8000-000000000003', 'c0ffee00-0000-4000-8000-000000000001', 'c0ffee00-0001-4000-8000-000000000001',
   'Café negro', 'Black coffee', 'Colado del día', 'Daily drip', 175, 2, true, null),
  ('c0ffee00-0002-4000-8000-000000000004', 'c0ffee00-0000-4000-8000-000000000001', 'c0ffee00-0001-4000-8000-000000000002',
   'Mallorca', 'Mallorca', 'Pan dulce con azúcar en polvo', 'Sweet bread with powdered sugar', 350, 3, true, null),
  ('c0ffee00-0002-4000-8000-000000000005', 'c0ffee00-0000-4000-8000-000000000001', 'c0ffee00-0001-4000-8000-000000000002',
   'Revoltillo con jamón', 'Scrambled eggs & ham', 'Con tostadas de pan de agua', 'With pan de agua toast', 650, 4, true, null),
  ('c0ffee00-0002-4000-8000-000000000006', 'c0ffee00-0000-4000-8000-000000000001', 'c0ffee00-0001-4000-8000-000000000002',
   'Avena', 'Oatmeal', 'Avena caliente con canela', 'Warm oats with cinnamon', 300, 5, true, null),
  ('c0ffee00-0002-4000-8000-000000000007', 'c0ffee00-0000-4000-8000-000000000001', 'c0ffee00-0001-4000-8000-000000000003',
   'Sándwich de mezcla', 'Mezcla sandwich', 'El clásico de fiesta', 'The classic party spread', 550, 6, true, null),
  ('c0ffee00-0002-4000-8000-000000000008', 'c0ffee00-0000-4000-8000-000000000001', 'c0ffee00-0001-4000-8000-000000000003',
   'Tripleta', 'Tripleta', 'Carne, pollo y jamón con papitas', 'Beef, chicken and ham with potato sticks', 900, 7, true, null),
  ('c0ffee00-0002-4000-8000-000000000009', 'c0ffee00-0000-4000-8000-000000000001', 'c0ffee00-0001-4000-8000-000000000004',
   'Quesito', 'Quesito', 'Hojaldre con queso crema', 'Puff pastry with cream cheese', 200, 8, true, null),
  ('c0ffee00-0002-4000-8000-000000000010', 'c0ffee00-0000-4000-8000-000000000001', 'c0ffee00-0001-4000-8000-000000000004',
   'Flan de queso', 'Cheese flan', 'Receta de la abuela Lucía', 'Grandma Lucía''s recipe', 400, 9, false, now()),
  ('c0ffee00-0002-4000-8000-000000000011', 'c0ffee00-0000-4000-8000-000000000001', 'c0ffee00-0001-4000-8000-000000000005',
   'Jugo de china', 'Orange juice', 'Recién exprimido', 'Freshly squeezed', 350, 10, true, null),
  ('c0ffee00-0002-4000-8000-000000000012', 'c0ffee00-0000-4000-8000-000000000001', 'c0ffee00-0001-4000-8000-000000000005',
   'Malta', 'Malta', 'Bien fría', 'Ice cold', 200, 11, true, null);

-- Flan de queso is sold out right now.
insert into public.item_availability_events (restaurant_id, item_id, sold_out_at)
values ('c0ffee00-0000-4000-8000-000000000001', 'c0ffee00-0002-4000-8000-000000000010', now());

insert into public.modifier_groups (id, restaurant_id, name_es, name_en, min_select, max_select) values
  ('c0ffee00-0003-4000-8000-000000000001', 'c0ffee00-0000-4000-8000-000000000001', 'Leche', 'Milk', 1, 1),
  ('c0ffee00-0003-4000-8000-000000000002', 'c0ffee00-0000-4000-8000-000000000001', 'Azúcar', 'Sugar', 0, 1),
  ('c0ffee00-0003-4000-8000-000000000003', 'c0ffee00-0000-4000-8000-000000000001', 'Mallorca', 'Mallorca', 1, 1),
  ('c0ffee00-0003-4000-8000-000000000004', 'c0ffee00-0000-4000-8000-000000000001', 'Pan', 'Bread', 1, 1);

insert into public.modifier_options (id, restaurant_id, group_id, name_es, name_en, price_cents, sort_order) values
  ('c0ffee00-0004-4000-8000-000000000011', 'c0ffee00-0000-4000-8000-000000000001', 'c0ffee00-0003-4000-8000-000000000001', 'Entera', 'Whole', 0, 0),
  ('c0ffee00-0004-4000-8000-000000000012', 'c0ffee00-0000-4000-8000-000000000001', 'c0ffee00-0003-4000-8000-000000000001', 'Almendra', 'Almond', 75, 1),
  ('c0ffee00-0004-4000-8000-000000000013', 'c0ffee00-0000-4000-8000-000000000001', 'c0ffee00-0003-4000-8000-000000000001', 'Avena', 'Oat', 75, 2),
  ('c0ffee00-0004-4000-8000-000000000021', 'c0ffee00-0000-4000-8000-000000000001', 'c0ffee00-0003-4000-8000-000000000002', 'Normal', 'Regular', 0, 0),
  ('c0ffee00-0004-4000-8000-000000000022', 'c0ffee00-0000-4000-8000-000000000001', 'c0ffee00-0003-4000-8000-000000000002', 'Poca', 'Light', 0, 1),
  ('c0ffee00-0004-4000-8000-000000000023', 'c0ffee00-0000-4000-8000-000000000001', 'c0ffee00-0003-4000-8000-000000000002', 'Sin azúcar', 'No sugar', 0, 2),
  ('c0ffee00-0004-4000-8000-000000000031', 'c0ffee00-0000-4000-8000-000000000001', 'c0ffee00-0003-4000-8000-000000000003', 'Sola', 'Plain', 0, 0),
  ('c0ffee00-0004-4000-8000-000000000032', 'c0ffee00-0000-4000-8000-000000000001', 'c0ffee00-0003-4000-8000-000000000003', 'Jamón y queso', 'Ham & cheese', 200, 1),
  ('c0ffee00-0004-4000-8000-000000000033', 'c0ffee00-0000-4000-8000-000000000001', 'c0ffee00-0003-4000-8000-000000000003', 'A la plancha con mantequilla', 'Buttered & pressed', 50, 2),
  ('c0ffee00-0004-4000-8000-000000000041', 'c0ffee00-0000-4000-8000-000000000001', 'c0ffee00-0003-4000-8000-000000000004', 'Pan sobao', 'Pan sobao', 0, 0),
  ('c0ffee00-0004-4000-8000-000000000042', 'c0ffee00-0000-4000-8000-000000000001', 'c0ffee00-0003-4000-8000-000000000004', 'Pan de agua', 'Pan de agua', 0, 1);

-- Café con leche, Cortadito: milk + sugar · Café negro: sugar · Mallorca: mallorca · Avena: milk ·
-- Sándwich de mezcla, Tripleta: bread.
insert into public.item_modifier_groups (restaurant_id, item_id, group_id, sort_order) values
  ('c0ffee00-0000-4000-8000-000000000001', 'c0ffee00-0002-4000-8000-000000000001', 'c0ffee00-0003-4000-8000-000000000001', 0),
  ('c0ffee00-0000-4000-8000-000000000001', 'c0ffee00-0002-4000-8000-000000000001', 'c0ffee00-0003-4000-8000-000000000002', 1),
  ('c0ffee00-0000-4000-8000-000000000001', 'c0ffee00-0002-4000-8000-000000000002', 'c0ffee00-0003-4000-8000-000000000001', 0),
  ('c0ffee00-0000-4000-8000-000000000001', 'c0ffee00-0002-4000-8000-000000000002', 'c0ffee00-0003-4000-8000-000000000002', 1),
  ('c0ffee00-0000-4000-8000-000000000001', 'c0ffee00-0002-4000-8000-000000000003', 'c0ffee00-0003-4000-8000-000000000002', 0),
  ('c0ffee00-0000-4000-8000-000000000001', 'c0ffee00-0002-4000-8000-000000000004', 'c0ffee00-0003-4000-8000-000000000003', 0),
  ('c0ffee00-0000-4000-8000-000000000001', 'c0ffee00-0002-4000-8000-000000000006', 'c0ffee00-0003-4000-8000-000000000001', 0),
  ('c0ffee00-0000-4000-8000-000000000001', 'c0ffee00-0002-4000-8000-000000000007', 'c0ffee00-0003-4000-8000-000000000004', 0),
  ('c0ffee00-0000-4000-8000-000000000001', 'c0ffee00-0002-4000-8000-000000000008', 'c0ffee00-0003-4000-8000-000000000004', 0);

-- "De la casa" QR design (prototype QR_PRESETS.house).
insert into public.qr_designs (
  restaurant_id, preset, fg, bg, frame, frame_ink, dot_style, eye_style, logo_mode, font
) values (
  'c0ffee00-0000-4000-8000-000000000001', 'house', '#1F4D3A', '#F3E9D2', '#1F4D3A', '#F3E9D2', 'rounded', 'rounded', 'mono', 'menu'
);

insert into public.printers (restaurant_id, name, model, protocol, role, width_chars) values
  ('c0ffee00-0000-4000-8000-000000000001', 'Cocina', 'Navegador', 'browser', 'kitchen', 42),
  ('c0ffee00-0000-4000-8000-000000000001', 'Caja', 'Navegador', 'browser', 'receipt', 42);

insert into public.payment_accounts (restaurant_id, provider, status) values
  ('c0ffee00-0000-4000-8000-000000000001', 'stripe', 'not_connected'),
  ('c0ffee00-0000-4000-8000-000000000001', 'ath', 'not_connected');

insert into public.subscriptions (restaurant_id, plan, status) values ('c0ffee00-0000-4000-8000-000000000001', 'A', 'active');

-- ---------------------------------------------------------------------------
-- Barra Test (used by the isolation tests and as a second tenant in demos)
-- ---------------------------------------------------------------------------
insert into public.restaurants (id, slug, name, address, status, trial_ends_at, onboarding_step) values (
  'ba220000-0000-4000-8000-000000000002', 'barra-test', 'Barra Test', 'Santurce, PR', 'trial', now() + interval '20 days', 7
);

insert into public.menu_sections (id, restaurant_id, name_es, name_en, sort_order) values
  ('ba220000-0001-4000-8000-000000000001', 'ba220000-0000-4000-8000-000000000002', 'Barra', 'Bar', 0),
  ('ba220000-0001-4000-8000-000000000002', 'ba220000-0000-4000-8000-000000000002', 'Para picar', 'Bites', 1);

insert into public.menu_items (id, restaurant_id, section_id, name_es, name_en, price_cents, sort_order) values
  ('ba220000-0002-4000-8000-000000000001', 'ba220000-0000-4000-8000-000000000002', 'ba220000-0001-4000-8000-000000000001', 'Medalla', 'Medalla', 300, 0),
  ('ba220000-0002-4000-8000-000000000002', 'ba220000-0000-4000-8000-000000000002', 'ba220000-0001-4000-8000-000000000001', 'Mojito', 'Mojito', 800, 1),
  ('ba220000-0002-4000-8000-000000000003', 'ba220000-0000-4000-8000-000000000002', 'ba220000-0001-4000-8000-000000000002', 'Tostones', 'Tostones', 500, 2),
  ('ba220000-0002-4000-8000-000000000004', 'ba220000-0000-4000-8000-000000000002', 'ba220000-0001-4000-8000-000000000002', 'Alcapurrias', 'Alcapurrias', 450, 3);

insert into public.qr_designs (restaurant_id) values ('ba220000-0000-4000-8000-000000000002');
insert into public.subscriptions (restaurant_id, plan, status, trial_ends_at)
values ('ba220000-0000-4000-8000-000000000002', 'A', 'trial', now() + interval '20 days');

-- Phase 9b: dish tags for the demo.
update public.menu_items set tags = '{vegetariano}' where restaurant_id = 'c0ffee00-0000-4000-8000-000000000001' and name_es in ('Avena', 'Mallorca', 'Quesito', 'Flan de queso');
update public.menu_items set tags = '{vegetariano,sin_gluten}' where restaurant_id = 'c0ffee00-0000-4000-8000-000000000001' and name_es in ('Jugo de china', 'Café negro', 'Café con leche', 'Cortadito');
