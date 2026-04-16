-- Fix for: "no unique or exclusion constraint matching the ON CONFLICT specification"
-- Required because createUser() uses upsert(..., { onConflict: 'phone' }).

alter table public.users
  add constraint users_phone_unique unique (phone);

