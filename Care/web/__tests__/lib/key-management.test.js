/**
 * @jest-environment node
 */
import { getTenantEncryptionKey, getCacheStatus, clearKeyCache, KEY_STRATEGIES } from '@/lib/key-management.js';

const HEX64 = /^[a-f0-9]{64}$/;

describe('key-management', () => {
  const OLD = process.env;
  beforeEach(() => {
    process.env = { ...OLD, NODE_ENV: 'test', DEV_TENANT_ENCRYPTION_KEY: 'dev-master-secret-for-tests-32!!!' };
    clearKeyCache();
  });
  afterEach(() => { process.env = OLD; clearKeyCache(); });

  test('exposes the key strategy constants', () => {
    expect(KEY_STRATEGIES).toMatchObject({ AWS_KMS: 'aws-kms', VAULT: 'vault', LOCAL_FILE: 'local-file', ENV_VAR: 'env-var' });
  });

  test('requires a tenantId', async () => {
    await expect(getTenantEncryptionKey('')).rejects.toThrow(/tenantId/);
  });

  test('resolves a 64-hex key in dev via the env strategy', async () => {
    expect(await getTenantEncryptionKey('tenant-A')).toMatch(HEX64);
  });

  test('caches resolved keys', async () => {
    await getTenantEncryptionKey('tenant-cache');
    const status = getCacheStatus();
    expect(status.cacheSize).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(status.entries)).toBe(true);
    clearKeyCache();
    expect(getCacheStatus().cacheSize).toBe(0);
  });

  test('fails closed in production with the env strategy (no real KMS/Vault)', async () => {
    process.env = { ...OLD, NODE_ENV: 'production' };
    clearKeyCache();
    await expect(getTenantEncryptionKey('tenant-prod')).rejects.toThrow(/Encryption key unavailable/);
  });
});
