-- ============================================================================
-- Migration 0019: Add form_data blob to resident face sheets
-- ============================================================================
-- COMPLIANCE: HIPAA § 164.312(a)(2)(iv) — sensitive fields (SSN, Medicare/
-- Medicaid #) stored inside form_data are encrypted at the application layer
-- before persistence (see src/lib/encryption.js).
--
-- Context:
--   - The "Dependable Care Resident Face Sheet" document captures ~90 fields
--     across 10 sections (identification, legal status, insurance, diagnoses,
--     providers, pharmacy, emergency contacts, legal reps, service
--     coordination, signatures).
--   - The existing typed columns covered only a fraction of these.
--
-- This migration:
--   1. Adds a form_data JSONB column holding the full face sheet content.
--      Existing typed columns are retained for backward compatibility.

ALTER TABLE IF EXISTS care.resident_face_sheets
ADD COLUMN IF NOT EXISTS form_data JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN care.resident_face_sheets.form_data IS
  'Full resident face sheet content keyed by section/field (see faceSheetConfig.js). '
  'Sensitive values (ssn, medicare_number, medicaid_number) are encrypted at the application layer.';
