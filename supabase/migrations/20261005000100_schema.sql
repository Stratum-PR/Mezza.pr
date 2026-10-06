-- Mezza pass 1 schema.
-- Conventions: tenant tables carry restaurant_id (not null, cascade) plus created_at/updated_at;
-- money is integer cents; child rows reference parents through (restaurant_id, id) so a row can
-- never point at another restaurant's data.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.app_locale as enum ('es', 'en');
create type public.member_role as enum ('owner', 'manager', 'server', 'kitchen');
create type public.menu_style as enum ('house', 'original', 'simple');
create type public.fiscal_mode as enum ('sit_beside', 'processor');
create type public.restaurant_status as enum ('trial', 'active', 'paused', 'cancelled');
create type public.device_kind as enum ('server', 'kitchen', 'register');
create type public.upload_status as enum ('processing', 'review', 'published', 'failed');
create type public.paper_texture as enum ('none', 'linen', 'kraft', 'parchment');
create type public.qr_dot_style as enum ('square', 'rounded', 'dots');
create type public.qr_eye_style as enum ('square', 'rounded', 'circle');
create type public.qr_logo_mode as enum ('none', 'mono', 'upload');
create type public.qr_font as enum ('menu', 'modern');
create type public.tab_status as enum ('open', 'paying', 'closed');
create type public.split_mode as enum ('one', 'even', 'items');
create type public.service_request_kind as enum ('call_server', 'bring_check');
create type public.service_request_status as enum ('open', 'handled');
create type public.order_source as enum ('qr', 'staff');
create type public.order_status as enum ('new', 'in_kitchen', 'ready', 'served', 'void');
create type public.payment_method as enum ('card', 'ath', 'cash');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded', 'partially_refunded');
create type public.payment_provider as enum ('stripe', 'ath');
create type public.provider_status as enum ('not_connected', 'pending', 'connected', 'unavailable');
create type public.printer_protocol as enum ('browser', 'epson_epos', 'star_webprnt');
create type public.ticket_kind as enum ('kitchen', 'receipt');
create type public.print_status as enum ('queued', 'printed', 'failed');
create type public.export_kind as enum ('ivu_monthly_pdf', 'ivu_monthly_csv', 'sales_csv', 'sales_xlsx', 'qr_pdf');
create type public.audit_action as enum ('void', 'refund', 'price_change', 'pin_reset', 'support_access');
create type public.subscription_status as enum ('trial', 'active', 'past_due', 'cancelled');

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tenants and people
-- ---------------------------------------------------------------------------
create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 2 and 60),
  name text not null check (length(name) between 1 and 120),
  address text,
  phone text,
  timezone text not null default 'America/Puerto_Rico',
  default_language public.app_locale not null default 'es',
  default_menu_style public.menu_style not null default 'house',
  ivu_state_bps integer not null default 1050 check (ivu_state_bps between 0 and 10000),
  ivu_municipal_bps integer not null default 100 check (ivu_municipal_bps between 0 and 10000),
  fiscal_mode public.fiscal_mode not null default 'sit_beside',
  plan text not null default 'A',
  status public.restaurant_status not null default 'trial',
  trial_ends_at timestamptz,
  onboarding_step integer not null default 1 check (onboarding_step between 1 and 7), -- 7 = done
  next_order_number integer not null default 1001 check (next_order_number >= 1001), -- (addition) per-restaurant order numbers
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  preferred_language public.app_locale,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null,
  pin_hash text, -- null in pass 1
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, restaurant_id)
);
create index memberships_restaurant_idx on public.memberships (restaurant_id);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  kind public.device_kind not null,
  last_seen_at timestamptz,
  app_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, id)
);

-- (addition) Stratum staff; not a tenant table.
create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Menu
-- ---------------------------------------------------------------------------
create table public.menu_uploads (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  storage_path text not null,
  mime_type text not null,
  status public.upload_status not null default 'processing',
  ai_result jsonb,
  reviewed_by uuid references auth.users (id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index menu_uploads_restaurant_idx on public.menu_uploads (restaurant_id, created_at desc);

create table public.menu_themes (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null unique references public.restaurants (id) on delete cascade,
  palette jsonb not null, -- { ink, paper, accent, muted }
  display_font text not null,
  body_font text not null,
  ornament text,
  paper_texture public.paper_texture not null default 'none',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.menu_sections (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name_es text not null,
  name_en text not null,
  sort_order integer not null default 0,
  archived_at timestamptz, -- (addition) set when a menu import drops the section; keeps history intact
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, id)
);
create index menu_sections_order_idx on public.menu_sections (restaurant_id, sort_order);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  section_id uuid not null,
  name_es text not null,
  name_en text not null,
  description_es text,
  description_en text,
  price_cents integer not null check (price_cents >= 0),
  photo_path text,
  is_available boolean not null default true,
  sold_out_since timestamptz,
  ai_confidence numeric(3, 2) check (ai_confidence between 0 and 1),
  sort_order integer not null default 0,
  archived_at timestamptz, -- (addition) set when a menu import drops the dish; past orders and reports keep it
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, id),
  foreign key (restaurant_id, section_id) references public.menu_sections (restaurant_id, id) on delete cascade,
  check (is_available or sold_out_since is not null)
);
create index menu_items_section_idx on public.menu_items (restaurant_id, section_id, sort_order);

