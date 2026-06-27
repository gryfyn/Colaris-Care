/**
 * @jest-environment node
 */
// NODE_ENV is 'test' under jest, so jwt.js uses its symmetric test-mode key
// (production requires RS256 keys and is exercised separately). These tests
// verify the token contract: claims, type enforcement, and tamper rejection.
import { signAccessToken, signRefreshToken, verifyToken, decodeToken } from '@/lib/jwt.js';

const payload = { userId: 'u1', organizationId: 'o1', facilityId: 'f1', role: 'admin', staffId: null };

describe('jwt token lifecycle', () => {
  test('access token round-trips and carries the expected claims', () => {
    const token = signAccessToken(payload);
    const decoded = verifyToken(token, 'access');
    expect(decoded.sub).toBe('u1');
    expect(decoded.role).toBe('admin');
    expect(decoded.organizationId).toBe('o1');
    expect(decoded.type).toBe('access');
    expect(decoded.iss).toBe('colaris-care-api');
    expect(decoded.aud).toBe('colaris-care-client');
  });

  test('verifyToken enforces the token type (access vs refresh)', () => {
    const refresh = signRefreshToken(payload).token;
    expect(() => verifyToken(refresh, 'access')).toThrow();
    expect(verifyToken(refresh, 'refresh').type).toBe('refresh');
  });

  test('a tampered signature is rejected', () => {
    const token = signAccessToken(payload);
    const tampered = token.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A'));
    expect(() => verifyToken(tampered, 'access')).toThrow();
  });

  test('a garbage token is rejected', () => {
    expect(() => verifyToken('not.a.jwt', 'access')).toThrow();
  });

  test('decodeToken reads claims without verifying the signature', () => {
    const token = signAccessToken(payload);
    expect(decodeToken(token).sub).toBe('u1');
    // even a tampered token decodes (no verification) — by design, used at logout
    expect(decodeToken(token.replace(/.$/, 'A')).sub).toBe('u1');
  });
});
