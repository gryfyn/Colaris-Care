-- Postgres-backed refresh-token store and JTI revocation blacklist.
--
-- Replaces the former Redis-backed implementation (src/lib/redis.js, removed).
-- These are auth/session INFRASTRUCTURE tables — they hold no PHI and are read
-- and written by the auth flows (login / refresh / logout / auth-guard) using
-- the service connection BEFORE any tenant context is established. They
-- intentionally do NOT have row-level security enabled: enabling RLS here would
-- require app.tenant_id to be set, which is not available during token rotation
-- and the pre-auth blacklist check.

CREATE SCHEMA IF NOT EXISTS auth;

-- Active (and short-lived "grace") refresh tokens, keyed by JWT id.
CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
  jti          UUID PRIMARY KEY,
  user_id      UUID        NOT NULL,
  tenant_id    UUID,
  role         VARCHAR(100),
  staff_id     UUID,
  resident_id  UUID,
  is_grace     BOOLEAN     NOT NULL DEFAULT FALSE,
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user    ON auth.refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON auth.refresh_tokens (expires_at);

-- Revoked access-token JTIs (logout blacklist). Rows are self-expiring via
-- expires_at; queries filter on it so stale rows are harmless until cleaned up.
CREATE TABLE IF NOT EXISTS auth.revoked_jti (
  jti         UUID        PRIMARY KEY,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revoked_jti_expires ON auth.revoked_jti (expires_at);
