jest.mock('@/lib/db.js', () => ({
  query: jest.fn(),
}));

jest.mock('@/lib/jwt.js', () => ({
  signAccessToken: jest.fn(() => 'access-token'),
  signRefreshToken: jest.fn(() => ({ token: 'refresh-token', jti: 'refresh-jti' })),
}));

jest.mock('@/lib/passwords.js', () => ({
  verifyPassword: jest.fn(),
}));

jest.mock('@/lib/rate-limiter.js', () => ({
  checkRateLimit: jest.fn(() => ({ allowed: true })),
  getRateLimitResponse: jest.fn(),
}));

jest.mock('@/lib/auth-cookies.js', () => ({
  setRefreshCookie: jest.fn(),
  setPortalCookie: jest.fn(async () => {}),
}));

jest.mock('@/lib/logger.js', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

import { query } from '@/lib/db.js';
import { verifyPassword } from '@/lib/passwords.js';
import { POST } from '@/app/api/auth/login/route.js';

function request(body) {
  return new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/api/auth/login', () => {
  beforeEach(() => jest.clearAllMocks());

  test('rejects invalid credentials', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    verifyPassword.mockReturnValue(false);

    const response = await POST(request({ email: 'missing@example.com', password: 'bad' }));
    expect(response.status).toBe(401);
  });

  test('returns access token and user on valid login', async () => {
    query.mockResolvedValueOnce({
      rows: [{
        user_id: 'user-1',
        email: 'admin@example.com',
        display_name: 'Admin User',
        password_hash: 'hash',
        organization_id: 'org-1',
        facility_id: 'fac-1',
        role: 'admin',
        staff_profile_id: 'staff-1',
      }],
    });
    verifyPassword.mockReturnValue(true);

    const response = await POST(request({ email: 'admin@example.com', password: 'secret' }));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.accessToken).toBe('access-token');
    expect(payload.user.role).toBe('admin');
  });
});
