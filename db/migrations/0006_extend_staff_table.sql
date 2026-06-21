-- Migration: Extend ref.staff table with additional fields
-- Purpose: Support comprehensive staff member information collection
-- Created: 2026-05-15

DO $$
BEGIN
  -- Add preferred_name column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'ref' AND table_name = 'staff' AND column_name = 'preferred_name'
  ) THEN
    ALTER TABLE ref.staff ADD COLUMN preferred_name VARCHAR(100);
    COMMENT ON COLUMN ref.staff.preferred_name IS 'Display name if different from legal name';
  END IF;

  -- Add pronouns column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'ref' AND table_name = 'staff' AND column_name = 'pronouns'
  ) THEN
    ALTER TABLE ref.staff ADD COLUMN pronouns VARCHAR(50);
    COMMENT ON COLUMN ref.staff.pronouns IS 'Preferred pronouns (he/him, she/her, they/them, etc)';
  END IF;

  -- Add shift column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'ref' AND table_name = 'staff' AND column_name = 'shift'
  ) THEN
    ALTER TABLE ref.staff ADD COLUMN shift VARCHAR(50);
    COMMENT ON COLUMN ref.staff.shift IS 'Primary shift assignment (day, night, swing)';
  END IF;

  -- Add employee_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'ref' AND table_name = 'staff' AND column_name = 'employee_id'
  ) THEN
    ALTER TABLE ref.staff ADD COLUMN employee_id VARCHAR(100);
    COMMENT ON COLUMN ref.staff.employee_id IS 'Internal employee or badge number';
  END IF;

  -- Add emergency_contact_name column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'ref' AND table_name = 'staff' AND column_name = 'emergency_contact_name'
  ) THEN
    ALTER TABLE ref.staff ADD COLUMN emergency_contact_name VARCHAR(100);
    COMMENT ON COLUMN ref.staff.emergency_contact_name IS 'Emergency contact person full name';
  END IF;

  -- Add emergency_contact_phone column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'ref' AND table_name = 'staff' AND column_name = 'emergency_contact_phone'
  ) THEN
    ALTER TABLE ref.staff ADD COLUMN emergency_contact_phone VARCHAR(30);
    COMMENT ON COLUMN ref.staff.emergency_contact_phone IS 'Emergency contact phone number';
  END IF;

  -- Add emergency_contact_relation column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'ref' AND table_name = 'staff' AND column_name = 'emergency_contact_relation'
  ) THEN
    ALTER TABLE ref.staff ADD COLUMN emergency_contact_relation VARCHAR(50);
    COMMENT ON COLUMN ref.staff.emergency_contact_relation IS 'Relationship to emergency contact (spouse, parent, sibling, etc)';
  END IF;

  -- Add notes column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'ref' AND table_name = 'staff' AND column_name = 'notes'
  ) THEN
    ALTER TABLE ref.staff ADD COLUMN notes TEXT;
    COMMENT ON COLUMN ref.staff.notes IS 'Internal notes (onboarding, constraints, considerations)';
  END IF;

  RAISE NOTICE 'Migration 0006: Extended ref.staff table with additional staff information columns';
END $$;
