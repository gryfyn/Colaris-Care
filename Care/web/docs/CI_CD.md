# CI/CD

## CI

The `CI` workflow runs on pull requests and pushes to `main` / `develop`.

It runs:

1. `npm ci`
2. `node scripts/check-staged-application.mjs`
3. `npm test -- --runInBand`
4. `npm run lint`
5. `npm run build`

## Production Checks

The `Production Checks` workflow is manual. It verifies production environment configuration and can optionally run Playwright smoke tests against a configured production/staging base URL.

Required secrets:

- `DATABASE_URL`
- `COOKIE_SECRET`
- `TENANT_ENCRYPTION_KEY`
- `JWT_PRIVATE_KEY_BASE64`
- `JWT_PUBLIC_KEY_BASE64`
- `E2E_ADMIN_EMAIL`
- `E2E_ADMIN_PASSWORD`
- `E2E_STAFF_EMAIL`
- `E2E_STAFF_PASSWORD`

Required variables:

- `ALLOWED_ORIGINS`
- `PLAYWRIGHT_BASE_URL`

## Deployment Policy

These workflows do not deploy automatically.

Production deployment remains gated by:

- Clean CI.
- Successful migration on the target database.
- RLS verification.
- Production config verification.
- Smoke tests.
- Human approval.
