-- Migration 0007: Add staff_assignments table for resident-staff relationships

CREATE TABLE IF NOT EXISTS care.staff_assignments (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID         NOT NULL REFERENCES ref.tenants(id) ON DELETE RESTRICT,
  staff_id          UUID         NOT NULL REFERENCES ref.staff(id) ON DELETE RESTRICT,
  resident_id       UUID         NOT NULL REFERENCES care.residents(id) ON DELETE RESTRICT,
  assignment_date   DATE         NOT NULL DEFAULT CURRENT_DATE,
  end_date          DATE,
  is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, staff_id, resident_id)
);

COMMENT ON TABLE care.staff_assignments IS
  'Tracks which staff members are assigned to care for which residents.';

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_staff_assignments_staff_id
  ON care.staff_assignments(staff_id) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_staff_assignments_resident_id
  ON care.staff_assignments(resident_id) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_staff_assignments_tenant_id
  ON care.staff_assignments(tenant_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS staff_assignments_updated_at ON care.staff_assignments;
CREATE TRIGGER staff_assignments_updated_at BEFORE UPDATE ON care.staff_assignments
  FOR EACH ROW EXECUTE FUNCTION care.set_updated_at();

-- RLS Policies for staff_assignments
ALTER TABLE care.staff_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_assignments_tenant_isolation ON care.staff_assignments;
CREATE POLICY staff_assignments_tenant_isolation ON care.staff_assignments
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

DROP POLICY IF EXISTS staff_assignments_insert ON care.staff_assignments;
CREATE POLICY staff_assignments_insert ON care.staff_assignments
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

DROP POLICY IF EXISTS staff_assignments_update ON care.staff_assignments;
CREATE POLICY staff_assignments_update ON care.staff_assignments
  FOR UPDATE USING (tenant_id = current_setting('app.tenant_id')::uuid);
