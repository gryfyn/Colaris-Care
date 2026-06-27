/**
 * @jest-environment node
 */
// Per-tenant PHI key derivation (HKDF-SHA256). These verify the isolation
// guarantee that keys differ per (organization, facility) scope and that
// production refuses a missing/weak master secret.
import { getTenantKey } from '@/lib/tenant-key.js';

const HEX64 = /^[a-f0-9]{64}$/;

describe('getTenantKey (dev/test master secret)', () => {
  const OLD = process.env;
  beforeEach(() => { process.env = { ...OLD, NODE_ENV: 'test', DEV_TENANT_ENCRYPTION_KEY: 'fixed-dev-master-secret-32-chars!!' }; });
  afterEach(() => { process.env = OLD; });

  test('returns a 64-char hex (AES-256) key', async () => {
    expect(await getTenantKey('orgA', 'facA')).toMatch(HEX64);
  });

  test('is deterministic for the same scope', async () => {
    expect(await getTenantKey('orgA', 'facA')).toBe(await getTenantKey('orgA', 'facA'));
  });

  test('derives a DIFFERENT key per tenant and per facility (isolation)', async () => {
    const a = await getTenantKey('orgA', 'facA');
    expect(await getTenantKey('orgB', 'facB')).not.toBe(a); // different org
    expect(await getTenantKey('orgA', 'facB')).not.toBe(a); // same org, different facility
    expect(await getTenantKey('orgA')).not.toBe(a);          // org-scoped vs facility-scoped
  });
});

describe('getTenantKey production hardening', () => {
  const OLD = process.env;
  afterEach(() => { process.env = OLD; });

  test('throws when the master secret is missing in production', async () => {
    process.env = { ...OLD, NODE_ENV: 'production', TENANT_ENCRYPTION_KEY: '' };
    await expect(getTenantKey('orgA', 'facA')).rejects.toThrow(/TENANT_ENCRYPTION_KEY/);
  });

  test('throws when the master secret is too weak (< 32 chars)', async () => {
    process.env = { ...OLD, NODE_ENV: 'production', TENANT_ENCRYPTION_KEY: 'short' };
    await expect(getTenantKey('orgA', 'facA')).rejects.toThrow();
  });

  test('accepts a strong secret in production', async () => {
    process.env = { ...OLD, NODE_ENV: 'production', TENANT_ENCRYPTION_KEY: 'a'.repeat(48) };
    expect(await getTenantKey('orgA', 'facA')).toMatch(HEX64);
  });
});
