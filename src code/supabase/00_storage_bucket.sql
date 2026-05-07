-- Supabase Storage setup for SVG floor maps.
-- Run this in the Supabase SQL editor, or create the same bucket manually.
-- The API uses the service role key to upload/download objects, so this bucket
-- can stay private.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'floor-maps',
  'floor-maps',
  false,
  5242880,
  array['image/svg+xml']
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
