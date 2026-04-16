-- Apply this to existing projects that already have parking_slots table.
--
-- If you still see "Bucket not found" in the app:
--   Supabase Dashboard → Storage → New bucket → ID/name: slot-images → enable Public.
-- Then run the storage policies below (or re-run this file).

alter table public.parking_slots
  add column if not exists image_url text,
  add column if not exists qr_token text;

create unique index if not exists parking_slots_qr_token_uq
  on public.parking_slots (qr_token)
  where qr_token is not null;

insert into storage.buckets (id, name, public)
values ('slot-images', 'slot-images', true)
on conflict (id) do nothing;

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

