-- Migration 0009: Add review_status to incident_reports and drug_disposal_records
-- These columns are needed by the review workflow and admin overview queries.


-- Add review status to incident_reports
ALTER TABLE care.incident_reports
  ADD COLUMN IF NOT EXISTS review_status TEXT
    CHECK (review_status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES ref.staff(id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_notes TEXT;

-- Add review status to drug_disposal_records
ALTER TABLE care.drug_disposal_records
  ADD COLUMN IF NOT EXISTS review_status TEXT
    CHECK (review_status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES ref.staff(id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_notes TEXT;

