-- ============================================================================
-- Migration 0027: Extend Admission Status to Include 'admitted'
-- ============================================================================
-- Regulation: Pre-Screening-First Admission Workflow (PRESCREENING_WORKFLOW_SPEC.md)
-- When an advance directive is finalized, the resident is created and the
-- admission status transitions to 'admitted'.
--
-- This migration:
-- 1. Extends the status CHECK constraint to allow 'admitted' state
-- 2. Adds a partial index to optimize the "Admit Resident" dropdown query
--    (approved admissions not yet completed)

BEGIN;

-- Drop the existing CHECK constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pending_admissions_status_check'
      AND contype = 'c'
  ) THEN
    ALTER TABLE care.pending_admissions
      DROP CONSTRAINT pending_admissions_status_check;
  END IF;
END $$;

-- Add the new CHECK constraint with 'admitted' allowed
ALTER TABLE care.pending_admissions
  ADD CONSTRAINT pending_admissions_status_check
    CHECK (status IN ('pending', 'approved', 'rejected', 'admitted'));

-- Partial index: optimize Admit-Resident dropdown query
-- Returns approved admissions where advance_directive is incomplete
CREATE INDEX IF NOT EXISTS idx_pending_admissions_approved_open
  ON care.pending_admissions (tenant_id, approved_at DESC)
  WHERE status = 'approved' AND advance_directive_complete = false;

COMMIT;
