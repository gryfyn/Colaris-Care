-- ============================================================================
-- Migration 0015: Add appointments and announcements tables
-- ============================================================================
-- COMPLIANCE: HIPAA § 164.312(b) — appointment scheduling audit trail
--             § 164.512(b) — resident notification for upcoming appointments
--
-- Context:
--   - Appointments are scheduled medical, dental, social, or family visits
--   - Announcements are facility-wide notifications (staff, family, residents)
--   - Face sheets table already exists (care.resident_face_sheets)
--
-- This migration:
--   1. Creates care.appointments with full audit trail (created_by, timestamps)
--   2. Creates care.announcements with audience targeting and expiry
--   3. Enables RLS on both tables using app.tenant_id setting
--   4. Adds tenant, schedule, and status indexes for common queries


-- ============================================================================
-- 1. care.appointments — Schedule visits and track completion
-- ============================================================================

CREATE TABLE IF NOT EXISTS care.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES ref.tenants(id),
  resident_id UUID NOT NULL REFERENCES care.residents(id) ON DELETE RESTRICT,
  staff_id UUID REFERENCES ref.staff(id) ON DELETE SET NULL,
  appointment_type TEXT NOT NULL CHECK (appointment_type IN ('medical', 'dental', 'social', 'family', 'other')),
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT DEFAULT 60 CHECK (duration_minutes > 0),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
  notes TEXT,
  created_by UUID REFERENCES ref.staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE care.appointments IS
  'Medical, dental, social, family, and other scheduled visits. Tracks status for calendar views.';

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_scheduled
  ON care.appointments(tenant_id, scheduled_at DESC);

CREATE INDEX IF NOT EXISTS idx_appointments_tenant_resident
  ON care.appointments(tenant_id, resident_id);

CREATE INDEX IF NOT EXISTS idx_appointments_tenant_staff
  ON care.appointments(tenant_id, staff_id);

CREATE INDEX IF NOT EXISTS idx_appointments_tenant_status
  ON care.appointments(tenant_id, status);

-- Updated_at trigger
CREATE TRIGGER set_updated_at_appointments BEFORE UPDATE ON care.appointments
  FOR EACH ROW EXECUTE FUNCTION care.set_updated_at();

-- Row-level security
ALTER TABLE care.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS appointments_select ON care.appointments;
DROP POLICY IF EXISTS appointments_insert ON care.appointments;
DROP POLICY IF EXISTS appointments_update ON care.appointments;
DROP POLICY IF EXISTS appointments_delete ON care.appointments;

CREATE POLICY appointments_select ON care.appointments
  FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY appointments_insert ON care.appointments
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY appointments_update ON care.appointments
  FOR UPDATE
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY appointments_delete ON care.appointments
  FOR DELETE
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- ============================================================================
-- 2. care.announcements — Facility communications
-- ============================================================================

CREATE TABLE IF NOT EXISTS care.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES ref.tenants(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'all' CHECK (audience IN ('all', 'staff', 'family', 'residents')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  published_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES ref.staff(id) ON DELETE RESTRICT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE care.announcements IS
  'Facility announcements targeted to staff, family, residents, or all. Used for alerts, policy changes, and communications.';

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_announcements_tenant_published
  ON care.announcements(tenant_id, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_announcements_tenant_active
  ON care.announcements(tenant_id, active);

-- Updated_at trigger
CREATE TRIGGER set_updated_at_announcements BEFORE UPDATE ON care.announcements
  FOR EACH ROW EXECUTE FUNCTION care.set_updated_at();

-- Row-level security
ALTER TABLE care.announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS announcements_select ON care.announcements;
DROP POLICY IF EXISTS announcements_insert ON care.announcements;
DROP POLICY IF EXISTS announcements_update ON care.announcements;
DROP POLICY IF EXISTS announcements_delete ON care.announcements;

CREATE POLICY announcements_select ON care.announcements
  FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY announcements_insert ON care.announcements
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY announcements_update ON care.announcements
  FOR UPDATE
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY announcements_delete ON care.announcements
  FOR DELETE
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

