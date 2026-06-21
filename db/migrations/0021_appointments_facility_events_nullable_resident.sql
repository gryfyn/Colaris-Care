-- Migration 0021: Allow facility-wide appointments without a resident
--
-- Facility events are stored in care.appointments with is_facility_event = TRUE
-- and no resident_id. Migration 0020 added the facility flag, but the original
-- table definition still required resident_id, causing facility event inserts
-- from the admin calendar to fail with HTTP 500.

ALTER TABLE IF EXISTS care.appointments
  ALTER COLUMN resident_id DROP NOT NULL;

COMMENT ON COLUMN care.appointments.resident_id IS
  'Resident linked to a resident appointment; NULL for facility-wide events.';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'care'
      AND table_name = 'appointments'
      AND column_name = 'is_facility_event'
  ) THEN
    ALTER TABLE care.appointments
      DROP CONSTRAINT IF EXISTS appointments_resident_required_for_non_facility;

    ALTER TABLE care.appointments
      ADD CONSTRAINT appointments_resident_required_for_non_facility
      CHECK (is_facility_event = TRUE OR resident_id IS NOT NULL);
  END IF;
END $$;
