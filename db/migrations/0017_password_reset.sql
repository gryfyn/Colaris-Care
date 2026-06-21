-- Migration 0017: Add password reset tokens table for forgot password flow

CREATE TABLE IF NOT EXISTS care.password_reset_tokens (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID         NOT NULL REFERENCES care.user_accounts(id) ON DELETE CASCADE,
  token_hash        TEXT         NOT NULL UNIQUE,
  expires_at        TIMESTAMPTZ  NOT NULL,
  used_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE care.password_reset_tokens IS
  'One-time password reset tokens for account recovery. Tokens expire after 30 minutes.';

-- Index for efficient token lookup by hash
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_hash
  ON care.password_reset_tokens(token_hash);

-- Index for efficient user lookup
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id
  ON care.password_reset_tokens(user_id);

-- Index for cleanup queries (find expired tokens)
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at
  ON care.password_reset_tokens(expires_at)
  WHERE used_at IS NULL;
