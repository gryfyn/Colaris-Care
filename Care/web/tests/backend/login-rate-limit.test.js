jest.mock('@/lib/db.js', () => ({
  query: jest.fn(),
  withRequestContext: jest.fn(async (_payload, _label, run) => run({
    query: jest.fn(async () => ({ rows: [{ theme: 'spruce' }] })),
  })),
}));
jest.mock('@/lib/passwords.js', () => ({ verifyPassword: jest.fn() }));
jest.mock('@/lib/jwt.js', () => ({
  signAccessToken: jest.fn(),
  signRefreshToken: jest.fn(),
}));
jest.mock('@/lib/auth-cookies.js', () => ({
  setPortalCookie: jest.fn(),
  setRefreshCookie: jest.fn(),
  setThemeCookie: jest.fn(),
}));
jest.mock('@/lib/session-tracking.js', () => ({
  recordLoginSession: jest.fn(),
  logAuthEvent: jest.fn(),
  requestContext: jest.fn(() => ({ ip: '203.0.113.10', userAgent: 'Jest' })),
}));
jest.mock('@/lib/redis.js', () => ({ getRedis: jest.fn() }));
jest.mock('@/lib/logger.js', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn() },
}));

import { setPortalCookie, setRefreshCookie, setThemeCookie } from '@/lib/auth-cookies.js';
import { query } from '@/lib/db.js';
import { signAccessToken, signRefreshToken } from '@/lib/jwt.js';
import { verifyPassword } from '@/lib/passwords.js';
import { getRedis } from '@/lib/redis.js';
import { logAuthEvent, recordLoginSession } from '@/lib/session-tracking.js';
import { POST } from '@/app/api/auth/login/route.js';
import { globalRateLimiter, resetRateLimit } from '@/lib/rate-limiter.js';

const identity = {
  user_id: 'user-1',
  organization_id: 'org-1',
  facility_id: 'facility-1',
  staff_profile_id: 'staff-1',
  email: 'nurse@example.com',
  display_name: 'Nurse Example',
  role: 'staff',
  password_hash: 'stored-hash',
};

function loginRequest(ip = '203.0.113.10') {
  return {
    headers: new Headers({
      'x-forwarded-for': ip,
      'user-agent': 'Jest',
    }),
    json: jest.fn().mockResolvedValue({
      email: 'nurse@example.com',
      password: 'password',
    }),
  };
}

describe('login rate limit', () => {
  beforeEach(() => {
    delete process.env.AUTH_RATE_LIMIT_MAX;
    getRedis.mockReturnValue(null);
    query.mockResolvedValue({ rows: [identity] });
    verifyPassword.mockReturnValue(false);
    signAccessToken.mockReturnValue('access-token');
    signRefreshToken.mockReturnValue({ token: 'refresh-token' });
    setRefreshCookie.mockImplementation(() => {});
    setPortalCookie.mockResolvedValue(undefined);
    recordLoginSession.mockResolvedValue(undefined);
    logAuthEvent.mockResolvedValue(undefined);
    globalRateLimiter.reset('auth:login:203.0.113.10');
    globalRateLimiter.reset('auth:login:203.0.113.20');
  });

  afterAll(() => {
    globalRateLimiter.destroy();
  });

  test('allows 25 failed attempts from one IP and rejects the 26th', async () => {
    for (let attempt = 1; attempt <= 25; attempt += 1) {
      const response = await POST(loginRequest());
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: 'Invalid credentials' });
    }

    const rejected = await POST(loginRequest());
    expect(rejected.status).toBe(429);
    expect(await rejected.json()).toEqual({
      error: 'Too many requests',
      message: expect.stringMatching(/^Rate limit exceeded\. Retry after \d+ seconds\.$/),
    });
    expect(rejected.headers.get('Retry-After')).toEqual(expect.stringMatching(/^\d+$/));
    expect(rejected.headers.get('X-RateLimit-Remaining')).toBe('0');
  });

  test('successful login resets the counter before later failures', async () => {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await POST(loginRequest('203.0.113.20'));
      expect(response.status).toBe(401);
    }

    verifyPassword.mockReturnValueOnce(true);
    const successful = await POST(loginRequest('203.0.113.20'));
    expect(successful.status).toBe(200);
    expect(setThemeCookie).toHaveBeenCalledWith(successful, 'spruce');

    verifyPassword.mockReturnValue(false);
    for (let attempt = 1; attempt <= 25; attempt += 1) {
      const response = await POST(loginRequest('203.0.113.20'));
      expect(response.status).toBe(401);
    }

    const rejected = await POST(loginRequest('203.0.113.20'));
    expect(rejected.status).toBe(429);
  });

  test('resetRateLimit does not throw when Redis deletion fails', async () => {
    getRedis.mockReturnValue({ del: jest.fn().mockRejectedValue(new Error('redis unavailable')) });

    await expect(resetRateLimit('auth:login:203.0.113.30')).resolves.toBeUndefined();
  });
});
