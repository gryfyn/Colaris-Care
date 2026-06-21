import { POST } from '@/app/api/v1/auth/login/route.js';
import { query } from '@/lib/db.js';
import bcrypt from 'bcryptjs';
import { storeRefreshToken } from '@/lib/token-store.js';
import { signAccessToken, signRefreshToken } from '@/lib/jwt.js';
import { decryptFields } from '@/lib/encryption.js';

jest.mock('@/lib/db.js');
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
}));
jest.mock('@/lib/token-store.js', () => ({
  storeRefreshToken: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/jwt.js', () => ({
  signAccessToken: jest.fn(),
  signRefreshToken: jest.fn(),
}));
jest.mock('@/lib/encryption.js', () => ({
  decryptFields: jest.fn(),
}));
jest.mock('@/lib/tenant-key.js', () => ({
  getTenantKey: jest.fn().mockResolvedValue('a'.repeat(64)),
}));
jest.mock('@/lib/auth-guard.js', () => ({
  getRequestContext: jest.fn(() => ({ req: true })),
}));
jest.mock('@/lib/audit-logger.js', () => ({
  AuditLogger: jest.fn().mockImplementation(() => ({
    logLogin: jest.fn().mockResolvedValue(undefined),
  })),
}));
jest.mock('@/lib/auth-cookies.js', () => ({
  setRefreshCookie: jest.fn((response) => response),
}));
jest.mock('next/server', () => ({
  NextResponse: {
    json: (body, init) => {
      const response = Response.json(body, init);
      response.cookies = { set: jest.fn() };
      return response;
    },
  },
}));

describe('POST /api/v1/auth/login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns resident credentials without throwing on production decrypt path', async () => {
    query.mockResolvedValueOnce({
      rows: [{
        id: 'account-1',
        tenant_id: 'tenant-1',
        first_name: 'enc-first',
        last_name: 'enc-last',
        account_id: 'account-1',
        password_hash: '$2a$12$1',
        is_active: true,
        role: 'resident_care_of',
        failed_attempts: 0,
        locked_until: null,
        password_changed_required: true,
        staff_id: null,
        resident_id: 'resident-1',
      }],
    });
    bcrypt.compare.mockResolvedValueOnce(true);
    signAccessToken.mockReturnValue('access-token');
    signRefreshToken.mockReturnValue({ token: 'refresh-token', jti: 'jti-1' });
    decryptFields.mockReturnValueOnce({ first_name: 'Jane', last_name: 'Doe' });

    const request = new Request('http://localhost/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'resident@example.com',
        password: 'Password123!',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.accessToken).toBe('access-token');
    expect(body.user.firstName).toBe('Jane');
    expect(body.user.lastName).toBe('Doe');
    expect(body.user.passwordChangedRequired).toBe(true);
    expect(storeRefreshToken).toHaveBeenCalledWith(
      expect.objectContaining({
        jti: 'jti-1',
        userId: 'account-1',
        tenantId: 'tenant-1',
        ttlSeconds: 8 * 60 * 60,
      })
    );
  });

  test('returns 400 for malformed JSON request body', async () => {
    const request = new Request('http://localhost/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{bad json',
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid JSON request body' });
    expect(query).not.toHaveBeenCalled();
  });

  test('returns 422 for non-string credentials', async () => {
    const request = new Request('http://localhost/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 123, password: true }),
    });

    const response = await POST(request);
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({ error: 'email and password are required' });
    expect(query).not.toHaveBeenCalled();
  });
});
