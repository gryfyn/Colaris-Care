-- =============================================================================
-- 0029: Nursing Assessment + Advance Directive become standalone forms, each in
-- its own table, chained off the standalone pre-screening (migration 0028):
--
--   pre_admission_screenings  --(pre_screening_id)-->  nursing_admissions
--   nursing_admissions        --(nursing_admission_id)--> advance_directives
--
-- Resident demographics entered once in the pre-screening are carried forward
-- (retrieved → pre-filled) into the nursing assessment and advance directive.
-- The resident row itself is created only when the advance directive is
-- finalized, so resident_id must be NULLABLE on both tables during intake.
--
-- Idempotent. Safe to re-run.
-- =============================================================================

-- ---- care.nursing_admissions ----------------------------------------------
ALTER TABLE care.nursing_admissions ALTER COLUMN resident_id DROP NOT NULL;

ALTER TABLE care.nursing_admissions
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'nursing_admissions_status_chk') THEN
    ALTER TABLE care.nursing_admissions
      ADD CONSTRAINT nursing_admissions_status_chk
      CHECK (status IN ('draft','submitted','approved','declined','admitted'));
  END IF;
END $$;
ALTER TABLE care.nursing_admissions ADD COLUMN IF NOT EXISTS form_data    JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE care.nursing_admissions ADD COLUMN IF NOT EXISTS created_by   UUID REFERENCES ref.staff(id);
ALTER TABLE care.nursing_admissions ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE care.nursing_admissions ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES ref.staff(id);
ALTER TABLE care.nursing_admissions ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE care.nursing_admissions ADD COLUMN IF NOT EXISTS encrypted_at TIMESTAMPTZ;
ALTER TABLE care.nursing_admissions ADD COLUMN IF NOT EXISTS pre_screening_id UUID REFERENCES care.pre_admission_screenings(id);

CREATE INDEX IF NOT EXISTS idx_nursing_status
  ON care.nursing_admissions (tenant_id, status, submitted_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_nursing_prescreen
  ON care.nursing_admissions (pre_screening_id) WHERE pre_screening_id IS NOT NULL;

-- ---- care.advance_directives -----------------------------------------------
ALTER TABLE care.advance_directives ALTER COLUMN resident_id DROP NOT NULL;

ALTER TABLE care.advance_directives
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'advance_directives_status_chk') THEN
    ALTER TABLE care.advance_directives
      ADD CONSTRAINT advance_directives_status_chk
      CHECK (status IN ('draft','submitted','approved','declined','admitted'));
  END IF;
END $$;
ALTER TABLE care.advance_directives ADD COLUMN IF NOT EXISTS form_data    JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE care.advance_directives ADD COLUMN IF NOT EXISTS created_by   UUID REFERENCES ref.staff(id);
ALTER TABLE care.advance_directives ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE care.advance_directives ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES ref.staff(id);
ALTER TABLE care.advance_directives ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE care.advance_directives ADD COLUMN IF NOT EXISTS encrypted_at TIMESTAMPTZ;
ALTER TABLE care.advance_directives ADD COLUMN IF NOT EXISTS pre_screening_id     UUID REFERENCES care.pre_admission_screenings(id);
ALTER TABLE care.advance_directives ADD COLUMN IF NOT EXISTS nursing_admission_id UUID REFERENCES care.nursing_admissions(id);

CREATE INDEX IF NOT EXISTS idx_advdir_status
  ON care.advance_directives (tenant_id, status, submitted_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_advdir_nursing
  ON care.advance_directives (nursing_admission_id) WHERE nursing_admission_id IS NOT NULL;
