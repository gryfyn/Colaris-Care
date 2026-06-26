# Deployment Guide — Dependable Care

This app needs two things running together: **PostgreSQL** and the
**Next.js app** (with RS256 JWT keys + a PHI encryption key). The supported,
"works in production exactly like development" path is **Docker Compose** — one
command brings up both wired together. Refresh-token storage and access-token
revocation are backed by PostgreSQL (`auth.refresh_tokens` / `auth.revoked_jti`),
so there is no separate cache service to run.

> **Requirement:** a host with Docker + Docker Compose installed (any VPS — e.g.
> a $6–12/mo droplet, Hetzner, Render, Railway, or your own server).

---

## TL;DR — host it

```bash
# 1. Generate JWT signing keys (RS256) into ./secrets
openssl genrsa -out secrets/jwt.private.pem 2048
openssl rsa  -in secrets/jwt.private.pem -pubout -out secrets/jwt.public.pem

# 2. Create the production env file and fill in the CHANGE-ME values
cp .env.production.example .env
#    - set a strong POSTGRES_PASSWORD (and mirror it inside DATABASE_URL)
#    - TENANT_ENCRYPTION_KEY = output of:  openssl rand -hex 32
#    - COOKIE_SECRET         = output of:  openssl rand -hex 32
#    - ALLOWED_ORIGINS / NEXT_PUBLIC_API_URL = your real https domain

# 3. Build + launch the whole stack (Postgres, migrations, app)
docker compose up -d --build

# 4. Seed the first admin user(s)
docker compose exec app node scripts/seed-admins.js

# 5. Verify everything is healthy
curl http://localhost:3000/api/v1/health
#    → {"status":"ok","db":"..."}
```

The app is now on port `3000`. Put a reverse proxy (Caddy / Nginx / your host's
load balancer) in front of it for HTTPS on your domain.

---

## What each piece does in production

| Concern | Dev behavior | Production behavior | How it's guaranteed |
|---|---|---|---|
| **PostgreSQL** | local instance via `.env.local` | `postgres` compose service, persistent `pgdata` volume | `DATABASE_URL` points at the `postgres` service; migrations run automatically on `up` |
| **Token store / revocation** | same Postgres DB | `auth.refresh_tokens` + `auth.revoked_jti` tables in Postgres | created by migration `0030_auth_token_store.sql`; no separate service |
| **JWT** | dev symmetric fallback if keys missing | RS256 keys **must** exist; app exits if not | keys mounted read-only at `/app/secrets` from `./secrets` |
| **PHI encryption** | derived dev key | `TENANT_ENCRYPTION_KEY` **required** (64 hex); app errors without it | env var injected into the container |

---

## Generating the required secrets

```bash
# RS256 JWT keypair  → ./secrets/jwt.private.pem and jwt.public.pem
openssl genrsa -out secrets/jwt.private.pem 2048
openssl rsa  -in secrets/jwt.private.pem -pubout -out secrets/jwt.public.pem

# PHI encryption key (64 hex chars) → TENANT_ENCRYPTION_KEY in .env
openssl rand -hex 32

# Cookie secret → COOKIE_SECRET in .env
openssl rand -hex 32
```

> ⚠️ **Back up `TENANT_ENCRYPTION_KEY` and the JWT private key somewhere safe.**
> If `TENANT_ENCRYPTION_KEY` is lost or changed, every already-encrypted SSN /
> Medicare / Medicaid number becomes permanently unreadable.

---

## Database migrations

Migrations run automatically: the `migrate` compose service applies
`db/db.sql` + every `db/migrations/*.sql` (files ending in `.skip` are ignored)
before the app starts. To re-run them manually:

```bash
docker compose run --rm migrate
```

To open a psql shell:

```bash
docker compose exec postgres psql -U colaris -d colaris_db
```

---

## Day-2 operations

```bash
docker compose logs -f app        # tail app logs
docker compose ps                 # status + health of every service
docker compose up -d --build      # redeploy after a code change
docker compose down               # stop (data volumes are preserved)
docker compose down -v            # stop AND delete all data — destructive

# Back up the database
docker compose exec postgres pg_dump -U colaris colaris_db > backup_$(date +%F).sql
```

---

## Using an EXTERNAL managed database instead

If your host provides managed Postgres, you can drop the in-stack one:

1. Point `DATABASE_URL` at the managed endpoint.
2. Set `DATABASE_SSL=true`. If the provider uses a self-signed chain
   (Heroku, Supabase, some RDS configs) also set
   `DATABASE_SSL_REJECT_UNAUTHORIZED=false`.
3. Remove the `postgres` service and its `depends_on` entries from
   `docker-compose.yml`, then run migrations once with `docker compose run --rm migrate`.

---

## Production readiness notes (read before real patient data)

- **PHI encryption uses one deployment-wide key** (`TENANT_ENCRYPTION_KEY`).
  This is the minimum bar. For a HIPAA Business Associate Agreement and true
  multi-tenant isolation, migrate to per-tenant keys via AWS KMS / Vault —
  the plumbing exists in `src/lib/key-management.js` (`ENCRYPTION_KEY_STRATEGY`).
- **HTTPS is required** for a healthcare app. Terminate TLS at a reverse proxy
  in front of the container; the app already sends HSTS + a strict CSP.
- **Test suite is currently partially red** (mostly React component tests). The
  production build is clean, but treat the suite as not-yet-certifying until
  triaged.
- The `script-src` CSP relaxes (`unsafe-inline`/`unsafe-eval`) only in
  development; production uses the strict policy automatically.
