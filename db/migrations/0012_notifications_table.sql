-- ============================================================================
-- Migration 0012: Ensure care.notifications exists with care plan due support
-- ============================================================================
-- The notifications table is referenced by other code but may be missing the
-- type and is_read columns we need.


CREATE TABLE IF NOT EXISTS care.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES ref.tenants(id) ON DELETE RESTRICT,
  user_id UUID REFERENCES ref.staff(id) ON DELETE CASCADE,
  role_filter TEXT,
  notification_type TEXT NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  body TEXT,
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  action_url TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  resident_id UUID REFERENCES care.residents(id) ON DELETE SET NULL,
  reference_id UUID,
  document_id UUID,
  related_admission_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Ensure all required columns exist on existing installations
ALTER TABLE care.notifications
  ADD COLUMN IF NOT EXISTS notification_type TEXT DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS related_admission_id UUID;

CREATE INDEX IF NOT EXISTS idx_notifications_tenant_unread
  ON care.notifications(tenant_id, is_read) WHERE is_read = FALSE;

CREATE INDEX IF NOT EXISTS idx_notifications_role_filter
  ON care.notifications(tenant_id, role_filter) WHERE role_filter IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_resident
  ON care.notifications(resident_id) WHERE resident_id IS NOT NULL;

