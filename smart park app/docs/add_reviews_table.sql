-- ============================================================
-- EasyPark: Create reviews table for slot ratings & comments
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- REVIEWS table
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID NOT NULL REFERENCES public.parking_slots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT DEFAULT '',
  user_name TEXT NOT NULL DEFAULT 'Anonymous',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reviews_slot_id_idx ON public.reviews (slot_id);
CREATE INDEX IF NOT EXISTS reviews_user_id_idx ON public.reviews (user_id);

-- RLS (dev-friendly — allow anon read/write)
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dev reviews all" ON public.reviews;
CREATE POLICY "dev reviews all" ON public.reviews FOR ALL USING (true) WITH CHECK (true);
