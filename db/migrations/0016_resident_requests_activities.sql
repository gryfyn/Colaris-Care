-- ============================================================================
-- Migration 0016: Add resident requests and activities tables
-- ============================================================================
-- COMPLIANCE: HIPAA § 164.312(b) — resident request audit trail
--             § 164.512(b) — resident communication and appointment tracking
--
-- Context:
--   - Resident requests: residents submit requests (appointments, supplies, concerns)
--   - Activities: admin manages weekly activity schedule for residents
--   - Both tables support the residents dashboard and request management workflows
--
-- This migration:
--   1. Creates care.resident_requests with status tracking and response audit trail
--   2. Creates care.activities with weekly schedule management (day_of_week)
--   3. Enables RLS on both tables using app.tenant_id setting
--   4. Adds indexes for common queries (tenant, resident, status, day_of_week)


-- ============================================================================
-- 1. care.resident_requests — Resident submissions and admin responses
-- ============================================================================

CREATE TABLE IF NOT EXISTS care.resident_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES ref.tenants(id),
  resident_id UUID NOT NULL REFERENCES care.residents(id) ON DELETE RESTRICT,
  request_type TEXT NOT NULL CHECK (request_type IN ('Appointment Request', 'Supply/Item Request', 'Dietary Preference', 'Room Concern', 'Activity Request', 'Message to Care Team', 'General Question or Feedback')),
  details TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'fulfilled', 'denied')),
  response TEXT,
  responded_by UUID REFERENCES ref.staff(id) ON DELETE SET NULL,
  responded_at TIMESTAMPTZ,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE care.resident_requests IS
  'Resident requests for appointments, supplies, concerns, and messages. Tracks status and admin responses for audit compliance.';

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_resident_requests_tenant_resident
  ON care.resident_requests(tenant_id, resident_id);

CREATE INDEX IF NOT EXISTS idx_resident_requests_tenant_status
  ON care.resident_requests(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_resident_requests_tenant_created
  ON care.resident_requests(tenant_id, created_at DESC);

-- Updated_at trigger
CREATE TRIGGER set_updated_at_resident_requests BEFORE UPDATE ON care.resident_requests
  FOR EACH ROW EXECUTE FUNCTION care.set_updated_at();

-- Row-level security
ALTER TABLE care.resident_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS resident_requests_select ON care.resident_requests;
DROP POLICY IF EXISTS resident_requests_insert ON care.resident_requests;
DROP POLICY IF EXISTS resident_requests_update ON care.resident_requests;
DROP POLICY IF EXISTS resident_requests_delete ON care.resident_requests;

CREATE POLICY resident_requests_select ON care.resident_requests
  FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY resident_requests_insert ON care.resident_requests
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY resident_requests_update ON care.resident_requests
  FOR UPDATE
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY resident_requests_delete ON care.resident_requests
  FOR DELETE
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- ============================================================================
-- 2. care.activities — Weekly activity schedule for residents
-- ============================================================================

CREATE TABLE IF NOT EXISTS care.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES ref.tenants(id),
  day_of_week TEXT NOT NULL CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
  start_time TIME NOT NULL,
  name TEXT NOT NULL,
  location TEXT,
  category TEXT NOT NULL CHECK (category IN ('Therapy', 'Wellness', 'Creative', 'Life Skills', 'Community')),
  description TEXT,
  duration_minutes INT NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES ref.staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE care.activities IS
  'Weekly activity schedule for residents. Tracks day, time, category, and status for activity dashboard views.';

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_activities_tenant_day_of_week
  ON care.activities(tenant_id, day_of_week);

CREATE INDEX IF NOT EXISTS idx_activities_tenant_active
  ON care.activities(tenant_id, active);

-- Updated_at trigger
CREATE TRIGGER set_updated_at_activities BEFORE UPDATE ON care.activities
  FOR EACH ROW EXECUTE FUNCTION care.set_updated_at();

-- Row-level security
ALTER TABLE care.activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activities_select ON care.activities;
DROP POLICY IF EXISTS activities_insert ON care.activities;
DROP POLICY IF EXISTS activities_update ON care.activities;
DROP POLICY IF EXISTS activities_delete ON care.activities;

CREATE POLICY activities_select ON care.activities
  FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY activities_insert ON care.activities
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY activities_update ON care.activities
  FOR UPDATE
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY activities_delete ON care.activities
  FOR DELETE
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

