-- Migration 0010: Add review workflow + missing columns to evacuation_drills
-- so it matches the API contract used by reports/evacuation-drills.


ALTER TABLE care.evacuation_drills
  ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES ref.staff(id),
  ADD COLUMN IF NOT EXISTS location_evacuated_to TEXT,
  ADD COLUMN IF NOT EXISTS residents_present JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS evacuation_time_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS all_residents_accounted BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS issues_noted TEXT,
  ADD COLUMN IF NOT EXISTS conducted_by_staff_id UUID REFERENCES ref.staff(id),
  ADD COLUMN IF NOT EXISTS conducted_by_signature TEXT,
  ADD COLUMN IF NOT EXISTS review_status TEXT
    CHECK (review_status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES ref.staff(id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_notes TEXT;

-- Useful indices
CREATE INDEX IF NOT EXISTS idx_evac_drills_tenant_status
  ON care.evacuation_drills(tenant_id, review_status);

CREATE INDEX IF NOT EXISTS idx_evac_drills_date
  ON care.evacuation_drills(tenant_id, drill_date DESC);

