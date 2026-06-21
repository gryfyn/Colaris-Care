-- ============================================================================
-- Migration 0014: Add RLS policies to staff-related tables
-- ============================================================================
-- COMPLIANCE: HIPAA § 164.312(b) — tenant isolation for PHI access
--
-- Context:
--   - ref.staff and ref.staff_certifications have tenant_id but lacked RLS
--   - ref.organizations lacked both RLS and comprehensive indexes
--   - care.incident_notifications was missing from the RLS enablement loop
--
-- This migration:
--   1. Enables RLS on ref.staff, ref.staff_certifications, ref.organizations
--   2. Creates tenant isolation policies using app.tenant_id setting
--   3. Adds missing indexes for (tenant_id, is_active) and other common queries
--   4. Ensures incident_notifications RLS is in place
--
-- Rollback: DROP POLICY ... ON ... ; ALTER TABLE ... DISABLE ROW LEVEL SECURITY;


-- ============================================================================
-- 1. ref.staff — RLS + indexes
-- ============================================================================

-- Enable RLS
ALTER TABLE ref.staff ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist (idempotent)
DROP POLICY IF EXISTS ref_staff_tenant_isolation ON ref.staff;
DROP POLICY IF EXISTS ref_staff_insert ON ref.staff;
DROP POLICY IF EXISTS ref_staff_update ON ref.staff;

-- Create tenant isolation policies
CREATE POLICY ref_staff_tenant_isolation ON ref.staff
  FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY ref_staff_insert ON ref.staff
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY ref_staff_update ON ref.staff
  FOR UPDATE
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY ref_staff_delete ON ref.staff
  FOR DELETE
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- Add index for common queries: active staff per tenant
CREATE INDEX IF NOT EXISTS idx_staff_tenant_active
  ON ref.staff(tenant_id, is_active) WHERE is_active = TRUE;

-- ============================================================================
-- 2. ref.staff_certifications — RLS + indexes
-- ============================================================================

-- Enable RLS
ALTER TABLE ref.staff_certifications ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist
DROP POLICY IF EXISTS staff_certs_tenant_isolation ON ref.staff_certifications;
DROP POLICY IF EXISTS staff_certs_insert ON ref.staff_certifications;
DROP POLICY IF EXISTS staff_certs_update ON ref.staff_certifications;

-- Create tenant isolation policies
CREATE POLICY staff_certs_tenant_isolation ON ref.staff_certifications
  FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY staff_certs_insert ON ref.staff_certifications
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY staff_certs_update ON ref.staff_certifications
  FOR UPDATE
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY staff_certs_delete ON ref.staff_certifications
  FOR DELETE
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- Add indexes for tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_staff_certs_tenant
  ON ref.staff_certifications(tenant_id);

CREATE INDEX IF NOT EXISTS idx_staff_certs_tenant_type
  ON ref.staff_certifications(tenant_id, certification_type, expiry_date);

-- ============================================================================
-- 3. ref.organizations — RLS + indexes
-- ============================================================================

-- Enable RLS
ALTER TABLE ref.organizations ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist
DROP POLICY IF EXISTS orgs_tenant_isolation ON ref.organizations;
DROP POLICY IF EXISTS orgs_insert ON ref.organizations;
DROP POLICY IF EXISTS orgs_update ON ref.organizations;

-- Create tenant isolation policies
CREATE POLICY orgs_tenant_isolation ON ref.organizations
  FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY orgs_insert ON ref.organizations
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY orgs_update ON ref.organizations
  FOR UPDATE
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY orgs_delete ON ref.organizations
  FOR DELETE
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- Add indexes for common ROI and referral lookups
CREATE INDEX IF NOT EXISTS idx_orgs_tenant
  ON ref.organizations(tenant_id);

CREATE INDEX IF NOT EXISTS idx_orgs_tenant_type
  ON ref.organizations(tenant_id, org_type) WHERE org_type IS NOT NULL;

-- ============================================================================
-- 4. care.incident_notifications — RLS (was created in db.sql but not in loop)
-- ============================================================================

-- Enable RLS
ALTER TABLE care.incident_notifications ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist
DROP POLICY IF EXISTS incident_notifs_tenant_isolation ON care.incident_notifications;
DROP POLICY IF EXISTS incident_notifs_insert ON care.incident_notifications;
DROP POLICY IF EXISTS incident_notifs_update ON care.incident_notifications;

-- Create tenant isolation policies
CREATE POLICY incident_notifs_tenant_isolation ON care.incident_notifications
  FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY incident_notifs_insert ON care.incident_notifications
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY incident_notifs_update ON care.incident_notifications
  FOR UPDATE
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY incident_notifs_delete ON care.incident_notifications
  FOR DELETE
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- Add index for common queries
CREATE INDEX IF NOT EXISTS idx_incident_notifs_tenant
  ON care.incident_notifications(tenant_id);

CREATE INDEX IF NOT EXISTS idx_incident_notifs_incident
  ON care.incident_notifications(incident_id, tenant_id);