-- (addition) needed for "time sold out" and lost-sales estimates.
create table public.item_availability_events (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  item_id uuid not null,
  sold_out_at timestamptz not null,
  back_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (restaurant_id, item_id) references public.menu_items (restaurant_id, id) on delete cascade,
  check (back_at is null or back_at >= sold_out_at)
);
create index item_availability_events_item_idx on public.item_availability_events (restaurant_id, item_id, sold_out_at);
-- At most one open sold-out interval per dish.
create unique index item_availability_events_open_idx on public.item_availability_events (item_id) where back_at is null;

create table public.modifier_groups (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name_es text not null,
  name_en text not null,
  min_select integer not null default 0 check (min_select >= 0),
  max_select integer not null default 1 check (max_select >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, id),
  check (max_select >= min_select)
);

create table public.modifier_options (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  group_id uuid not null,
  name_es text not null,
  name_en text not null,
  price_cents integer not null default 0 check (price_cents >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, id),
  foreign key (restaurant_id, group_id) references public.modifier_groups (restaurant_id, id) on delete cascade
);
create index modifier_options_group_idx on public.modifier_options (group_id, sort_order);

create table public.item_modifier_groups (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  item_id uuid not null,
  group_id uuid not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (item_id, group_id),
  foreign key (restaurant_id, item_id) references public.menu_items (restaurant_id, id) on delete cascade,
  foreign key (restaurant_id, group_id) references public.modifier_groups (restaurant_id, id) on delete cascade
);

create table public.original_menu_pages (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  image_path text not null,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  page_number integer not null check (page_number >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, id),
  unique (restaurant_id, page_number)
);

create table public.item_hotspots (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  item_id uuid not null,
  page_id uuid not null,
  x numeric(6, 5) not null check (x between 0 and 1),
  y numeric(6, 5) not null check (y between 0 and 1),
  width numeric(6, 5) not null check (width > 0 and width <= 1),
  height numeric(6, 5) not null check (height > 0 and height <= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (restaurant_id, item_id) references public.menu_items (restaurant_id, id) on delete cascade,
  foreign key (restaurant_id, page_id) references public.original_menu_pages (restaurant_id, id) on delete cascade,
  check (x + width <= 1.00001 and y + height <= 1.00001)
);

-- ---------------------------------------------------------------------------
-- Tables and tabs
-- ---------------------------------------------------------------------------
create table public.dining_tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  label text not null check (length(label) between 1 and 20),
  seats integer check (seats between 1 and 40),
  area text,
  qr_token_hash text unique, -- sha256(token), hex
  token_version integer not null default 1 check (token_version >= 1),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, id),
  unique (restaurant_id, label)
);

create table public.qr_designs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null unique references public.restaurants (id) on delete cascade,
  preset text not null default 'house',
  fg text not null default '#1E2B7E' check (fg ~ '^#[0-9A-Fa-f]{6}$'),
  bg text not null default '#FFFFFF' check (bg ~ '^#[0-9A-Fa-f]{6}$'),
  frame text not null default '#1E2B7E' check (frame ~ '^#[0-9A-Fa-f]{6}$'),
  frame_ink text not null default '#FFFFFF' check (frame_ink ~ '^#[0-9A-Fa-f]{6}$'),
  dot_style public.qr_dot_style not null default 'rounded',
  eye_style public.qr_eye_style not null default 'rounded',
  logo_mode public.qr_logo_mode not null default 'none',
  logo_path text,
  frame_text_es text not null default 'Escanea para ordenar y pagar',
  frame_text_en text not null default 'Scan to order and pay',
  font public.qr_font not null default 'modern',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (logo_mode <> 'upload' or logo_path is not null)
);

create table public.guests (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  phone_e164 text check (phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  consent_at timestamptz,
  preferred_language public.app_locale,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, id)
);

