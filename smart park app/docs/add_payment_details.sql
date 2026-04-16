-- ============================================================
-- EasyPark: Add full payment details columns to bookings table
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- Payment method (upi, wallet, card, etc.)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_method TEXT;

-- Base booking amount (original price before extras)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS base_amount NUMERIC NOT NULL DEFAULT 0;

-- Penalty surcharge amount (from previous misuse)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS penalty_amount NUMERIC NOT NULL DEFAULT 0;

-- Extension time added (in minutes)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS extension_minutes INTEGER NOT NULL DEFAULT 0;

-- Cost of extension(s)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS extension_amount NUMERIC NOT NULL DEFAULT 0;

-- Grand total actually charged (base + penalty + extensions)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC NOT NULL DEFAULT 0;

-- Exact timestamp when payment was completed
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Index for analytics queries on payment_method
CREATE INDEX IF NOT EXISTS bookings_payment_method_idx
  ON public.bookings (payment_method);
