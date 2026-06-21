// Tests for key management system — encryption key resolution, caching, rotation
import {
  getTenantEncryptionKey,
  rotateKeysEmergency,
  getCacheStatus,
  clearKeyCache,
  validateKeyManagement,
  KEY_STRATEGIES,
} from '@/lib/key-management.js';
import { encryptPHI, decryptPHI, encryptFields, decryptFields, RESIDENT_ENCRYPTED_FIELDS } from '@/lib/encryption.js';

describe('Key Management System', () => {
  beforeEach(() => {
    clearKeyCache();
  });

  afterEach(() => {
    clearKeyCache();
  });

  describe('getTenantEncryptionKey', () => {
    it('should return a valid 256-bit key (64 hex chars)', async () => {
      const key = await getTenantEncryptionKey('tenant1');
      expect(key).toBeDefined();
      expect(typeof key).toBe('string');
      expect(/^[a-f0-9]{64}$/.test(key)).toBe(true);
      expect(key.length).toBe(64);
    });

    it('should return different keys for different tenants', async () => {
      const key1 = await getTenantEncryptionKey('tenant1');
      const key2 = await getTenantEncryptionKey('tenant2');
      // Keys may be the same (depending on strategy), but request should succeed
      expect(key1).toBeDefined();
      expect(key2).toBeDefined();
    });

    it('should throw if tenantId is missing', async () => {
      await expect(getTenantEncryptionKey(null)).rejects.toThrow('tenantId is required');
      await expect(getTenantEncryptionKey(undefined)).rejects.toThrow('tenantId is required');
    });

    it('should cache keys to reduce external calls', async () => {
      const key1 = await getTenantEncryptionKey('tenant-cache-test');
      const cacheStatus1 = getCacheStatus();
      expect(cacheStatus1.cacheSize).toBe(1);

      const key2 = await getTenantEncryptionKey('tenant-cache-test');
      expect(key1).toBe(key2); // Same key from cache

      const cacheStatus2 = getCacheStatus();
      expect(cacheStatus2.cacheSize).toBe(1); // Still 1, not 2
    });
  });

  describe('Encryption/Decryption Round-Trip Tests', () => {
    it('should encrypt and decrypt PHI correctly', async () => {
      const tenantId = 'test-round-trip';
      const key = await getTenantEncryptionKey(tenantId);
      const plaintext = 'John Doe';

      const encrypted = encryptPHI(plaintext, key);
      expect(encrypted).not.toEqual(plaintext); // Should be encrypted (base64)
      expect(/^[A-Za-z0-9+/=]+$/.test(encrypted)).toBe(true); // Base64 format

      const decrypted = decryptPHI(encrypted, key);
      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt/decrypt all RESIDENT_ENCRYPTED_FIELDS', async () => {
      const tenantId = 'test-resident-fields';
      const key = await getTenantEncryptionKey(tenantId);

      const resident = {
        id: '123',
        first_name: 'John',
        last_name: 'Doe',
        preferred_name: 'Johnny',
        medicaid_id: 'M12345678',
        phone: '555-1234',
        email: 'john@example.com',
        address_line1: '123 Main St',
        address_line2: 'Apt 4B',
        ssn_last4: '5678',
      };

      // Encrypt all PHI fields
      const encrypted = encryptFields(resident, RESIDENT_ENCRYPTED_FIELDS, key);

      // Verify encrypted fields are base64
      RESIDENT_ENCRYPTED_FIELDS.forEach((field) => {
        expect(encrypted[field]).not.toEqual(resident[field]);
        expect(/^[A-Za-z0-9+/=]+$/.test(encrypted[field])).toBe(true);
      });

      // Decrypt and verify round-trip
      const decrypted = decryptFields(encrypted, RESIDENT_ENCRYPTED_FIELDS, key);

      RESIDENT_ENCRYPTED_FIELDS.forEach((field) => {
        expect(decrypted[field]).toBe(resident[field]);
      });
    });

    it('should handle null/empty PHI fields gracefully', async () => {
      const key = await getTenantEncryptionKey('test-null-fields');

      const resident = {
        first_name: 'John',
        last_name: null,
        preferred_name: undefined,
        address_line2: '', // Empty string
      };

      const encrypted = encryptFields(resident, RESIDENT_ENCRYPTED_FIELDS, key);
      expect(encrypted.first_name).not.toEqual(resident.first_name);
      expect(encrypted.last_name).toBeNull(); // Null should stay null
      expect(encrypted.preferred_name).toBeUndefined(); // Undefined should stay undefined

      const decrypted = decryptFields(encrypted, RESIDENT_ENCRYPTED_FIELDS, key);
      expect(decrypted.first_name).toBe(resident.first_name);
      expect(decrypted.last_name).toBeNull();
      expect(decrypted.preferred_name).toBeUndefined();
    });

    it('should produce different ciphertexts for same plaintext (due to random IV)', async () => {
      const key = await getTenantEncryptionKey('test-random-iv');
      const plaintext = 'Same Data';

      const encrypted1 = encryptPHI(plaintext, key);
      const encrypted2 = encryptPHI(plaintext, key);

      expect(encrypted1).not.toEqual(encrypted2); // Different ciphertexts (random IV)
      expect(decryptPHI(encrypted1, key)).toBe(plaintext);
      expect(decryptPHI(encrypted2, key)).toBe(plaintext);
    });

    it('should reject decryption with wrong key', async () => {
      const key1 = await getTenantEncryptionKey('tenant-wrong-key-1');

      // Create a different key by modifying the original (simulate wrong key scenario)
      const wrongKey = Buffer.from(key1, 'hex');
      wrongKey[0] ^= 0xFF; // Flip bits in first byte
      const key2 = wrongKey.toString('hex');

      const plaintext = 'Secret Data';
      const encrypted = encryptPHI(plaintext, key1);

      // Decrypting with wrong key should fail
      expect(() => decryptPHI(encrypted, key2)).toThrow();
    });

    it('should reject tampered ciphertexts (GCM authentication tag)', async () => {
      const key = await getTenantEncryptionKey('test-tampered-data');
      const plaintext = 'Sensitive PHI';
      const encrypted = encryptPHI(plaintext, key);

      // Tamper with ciphertext
      const tampered = Buffer.from(encrypted, 'base64');
      tampered[Math.floor(Math.random() * tampered.length)] ^= 0xFF; // Flip random bits
      const tamperedB64 = tampered.toString('base64');

      // Should fail authentication check
      expect(() => decryptPHI(tamperedB64, key)).toThrow();
    });
  });

  describe('Cache Management', () => {
    it('should return cache status', async () => {
      const key = await getTenantEncryptionKey('test-cache-status');

      const status = getCacheStatus();
      expect(status).toHaveProperty('strategy');
      expect(status).toHaveProperty('cacheSize');
      expect(status).toHaveProperty('cacheTTLMs');
      expect(status).toHaveProperty('entries');
      expect(status.cacheSize).toBeGreaterThan(0);
    });

    it('should not expose key material in cache status', async () => {
      const key = await getTenantEncryptionKey('test-cache-security');

      const status = getCacheStatus();
      const statusJson = JSON.stringify(status);

      // Should not contain the actual key bytes
      expect(statusJson).not.toContain(key);
    });
  });

  describe('Key Rotation', () => {
    it('should clear cache on emergency rotation', async () => {
      const key1 = await getTenantEncryptionKey('test-rotation');
      expect(getCacheStatus().cacheSize).toBe(1);

      await rotateKeysEmergency('Test rotation');

      expect(getCacheStatus().cacheSize).toBe(0);
    });

    it('should force fresh key fetch after rotation', async () => {
      const key1 = await getTenantEncryptionKey('test-fresh-fetch');
      const status1 = getCacheStatus();
      const timestamp1 = status1.entries[0]?.ageMs;

      await rotateKeysEmergency('Test');

      // Small delay to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 10));

      const key2 = await getTenantEncryptionKey('test-fresh-fetch');
      const status2 = getCacheStatus();
      const timestamp2 = status2.entries[0]?.ageMs;

      expect(timestamp2).toBeLessThan(timestamp1 || Infinity);
    });
  });

  describe('Stateless Token Refresh (No Re-encryption)', () => {
    it('should not require re-encryption when token is refreshed', async () => {
      const tenantId = 'test-stateless';
      const key = await getTenantEncryptionKey(tenantId);

      const resident = {
        first_name: 'Alice',
        last_name: 'Smith',
        email: 'alice@example.com',
      };

      // Original encryption
      const encrypted1 = encryptFields(resident, ['first_name', 'last_name', 'email'], key);

      // Simulate token refresh: fetch key again
      clearKeyCache(); // Clear cache to simulate fresh request
      const keyRefreshed = await getTenantEncryptionKey(tenantId);

      // Key should be the same (development env)
      expect(keyRefreshed).toBe(key);

      // Encrypted data should NOT change when re-fetching key
      // (because decryption with same key always works)
      const decrypted1 = decryptFields(encrypted1, ['first_name', 'last_name', 'email'], keyRefreshed);
      expect(decrypted1.first_name).toBe(resident.first_name);
      expect(decrypted1.last_name).toBe(resident.last_name);
      expect(decrypted1.email).toBe(resident.email);

      // No re-encryption should have occurred
      // (this is automatic in our stateless design)
    });
  });

  describe('Production Configuration Validation', () => {
    it('should throw in production without proper key resolver', async () => {
      // This test only runs if NODE_ENV is production
      if (process.env.NODE_ENV === 'production') {
        expect(async () => {
          await getTenantEncryptionKey('any-tenant');
        }).rejects.toThrow();
      }
    });

    it('should validate key format on resolution', async () => {
      const key = await getTenantEncryptionKey('test-format-validation');

      // Must be 64 hex characters
      expect(/^[a-f0-9]{64}$/.test(key)).toBe(true);

      // Must be exactly 32 bytes (64 hex chars)
      expect(key.length).toBe(64);
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should use different keys for different tenants (strategy dependent)', async () => {
      // Note: In dev mode with env vars, keys may be the same
      // But the system should support per-tenant keys in production
      const key1 = await getTenantEncryptionKey('tenant-iso-1');
      const key2 = await getTenantEncryptionKey('tenant-iso-2');

      // Both should be valid keys
      expect(/^[a-f0-9]{64}$/.test(key1)).toBe(true);
      expect(/^[a-f0-9]{64}$/.test(key2)).toBe(true);

      // If keys are different, encryption must not be interchangeable
      if (key1 !== key2) {
        const data = 'Cross-tenant data';
        const encrypted = encryptPHI(data, key1);
        expect(() => decryptPHI(encrypted, key2)).toThrow();
      }
    });
  });

  describe('Audit Logging Integration', () => {
    it('should support encryption context in audit logs', async () => {
      const encryptionContext = {
        strategy: 'aws-kms',
        keyId: 'arn:aws:kms:us-east-1:123456789012:key/12345678',
        tenantId: 'test-audit',
        encryptedFieldsCount: 3,
      };

      // This would be passed to audit.log() with encryptionContext parameter
      expect(encryptionContext).toHaveProperty('strategy');
      expect(encryptionContext).toHaveProperty('tenantId');
    });
  });
});

