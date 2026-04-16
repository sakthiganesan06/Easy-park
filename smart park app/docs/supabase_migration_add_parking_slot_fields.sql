-- Run if your parking_slots table already exists without these columns.

alter table public.parking_slots
  add column if not exists name text not null default 'Parking Slot',
  add column if not exists address text not null default '',
  add column if not exists owner_phone text;

