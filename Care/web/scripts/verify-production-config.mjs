import { getDatabaseUrlWarnings, isNeonPoolerConnection, resolveDatabaseUrl } from './database-connection.mjs';

const required = [
  'DATABASE_URL',
  'COOKIE_SECRET',
  'TENANT_ENCRYPTION_KEY',
  'ALLOWED_ORIGINS',
];

const warnings = getDatabaseUrlWarnings();
const failures = [];

function present(name) {
  return process.env[name] && String(process.env[name]).trim().length > 0;
}

function minLength(name, length) {
  if (!present(name) || String(process.env[name]).length < length) {
    failures.push(`${name} must be set and at least ${length} characters`);
  }
}

for (const name of required) {
  if (!present(name)) failures.push(`${name} is required`);
}

minLength('COOKIE_SECRET', 32);
minLength('TENANT_ENCRYPTION_KEY', 32);

if (!present('JWT_PRIVATE_KEY_BASE64') || !present('JWT_PUBLIC_KEY_BASE64')) {
  if (!present('JWT_PRIVATE_KEY_PATH') || !present('JWT_PUBLIC_KEY_PATH')) {
    warnings.push('RS256 JWT keys are not fully configured; shared-secret fallback may be used');
    minLength('JWT_SECRET', 32);
  }
}

if (process.env.NODE_ENV !== 'production') {
  failures.push('NODE_ENV must be production');
}

if (process.env.DATABASE_SSL !== 'true') {
  warnings.push('DATABASE_SSL is not true; confirm private network database transport is approved');
}

if (process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'false') {
  warnings.push('DATABASE_SSL_REJECT_UNAUTHORIZED=false; use only with approved managed-provider certificate chain');
}

if (!present('ALLOWED_ORIGINS') || process.env.ALLOWED_ORIGINS.includes('localhost')) {
  failures.push('ALLOWED_ORIGINS must not include localhost in production');
}

if (process.env.COOKIE_SECRET === 'change-me-in-production') {
  failures.push('COOKIE_SECRET still has the placeholder value');
}

if (process.env.TENANT_ENCRYPTION_KEY === 'dev-only-32-char-key-change-me!!') {
  failures.push('TENANT_ENCRYPTION_KEY still has the development placeholder value');
}

if (isNeonPoolerConnection(resolveDatabaseUrl())) {
  if (!present('MIGRATION_DATABASE_URL')) {
    failures.push('MIGRATION_DATABASE_URL is required when DATABASE_URL uses the Neon pooler endpoint');
  }
  if (process.env.MIGRATION_DATABASE_URL && /pooler/i.test(process.env.MIGRATION_DATABASE_URL)) {
    warnings.push('MIGRATION_DATABASE_URL points to a Neon pooler endpoint; prefer the direct Neon URL for migrations');
  }
}

console.log('Production config verification');
console.log(`warnings: ${warnings.length}`);
for (const warning of warnings) console.log(`WARN ${warning}`);
console.log(`failures: ${failures.length}`);
for (const failure of failures) console.log(`FAIL ${failure}`);

if (failures.length) process.exit(1);
