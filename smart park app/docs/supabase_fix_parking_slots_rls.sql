-- Fix: "new row violates row-level security policy" when registering a parking slot
-- (or when uploading a slot image to Storage).
--
-- Why: This app uses VITE_SUPABASE_ANON_KEY only — there is no Supabase Auth session,
-- so auth.uid() is NULL in Postgres. Template policies like
--   WITH CHECK (auth.uid() = owner_id)
-- will always reject inserts. Enabling RLS without any INSERT policy also denies inserts.
--
-- Run this whole script in Supabase → SQL Editor → New query, then Run.
-- It matches the dev-friendly policies in docs/supabase_schema.sql.

-- ---------------------------------------------------------------------------
-- 1) public.parking_slots — allow anon/authenticated full access (dev/demo)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'parking_slots'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.parking_slots', r.policyname);
  END LOOP;
END $$;

ALTER TABLE public.parking_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dev slots all"
  ON public.parking_slots
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 2) storage.objects — slot-images bucket (only if uploads hit RLS)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('slot-images', 'slot-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "dev slot-images read" ON storage.objects;
DROP POLICY IF EXISTS "dev slot-images upload" ON storage.objects;
DROP POLICY IF EXISTS "dev slot-images update" ON storage.objects;

CREATE POLICY "dev slot-images read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'slot-images');

CREATE POLICY "dev slot-images upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'slot-images');

CREATE POLICY "dev slot-images update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'slot-images')
  WITH CHECK (bucket_id = 'slot-images');
