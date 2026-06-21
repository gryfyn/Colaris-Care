CREATE TABLE IF NOT EXISTS audit_log.credential_history (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES ref.tenants(id),
  user_account_id     UUID NOT NULL REFERENCES care.user_accounts(id) ON DELETE CASCADE,
  staff_id            UUID REFERENCES ref.staff(id),
  resident_id         UUID REFERENCES care.residents(id),
  credential_type     VARCHAR(50) NOT NULL CHECK (credential_type IN ('staff', 'resident', 'reset')),
  username            VARCHAR(200),
  password_hash       TEXT NOT NULL,
  was_temporary       BOOLEAN NOT NULL DEFAULT TRUE,
  generated_by        UUID REFERENCES ref.staff(id),
  generated_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  first_login_at      TIMESTAMPTZ,
  password_changed_at TIMESTAMPTZ,
  reason              VARCHAR(255),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_credential_history_user
  ON audit_log.credential_history(user_account_id);
CREATE INDEX IF NOT EXISTS idx_credential_history_staff
  ON audit_log.credential_history(staff_id);
CREATE INDEX IF NOT EXISTS idx_credential_history_resident
  ON audit_log.credential_history(resident_id);
CREATE INDEX IF NOT EXISTS idx_credential_history_generated_at
  ON audit_log.credential_history(generated_at);
