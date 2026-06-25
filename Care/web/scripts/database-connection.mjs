import pg from 'pg';

function normalize(value) {
  if (!value) return null;
  const text = String(value).trim();
  return text || null;
}

function isNeonPoolerUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.includes('pooler') && host.includes('neon.tech');
  } catch {
    return false;
  }
}

export function resolveDatabaseUrl({ preferMigration = false } = {}) {
  const runtimeUrl = normalize(process.env.DATABASE_URL);
  const migrationUrl = normalize(process.env.MIGRATION_DATABASE_URL);
  const selected = preferMigration ? (migrationUrl || runtimeUrl) : runtimeUrl;

  if (!selected) {
    throw new Error(preferMigration
      ? 'DATABASE_URL or MIGRATION_DATABASE_URL is required'
      : 'DATABASE_URL is required');
  }

  return selected;
}

export function buildClient({ preferMigration = false } = {}) {
  const connectionString = resolveDatabaseUrl({ preferMigration });
  const sslEnabled = process.env.DATABASE_SSL === 'true';
  return new pg.Client({
    connectionString,
    ssl: sslEnabled
      ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' }
      : false,
  });
}

export function isNeonPoolerConnection(url = resolveDatabaseUrl()) {
  return isNeonPoolerUrl(url);
}

export function getDatabaseUrlWarnings() {
  const warnings = [];
  const runtimeUrl = normalize(process.env.DATABASE_URL);
  const migrationUrl = normalize(process.env.MIGRATION_DATABASE_URL);

  if (runtimeUrl && isNeonPoolerUrl(runtimeUrl) && !migrationUrl) {
    warnings.push('DATABASE_URL appears to be a Neon pooler endpoint, but MIGRATION_DATABASE_URL is not set');
  }

  if (migrationUrl && isNeonPoolerUrl(migrationUrl)) {
    warnings.push('MIGRATION_DATABASE_URL points to a Neon pooler endpoint; use the direct Neon URL for migrations if possible');
  }

  return warnings;
}
