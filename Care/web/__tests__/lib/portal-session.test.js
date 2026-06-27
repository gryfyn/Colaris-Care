/**
 * @jest-environment node
 */
import { signPortalSession, verifyPortalSession } from '@/lib/portal-session.js';

describe('portal-session', () => {
  const OLD_ENV = process.env;
  afterEach(() => { process.env = OLD_ENV; });

  test('signs and verifies a valid session round-trip', async () => {
    process.env = { ...OLD_ENV, NODE_ENV: 'test', COOKIE_SECRET: 'test-secret-at-least-16-characters' };
    const token = await signPortalSession({ userId: 'u1', role: 'admin', organizationId: 'o1', facilityId: 'f1', staffId: null });
    const session = await verifyPortalSession(token);
    expect(session).toBeTruthy();
    expect(session.role).toBe('admin');
    expect(session.sub).toBe('u1');
    expect(session.organizationId).toBe('o1');
  });

  test('rejects a forged token (signature mismatch)', async () => {
    process.env = { ...OLD_ENV, NODE_ENV: 'test', COOKIE_SECRET: 'test-secret-at-least-16-characters' };
    const token = await signPortalSession({ userId: 'u1', role: 'staff', organizationId: 'o1', facilityId: 'f1' });
    const signature = token.split('.')[1];
    // Re-sign-free tamper: swap the body to claim admin, keep the old signature.
    const forgedBody = Buffer.from(JSON.stringify({ sub: 'u1', role: 'admin', exp: Math.floor(Date.now() / 1000) + 600 }))
      .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    expect(await verifyPortalSession(`${forgedBody}.${signature}`)).toBeNull();
  });

  test('rejects an expired token', async () => {
    process.env = { ...OLD_ENV, NODE_ENV: 'test', COOKIE_SECRET: 'test-secret-at-least-16-characters' };
    const token = await signPortalSession({ userId: 'u1', role: 'admin', organizationId: 'o1', facilityId: 'f1' });
    jest.useFakeTimers().setSystemTime(Date.now() + 60 * 60 * 1000); // +1h (> 15m TTL)
    expect(await verifyPortalSession(token)).toBeNull();
    jest.useRealTimers();
  });

  test('production fails closed when no real secret is configured', async () => {
    process.env = { ...OLD_ENV, NODE_ENV: 'production', COOKIE_SECRET: '', JWT_SECRET: '', TENANT_ENCRYPTION_KEY: '' };
    await expect(signPortalSession({ userId: 'u', role: 'admin' })).rejects.toThrow(/COOKIE_SECRET/);
  });

  test('production rejects the public dev fallback secret', async () => {
    process.env = { ...OLD_ENV, NODE_ENV: 'production', COOKIE_SECRET: 'dev-cookie-secret-change-in-production' };
    await expect(signPortalSession({ userId: 'u', role: 'admin' })).rejects.toThrow();
  });
});
