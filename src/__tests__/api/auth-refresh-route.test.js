import { POST } from '@/app/api/v1/auth/refresh/route.js';
import { getRefreshToken, graceRefreshToken, storeRefreshToken } from '@/lib/token-store.js';
import { signAccessToken, signRefreshToken, verifyToken } from '@/lib/jwt.js';

jest.mock('@/lib/token-store.js', () => ({
  getRefreshToken: jest.fn(),
  graceRefreshToken: jest.fn(),
  storeRefreshToken: jest.fn(),
}));

jest.mock('@/lib/jwt.js', () => ({
  signAccessToken: jest.fn(),
  signRefreshToken: jest.fn(),
  verifyToken: jest.fn(),
}));

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body, init) => {
      const response = Response.json(body, init);
      response.cookies = {
        set: jest.fn(),
        delete: jest.fn(),
      };
      return response;
    },
  },
}));

function refreshRequest(token = 'old-refresh-token') {
  return {
    cookies: {
      get: jest.fn((name) => (name === 'refresh_token' ? { value: token } : undefined)),
    },
  };
}

describe('POST /api/v1/auth/refresh', () => {
  let store;

  beforeEach(() => {
    jest.clearAllMocks();
    // Keyed by jti, mirroring auth.refresh_tokens rows.
    store = new Map([['old-jti', {
      userId: 'account-1',
      tenantId: 'tenant-1',
      role: 'admin',
      staffId: 'staff-1',
      residentId: null,
    }]]);

    getRefreshToken.mockImplementation(async (_userId, jti) => store.get(jti) || null);
    graceRefreshToken.mockImplementation(async (_userId, jti) => {
      // Grace keeps the row readable (shorter TTL) rather than deleting it.
      return undefined;
    });
    storeRefreshToken.mockImplementation(async ({ jti, userId, tenantId, role, staffId, residentId }) => {
      store.set(jti, { userId, tenantId, role, staffId, residentId });
      return undefined;
    });

    verifyToken.mockReturnValue({
      sub: 'account-1',
      tenantId: 'tenant-1',
      jti: 'old-jti',
      type: 'refresh',
      role: 'admin',
      staffId: 'staff-1',
      residentId: null,
    });
    signAccessToken.mockReturnValue('new-access-token');
    signRefreshToken.mockReturnValue({ token: 'new-refresh-token', jti: 'new-jti' });
  });

  test('allows a duplicate refresh during the rotation grace window', async () => {
    const first = await POST(refreshRequest());
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ accessToken: 'new-access-token' });
    // Old token demoted to a grace window (still readable), new token persisted.
    expect(graceRefreshToken).toHaveBeenCalledWith('account-1', 'old-jti', expect.any(Number));
    expect(store.has('new-jti')).toBe(true);

    const duplicate = await POST(refreshRequest());
    expect(duplicate.status).toBe(200);
    expect(await duplicate.json()).toEqual({ accessToken: 'new-access-token' });
  });

  test('falls back to stateless refresh when the token store has no stored session', async () => {
    store.clear();

    const response = await POST(refreshRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ accessToken: 'new-access-token' });
  });

  test('returns 401 when refresh token is missing', async () => {
    const request = {
      cookies: {
        get: jest.fn(() => undefined),
      },
    };

    const response = await POST(request);
    expect(response.status).toBe(401);
  });
});
