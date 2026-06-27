/**
 * @jest-environment node
 */
import crypto from 'crypto';
import {
  buildAAD, encryptPHI, decryptPHI, lookupHashPHI,
  encryptFields, decryptFields,
} from '@/lib/encryption.js';

const keyA = crypto.randomBytes(32).toString('hex');
const keyB = crypto.randomBytes(32).toString('hex');
const aadA = buildAAD({ organizationId: 'orgA', facilityId: 'facA', table: 'residents', rowId: 'r1', field: 'ssn_last4' });
const aadB = buildAAD({ organizationId: 'orgB', facilityId: 'facB', table: 'residents', rowId: 'r1', field: 'ssn_last4' });

describe('PHI encryption (AES-256-GCM)', () => {
  test('round-trips plaintext with matching key + AAD', () => {
    const ct = encryptPHI('4821', keyA, aadA);
    expect(ct).toEqual(expect.any(String));
    expect(ct).not.toContain('4821');
    expect(decryptPHI(ct, keyA, aadA)).toBe('4821');
  });

  test('AAD binds ciphertext to its tenant — a different AAD cannot decrypt (no cross-tenant leak)', () => {
    const ct = encryptPHI('4821', keyA, aadA);
    expect(() => decryptPHI(ct, keyA, aadB)).toThrow('Decryption error');
  });

  test('a different key cannot decrypt', () => {
    const ct = encryptPHI('4821', keyA, aadA);
    expect(() => decryptPHI(ct, keyB, aadA)).toThrow('Decryption error');
  });

  test('tampered ciphertext is rejected by the GCM auth tag', () => {
    const ct = encryptPHI('4821', keyA, aadA);
    const buf = Buffer.from(ct, 'base64');
    buf[buf.length - 1] ^= 0xff; // flip a ciphertext byte
    expect(() => decryptPHI(buf.toString('base64'), keyA, aadA)).toThrow('Decryption error');
  });

  test('each encryption uses a fresh IV (ciphertext is non-deterministic)', () => {
    expect(encryptPHI('4821', keyA, aadA)).not.toBe(encryptPHI('4821', keyA, aadA));
  });

  test('empty input encrypts to null; missing key throws', () => {
    expect(encryptPHI('', keyA, aadA)).toBeNull();
    expect(encryptPHI(null, keyA, aadA)).toBeNull();
    expect(() => encryptPHI('4821', '', aadA)).toThrow(/encryption key/);
  });
});

describe('lookupHashPHI', () => {
  test('is deterministic for the same value/key/field', () => {
    expect(lookupHashPHI('4821', keyA, 'ssn_last4')).toBe(lookupHashPHI('4821', keyA, 'ssn_last4'));
  });

  test('is scoped by key, field, and value (no collisions across them)', () => {
    const base = lookupHashPHI('4821', keyA, 'ssn_last4');
    expect(lookupHashPHI('4821', keyB, 'ssn_last4')).not.toBe(base); // different tenant key
    expect(lookupHashPHI('4821', keyA, 'other_field')).not.toBe(base); // different field
    expect(lookupHashPHI('9999', keyA, 'ssn_last4')).not.toBe(base); // different value
  });

  test('returns null for empty input', () => {
    expect(lookupHashPHI('', keyA, 'ssn_last4')).toBeNull();
  });
});

describe('encryptFields / decryptFields', () => {
  test('round-trips selected fields with per-field AAD context', () => {
    const ctx = { organizationId: 'orgA', facilityId: 'facA', table: 'residents', rowId: 'r1' };
    const enc = encryptFields({ ssn_last4: '4821', name: 'plain' }, ['ssn_last4'], keyA, ctx);
    expect(enc.ssn_last4).not.toBe('4821');
    expect(enc.name).toBe('plain'); // untouched
    expect(decryptFields(enc, ['ssn_last4'], keyA, ctx).ssn_last4).toBe('4821');
  });
});
