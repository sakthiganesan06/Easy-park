-- ============================================================
-- EasyPark: Add password_hash & wallet_balance to users table
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Add password_hash column (nullable so existing rows are safe)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- 2. Add wallet_balance column with default 500
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC NOT NULL DEFAULT 500;

-- 3. Update bookings status constraint to support full lifecycle
--    (locked → arrived → paid → active → completed / cancelled)
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_status_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('locked', 'arrived', 'paid', 'active', 'completed', 'cancelled'));

-- 4. RLS policies — allow anon key to read/write users table
DROP POLICY IF EXISTS "dev users all" ON public.users;
CREATE POLICY "dev users all"
  ON public.users FOR ALL
  USING (true)
  WITH CHECK (true);

-- Also ensure anon-specific policies exist for extra safety
DROP POLICY IF EXISTS "Allow anon insert users" ON public.users;
CREATE POLICY "Allow anon insert users"
  ON public.users FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon read users" ON public.users;
CREATE POLICY "Allow anon read users"
  ON public.users FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Allow anon update users" ON public.users;
CREATE POLICY "Allow anon update users"
  ON public.users FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);
