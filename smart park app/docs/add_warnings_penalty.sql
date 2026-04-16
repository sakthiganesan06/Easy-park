-- ============================================================
-- EasyPark: Add warning/penalty columns to bookings & users
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Add warning_count and misuse flag to bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS warning_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS misuse BOOLEAN NOT NULL DEFAULT false;

-- 2. Add total_warnings and penalty_flag to users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS total_warnings INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS penalty_flag BOOLEAN NOT NULL DEFAULT false;

-- 3. Update bookings status constraint to include grace_period and exit_validation
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_status_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('locked', 'arrived', 'paid', 'active', 'grace_period', 'exit_validation', 'completed', 'cancelled'));
