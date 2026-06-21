-- Migration 0023: Cloudinary-hosted resident photo for face sheets
-- Adds metadata columns only. Image bytes are stored by Cloudinary.

ALTER TABLE IF EXISTS care.resident_face_sheets
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS photo_public_id TEXT,
  ADD COLUMN IF NOT EXISTS photo_uploaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS photo_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN care.resident_face_sheets.photo_url IS
  'Secure Cloudinary URL for the resident face sheet photo.';

COMMENT ON COLUMN care.resident_face_sheets.photo_public_id IS
  'Cloudinary public_id used to replace/manage the resident face sheet photo.';

COMMENT ON COLUMN care.resident_face_sheets.photo_metadata IS
  'Non-sensitive Cloudinary upload metadata such as width, height, format, and bytes.';
