-- 0008_portrait_photos.sql
-- Cloudinary portrait URL for residents and staff. Stores only the public
-- secure_url returned by Cloudinary (no binary in Postgres); uploads are
-- signed server-side via /api/v1/uploads/sign.

alter table care.residents      add column if not exists photo_url text;
alter table care.staff_profiles add column if not exists photo_url text;
