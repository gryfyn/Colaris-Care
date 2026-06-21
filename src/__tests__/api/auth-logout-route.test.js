import { POST } from '@/app/api/v1/auth/logout/route.js';
import { authenticate } from '@/lib/auth-guard.js';
import { deleteRefreshToken } from '@/lib/token-store.js';

jest.mock('@/lib/auth-guard.js', () => ({
  authenticate: jest.fn(),
  getRequestContext: jest.fn(() => ({ user: {} })),
}));

jest.mock('@/lib/audit-logger.js', () => ({
  AuditLogger: jest.fn().mockImplementation(() => ({
    logLogout: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@/lib/token-store.js', () => ({
  deleteRefreshToken: jest.fn().mockResolvedValue(undefined),
  blacklistJti: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/jwt.js', () => ({
  verifyToken: jest.fn(),
}));

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body, init = {}) => {
      const headers = new Headers(init.headers);
      return {
        status: init.status || 200,
        headers,
        cookies: {
          delete: jest.fn(),
        },
        json: async () => body,
      };
    }),
  },
}));

function logoutRequest(refreshToken = 'refresh-token') {
  return {
    cookies: {
      get: jest.fn((name) => (name === 'refresh_token' ? { value: refreshToken } : undefined)),
    },
    headers: {
      get: jest.fn(() => null),
    },
  };
}

describe('POST /api/v1/auth/logout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns auth failure and clears refresh cookie when access token is invalid', async () => {
    authenticate.mockResolvedValueOnce({ error: 'Missing or malformed Authorization header', status: 401 });

    const response = await POST(logoutRequest());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Missing or malformed Authorization header' });
    expect(response.headers.get('Set-Cookie')).toContain('refresh_token=');
    expect(response.headers.get('Set-Cookie')).toContain('Max-Age=0');
    expect(deleteRefreshToken).not.toHaveBeenCalled();
  });
});
