-- Keep the auth/login route compatible with deployed schemas that predate
-- account lockout, last-login tracking, and first-login password changes.
ALTER TABLE care.user_accounts
  ADD COLUMN IF NOT EXISTS failed_attempts SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS password_changed_required BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS username VARCHAR(200);
