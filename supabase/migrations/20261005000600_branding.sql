-- Ajustes → Marca: the restaurant's colour for the guest page header and buttons, and a cover photo.
-- The logo is the one uploaded in the QR studio (qr_designs.logo_path).
alter table public.restaurants
  add column brand_color text check (brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  add column cover_path text;
