import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const required = [
  'src/lib/auth-guard.js',
  'src/lib/staff-access.js',
  'src/lib/client-api.js',
  'src/app/api/auth/login/route.js',
  'src/app/api/auth/refresh/route.js',
  'src/app/api/v1/health/route.js',
  'src/app/api/v1/ready/route.js',
  'src/app/api/v1/residents/route.js',
  'src/app/api/v1/audit-events/route.js',
  'src/app/admin/compliance/page.jsx',
  'db/migrations/0001_core_schema.sql',
  'db/migrations/0002_auth_identity_functions.sql',
  'scripts/migrate-db.mjs',
  'scripts/seed-db.mjs',
  'scripts/verify-production-config.mjs',
  'docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md',
  'docs/PRODUCTION_READINESS_STATUS.md',
];

const missing = required.filter((relative) => !fs.existsSync(path.join(root, relative)));

if (missing.length) {
  console.error('Missing staged files:');
  for (const file of missing) console.error(`- ${file}`);
  process.exit(1);
}

console.log('All staged production-readiness files are present.');
