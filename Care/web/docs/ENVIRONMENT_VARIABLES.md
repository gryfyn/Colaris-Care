# Environment Variables

## Required In Production

| Variable | Purpose |
|---|---|
| `NODE_ENV=production` | Enables production runtime behavior. |
| `DATABASE_URL` | Runtime PostgreSQL connection string. Use a non-owner app role. For Neon, this is usually the pooled URL. |
| `MIGRATION_DATABASE_URL` | Optional direct PostgreSQL connection string for migrations and DB maintenance. For Neon, use the direct endpoint if available. |
| `DATABASE_SSL=true` | Required unless database traffic is on an approved private encrypted network. Keep this `true` for Neon. |
| `JWT_PRIVATE_KEY_BASE64` | Base64 PEM private key for RS256 access/refresh tokens. |
| `JWT_PUBLIC_KEY_BASE64` | Base64 PEM public key for RS256 verification. |
| `COOKIE_SECRET` | HMAC secret for non-PHI portal cookie. Minimum 32 chars. |
| `TENANT_ENCRYPTION_KEY` | Master secret for tenant/facility PHI key derivation. Minimum 32 chars. |
| `ALLOWED_ORIGINS` | Comma-separated production origins only. No localhost. |
| `ENCRYPTION_KEY_STRATEGY` | Production-approved key strategy. Prefer `aws-kms` or `vault`. |

## Optional / Environment-Specific

| Variable | Purpose |
|---|---|
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | Keep `true` unless managed-provider certificate handling requires otherwise. |
| `JWT_PRIVATE_KEY_PATH` / `JWT_PUBLIC_KEY_PATH` | File-based RSA key alternative for VM/container environments. |
| `JWT_SECRET` | HS256 fallback only. Not preferred for production. |
| `JWT_ACCESS_EXPIRES_IN` | Defaults to `15m`. |
| `JWT_REFRESH_EXPIRES_IN` | Defaults to `8h`. |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window. |
| `RATE_LIMIT_MAX_REQUESTS` | General request limit. |
| `AUTH_RATE_LIMIT_MAX` | Auth-specific request limit. |
| `LOG_LEVEL` | Runtime logging level. |
| `REDIS_URL` / Upstash vars | Optional shared store for distributed rate limits/session revocation if added. |
| Cloudinary vars | Resident face-sheet photo upload integration. |

## Forbidden Values In Production

- `COOKIE_SECRET=change-me-in-production`
- `TENANT_ENCRYPTION_KEY=dev-only-32-char-key-change-me!!`
- `ALLOWED_ORIGINS` containing `localhost`
- Runtime DB user with table ownership
- Runtime DB user with `BYPASSRLS`

## Neon Setup

If you are using Neon:

- Put the pooled Neon connection string in `DATABASE_URL` for the app runtime.
- Put the direct Neon connection string in `MIGRATION_DATABASE_URL` for migrations and grants if you have it.
- Keep `DATABASE_SSL=true`.
- Leave `DATABASE_SSL_REJECT_UNAUTHORIZED=true` unless Neon or your proxy setup requires otherwise.
- Use Neon's direct connection string from the console for one-off migration commands if you want to avoid pooler limits.
- Keep the `sslmode=require&channel_binding=require` query parameters that Neon provides.

## Token Payload Rule

JWT payloads may include user id, organization id, facility id, role, staff id, resident id, token id, and token type. They must not include PHI, names, email, room, diagnosis, medication, document names, or notes.
