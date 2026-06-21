-- Migration 0008: Add daily_progress_notes table for tracking progress note entries


CREATE TABLE IF NOT EXISTS care.daily_progress_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES ref.tenants(id),
  resident_id UUID NOT NULL REFERENCES care.residents(id),
  staff_id UUID NOT NULL REFERENCES ref.staff(id),
  note_date DATE NOT NULL,
  shift TEXT NOT NULL,
  note_body JSONB NOT NULL,
  review_status TEXT DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES ref.staff(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, resident_id, note_date, shift)
);

COMMENT ON TABLE care.daily_progress_notes IS
  'Daily Progress Notes — OAR 309 treatment progress documentation. Reviewed by supervisor.';

-- Indices for common queries
CREATE INDEX IF NOT EXISTS idx_daily_progress_notes_tenant
  ON care.daily_progress_notes(tenant_id);

CREATE INDEX IF NOT EXISTS idx_daily_progress_notes_resident
  ON care.daily_progress_notes(resident_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_daily_progress_notes_created
  ON care.daily_progress_notes(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_daily_progress_notes_date
  ON care.daily_progress_notes(tenant_id, note_date DESC);

-- Trigger for updated_at
CREATE TRIGGER daily_progress_notes_updated_at BEFORE UPDATE ON care.daily_progress_notes
  FOR EACH ROW EXECUTE FUNCTION care.set_updated_at();

-- RLS Policies
ALTER TABLE care.daily_progress_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS daily_progress_notes_tenant_isolation ON care.daily_progress_notes;
DROP POLICY IF EXISTS daily_progress_notes_modification ON care.daily_progress_notes;

CREATE POLICY daily_progress_notes_select ON care.daily_progress_notes
  FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY daily_progress_notes_insert ON care.daily_progress_notes
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY daily_progress_notes_update ON care.daily_progress_notes
  FOR UPDATE
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY daily_progress_notes_delete ON care.daily_progress_notes
  FOR DELETE
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

