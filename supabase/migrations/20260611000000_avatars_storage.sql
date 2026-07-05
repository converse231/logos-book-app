-- ─────────────────────────────────────────────────────────────────────────────
-- Avatars storage bucket (onboarding profile picture + future profile edits).
-- Public bucket so avatar URLs render anywhere; writes are owner-scoped — a user
-- may only create/replace/delete files under their own uid folder (avatars/<uid>/…).
-- users.avatar_url already exists (B1 schema) and stores the resulting public URL.
--
-- Run: paste into Supabase SQL Editor (or `supabase db push`). Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- storage.objects has RLS on by default. Scope the avatars bucket: world-readable,
-- owner-only writes (first path segment must equal the caller's uid).
drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists avatars_owner_insert on storage.objects;
create policy avatars_owner_insert on storage.objects
  for insert with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_owner_update on storage.objects;
create policy avatars_owner_update on storage.objects
  for update using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_owner_delete on storage.objects;
create policy avatars_owner_delete on storage.objects
  for delete using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );
