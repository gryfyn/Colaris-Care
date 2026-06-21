-- =============================================================================
-- 0028: Pre-Admission Screening becomes a fully standalone form.
--
-- Pre-screening previously shared care.pending_admissions with the nursing
-- assessment + advance directive. It now lives entirely in its own table,
-- care.pre_admission_screenings, with its own lifecycle (draft -> submitted ->
-- approved/declined). This migration adds the workflow + lossless-blob columns
-- the standalone route needs.
--
-- Idempotent (IF NOT EXISTS throughout). Safe to re-run.
-- =============================================================================

-- Lifecycle status for the standalone screening queue.
ALTER TABLE care.pre_admission_screenings
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pre_admission_screenings_status_chk'
  ) THEN
    ALTER TABLE care.pre_admission_screenings
      ADD CONSTRAINT pre_admission_screenings_status_chk
      CHECK (status IN ('draft','submitted','approved','declined','deferred','admitted'));
  END IF;
END $$;

-- Lossless capture of the full wizard payload (typed columns + the per-step
-- buckets under __steps) so any field the form collects is preserved and the
-- wizard can rehydrate every step on resume.
ALTER TABLE care.pre_admission_screenings
  ADD COLUMN IF NOT EXISTS form_data JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Authorship / review trail (submitted_at / submitted_by already exist from the
-- legacy .skip extension; add the ones still missing).
ALTER TABLE care.pre_admission_screenings
  ADD COLUMN IF NOT EXISTS created_by   UUID REFERENCES ref.staff(id);
ALTER TABLE care.pre_admission_screenings
  ADD COLUMN IF NOT EXISTS review_notes TEXT;
ALTER TABLE care.pre_admission_screenings
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE care.pre_admission_screenings
  ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES ref.staff(id);

-- PHI-at-rest flags (mirror care.pending_admissions).
ALTER TABLE care.pre_admission_screenings
  ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE care.pre_admission_screenings
  ADD COLUMN IF NOT EXISTS encrypted_at TIMESTAMPTZ;

-- Admin queue index: list submitted screenings newest-first within a tenant.
CREATE INDEX IF NOT EXISTS idx_pre_screen_status
  ON care.pre_admission_screenings (tenant_id, status, submitted_at DESC)
  WHERE deleted_at IS NULL;
