-- ============================================================================
-- Migration 0013: Add raw form_data JSONB to pending_admissions
-- ============================================================================
-- The forms have many free-text fields and dynamic lists (psych meds, etc.)
-- that don't fit cleanly into typed columns. Keep the raw payload per form
-- in JSONB so nothing is lost.


ALTER TABLE care.pending_admissions
  ADD COLUMN IF NOT EXISTS pre_screening_data JSONB,
  ADD COLUMN IF NOT EXISTS nursing_assessment_data JSONB,
  ADD COLUMN IF NOT EXISTS advance_directive_data JSONB,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