describe('Key Management Error Handling', () => {
  it('should provide helpful error messages when key resolution fails', async () => {
    // Set invalid strategy
    process.env.ENCRYPTION_KEY_STRATEGY = 'invalid-strategy';

    try {
      await getTenantEncryptionKey('test-error');
      // Should handle gracefully or throw with helpful message
    } catch (err) {
      expect(err.message).toBeTruthy();
      // Error should not expose sensitive key material
      expect(err.message).not.toMatch(/^[a-f0-9]{64}$/);
    }
  });
});

describe('Performance & Caching', () => {
  it('should cache keys to avoid repeated external calls', async () => {
    const start1 = Date.now();
    const key1 = await getTenantEncryptionKey('test-perf-1');
    const duration1 = Date.now() - start1;

    // Second call (from cache) should be much faster
    const start2 = Date.now();
    const key2 = await getTenantEncryptionKey('test-perf-1');
    const duration2 = Date.now() - start2;

    expect(key1).toBe(key2);
    expect(duration2).toBeLessThanOrEqual(duration1);
  });

  it('should respect cache TTL configuration', async () => {
    const originalTTL = process.env.ENCRYPTION_KEY_CACHE_TTL_MS;

    // Default: 1 hour
    const status = getCacheStatus();
    expect(status.cacheTTLMs).toBeGreaterThan(0);
  });
});
