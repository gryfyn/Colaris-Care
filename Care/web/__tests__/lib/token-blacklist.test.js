// Force the in-memory fallback path (no Upstash configured).
jest.mock('@/lib/redis.js', () => ({ getRedis: () => null, default: () => null }));

import { revokeToken, isTokenRevoked } from '@/lib/token-blacklist.js';

describe('token blacklist (in-memory fallback)', () => {
  test('an unknown jti is not revoked', async () => {
    expect(await isTokenRevoked('never-seen')).toBe(false);
  });

  test('a revoked jti reads back as revoked', async () => {
    const jti = `jti-${Date.now()}`;
    expect(await revokeToken(jti, Math.floor(Date.now() / 1000) + 3600)).toBe(true);
    expect(await isTokenRevoked(jti)).toBe(true);
  });

  test('null jti is handled safely', async () => {
    expect(await revokeToken(null)).toBe(false);
    expect(await isTokenRevoked(null)).toBe(false);
  });
});