create table public.tabs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  table_id uuid not null,
  status public.tab_status not null default 'open',
  split_mode public.split_mode not null default 'one',
  split_count integer check (split_count between 2 and 20),
  party_size integer check (party_size between 1 and 40), -- (addition)
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  pos_closed_at timestamptz, -- (addition) fiscal path A: closed on the restaurant's POS
  pos_closed_by uuid references auth.users (id) on delete set null, -- (addition)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, id),
  foreign key (restaurant_id, table_id) references public.dining_tables (restaurant_id, id) on delete cascade
);
-- One live tab per table.
create unique index tabs_one_live_per_table on public.tabs (table_id) where status <> 'closed';
create index tabs_restaurant_idx on public.tabs (restaurant_id, opened_at desc);

create table public.tab_participants (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  tab_id uuid not null,
  auth_user_id uuid references auth.users (id) on delete set null, -- null in pass 1
  display_name text,
  guest_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, id),
  foreign key (restaurant_id, tab_id) references public.tabs (restaurant_id, id) on delete cascade,
  foreign key (restaurant_id, guest_id) references public.guests (restaurant_id, id) on delete set null (guest_id)
);

-- Schema only in pass 1: the cart lives on the device.
create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  tab_id uuid not null,
  participant_id uuid,
  item_id uuid not null,
  qty integer not null check (qty between 1 and 99),
  modifiers jsonb not null default '[]',
  shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (restaurant_id, tab_id) references public.tabs (restaurant_id, id) on delete cascade,
  foreign key (restaurant_id, participant_id) references public.tab_participants (restaurant_id, id) on delete cascade,
  foreign key (restaurant_id, item_id) references public.menu_items (restaurant_id, id) on delete cascade
);

create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  tab_id uuid not null,
  kind public.service_request_kind not null,
  status public.service_request_status not null default 'open',
  handled_by uuid references auth.users (id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (restaurant_id, tab_id) references public.tabs (restaurant_id, id) on delete cascade
);
create index service_requests_open_idx on public.service_requests (restaurant_id, status, created_at);

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  tab_id uuid not null,
  number integer not null, -- (addition) per-restaurant, from 1001
  source public.order_source not null,
  idempotency_key text not null,
  status public.order_status not null default 'new',
  guest_language public.app_locale not null default 'es', -- (addition)
  created_by uuid references auth.users (id) on delete set null,
  device_id uuid,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, id),
  unique (restaurant_id, idempotency_key),
  unique (restaurant_id, number),
  foreign key (restaurant_id, tab_id) references public.tabs (restaurant_id, id) on delete cascade,
  foreign key (restaurant_id, device_id) references public.devices (restaurant_id, id) on delete set null (device_id)
);
create index orders_status_idx on public.orders (restaurant_id, status, created_at);
create index orders_updated_idx on public.orders (restaurant_id, updated_at);
create index orders_tab_idx on public.orders (tab_id);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  order_id uuid not null,
  item_id uuid, -- kept nullable so deleting a dish never touches past bills
  name_snapshot_es text not null,
  name_snapshot_en text not null,
  unit_price_cents integer not null check (unit_price_cents >= 0), -- dish price + modifier prices at order time
  qty integer not null check (qty between 1 and 99),
  modifiers_snapshot jsonb not null default '[]',
  participant_id uuid,
  shared boolean not null default false,
  note text check (length(note) <= 200),
  status public.order_status not null default 'new',
  voided_at timestamptz,
  voided_by uuid references auth.users (id) on delete set null,
  void_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (restaurant_id, order_id) references public.orders (restaurant_id, id) on delete cascade,
  foreign key (restaurant_id, item_id) references public.menu_items (restaurant_id, id) on delete set null (item_id),
  foreign key (restaurant_id, participant_id) references public.tab_participants (restaurant_id, id) on delete set null (participant_id),
  check ((voided_at is null) = (void_reason is null))
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_item_idx on public.order_items (restaurant_id, item_id);

