-- Easy Park - Supabase schema
-- Run this in Supabase SQL Editor.

-- Extensions
create extension if not exists "pgcrypto";

-- USERS
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null unique,
  password_hash text,
  wallet_balance numeric not null default 500,
  created_at timestamptz not null default now()
);

-- PARKING SLOTS
create table if not exists public.parking_slots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  name text not null default 'Parking Slot',
  address text not null default '',
  owner_phone text,
  latitude double precision not null,
  longitude double precision not null,
  pricing jsonb not null default '{}'::jsonb,
  vehicle_types text[] not null default '{}'::text[],
  image_url text,
  qr_token text unique,
  is_available boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists parking_slots_lat_lng_idx
  on public.parking_slots (latitude, longitude);

create index if not exists parking_slots_available_idx
  on public.parking_slots (is_available);

-- STORAGE for slot images
insert into storage.buckets (id, name, public)
values ('slot-images', 'slot-images', true)
on conflict (id) do nothing;

-- BOOKINGS
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  slot_id uuid not null references public.parking_slots(id) on delete cascade,
  duration integer not null,
  start_time timestamptz,
  end_time timestamptz,
  status text not null check (status in ('locked','arrived','paid','active','completed','cancelled')),
  payment_status text not null default 'unpaid',
  created_at timestamptz not null default now()
);

create index if not exists bookings_user_id_idx on public.bookings (user_id);
create index if not exists bookings_slot_id_idx on public.bookings (slot_id);
create index if not exists bookings_status_idx on public.bookings (status);

-- RLS (dev-friendly)
alter table public.users enable row level security;
alter table public.parking_slots enable row level security;
alter table public.bookings enable row level security;

-- NOTE: These permissive policies are for demo/dev so your anon key can read/write.
-- Tighten later (Supabase Auth / JWT claims / ownership checks).
drop policy if exists "dev users all" on public.users;
create policy "dev users all" on public.users for all using (true) with check (true);

drop policy if exists "dev slots all" on public.parking_slots;
create policy "dev slots all" on public.parking_slots for all using (true) with check (true);

drop policy if exists "dev slot-images read" on storage.objects;
create policy "dev slot-images read"
on storage.objects for select
using (bucket_id = 'slot-images');

drop policy if exists "dev slot-images upload" on storage.objects;
create policy "dev slot-images upload"
on storage.objects for insert
with check (bucket_id = 'slot-images');

drop policy if exists "dev slot-images update" on storage.objects;
create policy "dev slot-images update"
on storage.objects for update
using (bucket_id = 'slot-images')
with check (bucket_id = 'slot-images');

drop policy if exists "dev bookings all" on public.bookings;
create policy "dev bookings all" on public.bookings for all using (true) with check (true);

