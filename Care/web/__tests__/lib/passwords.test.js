import { hashPassword, verifyPassword } from '@/lib/passwords.js';

describe('password helpers', () => {
  test('verifies scrypt hashes', () => {
    const hash = hashPassword('CorrectHorseBatteryStaple!');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(verifyPassword('CorrectHorseBatteryStaple!', hash)).toBe(true);
    expect(verifyPassword('wrong-password', hash)).toBe(false);
  });

  test('supports seeded sha256 fallback hashes', () => {
    const hash = 'sha256$b13014929772f387b966be631b2aeb97f13692e0f5b37dba38a9b0fac6e1510c';
    expect(verifyPassword('ChangeMeAdmin123!', hash)).toBe(true);
    expect(verifyPassword('wrong-password', hash)).toBe(false);
  });
});
