-- Migration 0020: Add is_facility_event to care.appointments
--
-- The appointments API (src/app/api/v1/appointments/route.js) reads and writes
-- care.appointments.is_facility_event to distinguish facility-wide events (no
-- specific resident) from resident appointments. The column was referenced in
-- code but never created by a migration (0015 created the table, 0018 added
-- updated_by), so every GET/POST to /api/v1/appointments fails with
-- "column a.is_facility_event does not exist" → HTTP 500.
--
-- This adds the missing column idempotently.

ALTER TABLE IF EXISTS care.appointments
  ADD COLUMN IF NOT EXISTS is_facility_event BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN care.appointments.is_facility_event IS
  'TRUE for facility-wide events with no specific resident; FALSE for resident appointments.';

-- Facility events are queried/listed separately; a partial index keeps that cheap.
CREATE INDEX IF NOT EXISTS idx_appointments_facility_event
  ON care.appointments(tenant_id, scheduled_at DESC)
  WHERE is_facility_event = TRUE;
