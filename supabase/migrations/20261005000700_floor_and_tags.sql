-- Phase 9b. Mesas floor plan: each table's shape and position (percent of its area's canvas, null
-- until someone places it); `area` already exists as free text. Dish tags for staff and guest menus.
alter table public.dining_tables
  add column shape text not null default 'square' check (shape in ('square', 'round', 'long')),
  add column pos_x numeric(5, 2) check (pos_x between 0 and 100),
  add column pos_y numeric(5, 2) check (pos_y between 0 and 100);

alter table public.menu_items
  add column tags text[] not null default '{}'
    check (tags <@ array['vegetariano', 'sin_gluten', 'picante']::text[]);
