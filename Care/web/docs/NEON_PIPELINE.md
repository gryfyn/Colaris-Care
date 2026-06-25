# Neon Pipeline

Use this layout for a Neon-backed production deployment:

- `DATABASE_URL`: the pooled Neon connection string for the app runtime.
- `MIGRATION_DATABASE_URL`: the direct Neon connection string for migrations, RLS checks, seed scripts, and grant scripts.
- `DATABASE_SSL=true`: required for Neon.
- `DATABASE_SSL_REJECT_UNAUTHORIZED=true`: keep enabled unless your provider path requires otherwise.

Recommended workflow:

1. Put the pooled URL in `DATABASE_URL`.
2. Put the direct URL in `MIGRATION_DATABASE_URL`.
3. Run `node scripts/verify-production-config.mjs`.
4. Run `node scripts/migrate-db.mjs`.
5. Run `node scripts/seed-db.mjs`.
6. Run `node scripts/verify-rls.mjs`.
7. Run `node scripts/apply-runtime-grants.mjs`.

If `DATABASE_URL` points at a Neon pooler endpoint and `MIGRATION_DATABASE_URL` is missing, the production config check fails. That is intentional.