-- ---------------------------------------------------------------------------
-- Money
-- ---------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  tab_id uuid not null,
  participant_id uuid,
  method public.payment_method not null,
  amount_cents integer not null check (amount_cents >= 0), -- pre-tax subtotal covered by this payment
  tip_cents integer not null default 0 check (tip_cents >= 0),
  ivu_state_cents integer not null default 0 check (ivu_state_cents >= 0),
  ivu_municipal_cents integer not null default 0 check (ivu_municipal_cents >= 0),
  status public.payment_status not null default 'pending',
  provider_ref text,
  idempotency_key text not null,
  fiscal_control_number text,
  paid_at timestamptz, -- (addition) when the payment was confirmed; reports use it
  confirmed_by uuid references auth.users (id) on delete set null, -- (addition) staff who confirmed cash
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, id),
  unique (restaurant_id, idempotency_key),
  foreign key (restaurant_id, tab_id) references public.tabs (restaurant_id, id) on delete cascade,
  foreign key (restaurant_id, participant_id) references public.tab_participants (restaurant_id, id) on delete set null (participant_id),
  check (status = 'pending' or status = 'failed' or paid_at is not null)
);
create index payments_paid_idx on public.payments (restaurant_id, paid_at);
create index payments_updated_idx on public.payments (restaurant_id, updated_at);
create index payments_tab_idx on public.payments (tab_id);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  payment_id uuid not null,
  amount_cents integer not null check (amount_cents > 0),
  reason text not null check (length(reason) between 1 and 500),
  approved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (restaurant_id, payment_id) references public.payments (restaurant_id, id) on delete cascade
);
create index refunds_payment_idx on public.refunds (payment_id);
create index refunds_created_idx on public.refunds (restaurant_id, created_at);

create table public.payment_accounts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  provider public.payment_provider not null,
  stripe_account_id text,
  ath_keys_secret_id uuid, -- Vault reference
  status public.provider_status not null default 'not_connected',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, provider)
);

-- Server-only, not a tenant table.
create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, event_id)
);

-- ---------------------------------------------------------------------------
-- Kitchen and printing
-- ---------------------------------------------------------------------------
create table public.printers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  model text,
  ip_address text,
  protocol public.printer_protocol not null default 'browser',
  role public.ticket_kind not null,
  width_chars integer not null default 42 check (width_chars between 24 and 64),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, id)
);

create table public.print_jobs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  order_id uuid not null,
  printer_id uuid,
  kind public.ticket_kind not null,
  status public.print_status not null default 'queued',
  error text,
  printed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (restaurant_id, order_id) references public.orders (restaurant_id, id) on delete cascade,
  foreign key (restaurant_id, printer_id) references public.printers (restaurant_id, id) on delete set null (printer_id)
);
create index print_jobs_status_idx on public.print_jobs (restaurant_id, status, created_at);

-- ---------------------------------------------------------------------------
-- Reporting and platform
-- ---------------------------------------------------------------------------
create table public.daily_sales (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  date date not null,
  hour integer not null check (hour between 0 and 23),
  sales_cents integer not null default 0,
  ivu_state_cents integer not null default 0,
  ivu_municipal_cents integer not null default 0,
  tips_cents integer not null default 0,
  covers integer not null default 0,
  orders integer not null default 0,
  card_cents integer not null default 0,
  ath_cents integer not null default 0,
  cash_cents integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, date, hour)
);

create table public.item_sales_daily (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  item_id uuid not null,
  date date not null,
  units integer not null default 0,
  revenue_cents integer not null default 0,
  modifier_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, item_id, date),
  foreign key (restaurant_id, item_id) references public.menu_items (restaurant_id, id) on delete cascade
);

create table public.exports (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  kind public.export_kind not null,
  period text, -- e.g. 2026-09
  file_path text not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  action public.audit_action not null,
  target_table text not null,
  target_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index audit_log_restaurant_idx on public.audit_log (restaurant_id, created_at desc);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null unique references public.restaurants (id) on delete cascade,
  plan text not null,
  stripe_customer_id text,
  status public.subscription_status not null default 'trial',
  trial_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.usage_fees (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  period date not null, -- first day of the month
  card_volume_cents integer not null default 0,
  ath_volume_cents integer not null default 0,
  fee_cents integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, period)
);

-- (addition) time-limited Stratum support access, active only once the owner approves.
create table public.support_access_grants (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  requested_by uuid references auth.users (id) on delete set null,
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  expires_at timestamptz not null,
  reason text not null check (length(reason) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((approved_by is null) = (approved_at is null))
);

-- (addition) marketing site demo requests; not a tenant table.
create table public.demo_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  restaurant_name text check (length(restaurant_name) <= 120),
  email text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text,
  message text check (length(message) <= 2000),
  locale public.app_locale not null default 'es',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at triggers on every table that has the column
-- ---------------------------------------------------------------------------
do $$
declare
  t record;
begin
  for t in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public' and c.column_name = 'updated_at' and tb.table_type = 'BASE TABLE'
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t.table_name
    );
  end loop;
end;
$$;
