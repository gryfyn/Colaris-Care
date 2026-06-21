-- ============================================================================
-- Migration 0018: Add audit fields to appointments table
-- ============================================================================
-- COMPLIANCE: HIPAA § 164.312(b) — appointment audit trail
--
-- Context:
--   - Appointments need updated_by tracking for audit compliance
--   - Staff should know who created and modified each appointment
--
-- This migration:
--   1. Adds updated_by column to care.appointments
--   2. Ensures all existing appointments have audit trails

-- ============================================================================
-- Add updated_by audit field to appointments
-- ============================================================================

ALTER TABLE IF EXISTS care.appointments
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES ref.staff(id) ON DELETE SET NULL;

COMMENT ON COLUMN care.appointments.updated_by IS
  'Staff member who last updated the appointment (for audit trail)';

-- Create index for audit queries
CREATE INDEX IF NOT EXISTS idx_appointments_updated_by
  ON care.appointments(updated_by);
