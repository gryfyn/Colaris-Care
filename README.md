# Colaris Platform

A healthcare operating system. **One login, one database, modular suites.** Each
suite solves a different problem for a facility; customers license modules
individually (per-tenant entitlements).

```
COLARIS PLATFORM
├── Care        ✅ built      — "How are our residents doing?"   (resident/clinical)
├── Workforce   🔨 building   — "Right people, right place?"      (staff/scheduling)
├── Compliance  ⏳ later
├── Insights    ⏳ later
├── Billing     ⏳ later
└── AI          ⏳ later
```

## Monorepo layout

```
colaris-app/
├── shared/                     @colaris/shared — cross-suite foundation
│   └── src/
│       ├── db/      neon.js     Neon Postgres pool + withTenantClient (RLS)
│       ├── redis/   upstash.js  Upstash Redis (rate limit / cache / sessions)
│       ├── storage/ r2.js       Cloudflare R2 (S3-compatible object storage)
│       ├── email/   resend.js   Resend transactional email
│       ├── monitoring/ sentry.js Sentry init + capture helpers
│       ├── auth/    roles.js    Roles + permissions + module entitlements
│       └── config/  env.js      Central env access + validation
│
├── Care/
│   ├── web/                    @colaris/care-web — the existing Next.js 16 app
│   └── mobile/
│       ├── android/            Expo (React Native) — drives Android now, iOS later
│       └── ios/                Xcode placeholder (build on a Mac; see README)
│
└── Workforce/
    ├── web/                    @colaris/workforce-web — fresh Next.js 16 app
    └── mobile/
        ├── android/            Expo (React Native)
        └── ios/                Xcode placeholder
```

> The two web apps are separate Next.js deployments that **share one login and
> one Neon database** via `@colaris/shared`. Care keeps its own mature internal
> libs for now; new shared integrations live in `shared/` and Workforce builds on
> them. Care can migrate onto `shared/` incrementally (see `shared/README.md`).

## Tech stack (target — first ~10 facilities, ~$1.5k/yr)

| Concern     | Service          | Wired via                       |
|-------------|------------------|---------------------------------|
| Hosting     | Vercel           | Next.js apps                    |
| Database    | **Neon** Postgres| `shared/src/db/neon.js`         |
| Redis       | **Upstash**      | `shared/src/redis/upstash.js`   |
| Storage     | **Cloudflare R2**| `shared/src/storage/r2.js`      |
| Email       | **Resend**       | `shared/src/email/resend.js`    |
| Monitoring  | **Sentry**       | `shared/src/monitoring/sentry.js`|
| Mobile      | Expo / RN (Android), Xcode (iOS) | `*/mobile/*`     |

All integrations are scaffolded with **placeholder env vars** (`.env.example`).
Drop in real credentials to go live.

## Getting started

```bash
# 1. Install all workspace deps from the repo root
npm install

# 2. Configure env
cp .env.example .env                 # platform-wide reference
cp Care/web/.env.example Care/web/.env.local
cp Workforce/web/.env.example Workforce/web/.env.local
# → fill in Neon DATABASE_URL, Upstash, R2, Resend, Sentry keys

# 3. Run a suite (separate ports)
npm run care:dev          # Care      → http://localhost:3000
npm run workforce:dev     # Workforce → http://localhost:3001

# 4. Mobile (standalone Expo projects, not in npm workspaces)
cd Care/mobile/android && npm install && npm start
```

## Database

Single shared Neon Postgres. The schema, RLS policies, and migrations currently
live in `Care/web/db` and `Care/web/scripts/migrate-db.js`. Workforce adds a
`workforce.*` schema (migrations to be added). Every table carries `tenant_id`
and the standard RLS policy `tenant_id = care.current_tenant_id()`.

See `plans/` and the architecture blueprint for the full suite roadmap.
