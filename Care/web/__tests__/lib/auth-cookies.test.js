/**
 * @jest-environment node
 */
import {
  serializeRefreshCookie, serializeDeletedRefreshCookie,
  serializePortalCookie, serializeDeletedPortalCookie, REFRESH_COOKIE_PATH,
} from '@/lib/auth-cookies.js';

describe('auth cookie security attributes', () => {
  const OLD = process.env;
  afterEach(() => { process.env = OLD; });

  test('refresh cookie is HttpOnly, SameSite=Strict, path-scoped to /api/auth', () => {
    process.env = { ...OLD, NODE_ENV: 'test' };
    const c = serializeRefreshCookie('tok123', 3600);
    expect(c).toContain('refresh_token=tok123');
    expect(c).toContain('HttpOnly');
    expect(c).toContain('SameSite=Strict');
    expect(c).toContain(`Path=${REFRESH_COOKIE_PATH}`);
    expect(c).toContain('Max-Age=3600');
  });

  test('Secure flag is added only in production', () => {
    process.env = { ...OLD, NODE_ENV: 'development' };
    expect(serializeRefreshCookie('t', 1)).not.toContain('Secure');
    process.env = { ...OLD, NODE_ENV: 'production' };
    expect(serializeRefreshCookie('t', 1)).toContain('Secure');
  });

  test('deletion cookies expire immediately (Max-Age=0)', () => {
    process.env = { ...OLD, NODE_ENV: 'test' };
    expect(serializeDeletedRefreshCookie()).toContain('Max-Age=0');
    expect(serializeDeletedPortalCookie()).toContain('Max-Age=0');
  });

  test('portal cookie is signed, HttpOnly, SameSite=Strict, root-scoped', async () => {
    process.env = { ...OLD, NODE_ENV: 'test', COOKIE_SECRET: 'test-secret-at-least-16-characters' };
    const c = await serializePortalCookie({ userId: 'u1', role: 'admin', organizationId: 'o1', facilityId: 'f1' });
    expect(c).toContain('colaris_portal=');
    expect(c).toContain('HttpOnly');
    expect(c).toContain('SameSite=Strict');
    expect(c).toContain('Path=/');
    // The value is an HMAC-signed token (body.signature), not raw JSON.
    const value = c.split(';')[0].split('=')[1];
    expect(decodeURIComponent(value)).toContain('.');
  });
});
