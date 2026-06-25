# E2E Smoke Testing

Run after applying staged artifacts, migrations, seed data, and starting the dev or production server.

## Local

```powershell
npm.cmd run dev
npx playwright test tests/e2e/production-smoke.spec.js
```

## Environment Overrides

The smoke test defaults to seeded accounts:

- `admin@maplegrove.example` / `ChangeMeAdmin123!`
- `amara.koch@maplegrove.example` / `ChangeMeStaff123!`

Override with:

```powershell
$env:E2E_ADMIN_EMAIL="..."
$env:E2E_ADMIN_PASSWORD="..."
$env:E2E_STAFF_EMAIL="..."
$env:E2E_STAFF_PASSWORD="..."
```

## Coverage

- Signed-out admin redirect.
- Admin login and core admin page render.
- Staff login and core staff page render.
- Staff denied from admin workspace.

These smoke tests are not a replacement for route-level RBAC and RLS tests; they are deployment confidence checks.
