jest.mock('@/lib/auth-guard.js', () => ({
  AuthError: class AuthError extends Error {},
  authErrorResponse: jest.fn((err) => Response.json({ error: err.message }, { status: err.status || 500 })),
  requireUser: jest.fn(),
  maskPHI: (value) => value,
}));

jest.mock('@/lib/db.js', () => ({
  withRequestContext: jest.fn((user, action, fn) => fn({
    query: jest.fn().mockResolvedValue({
      rows: [{
        id: 'resident-1',
        first_name: 'Eleanor',
        last_name: 'Whitfield',
        date_of_birth: '1942-11-14',
        room: 'W-104',
        care_level: 'Assisted living',
        status: 'active',
        admitted_at: '2024-03-01',
        updated_at: '2026-06-25',
      }],
    }),
  })),
}));

import { requireUser } from '@/lib/auth-guard.js';
import { GET } from '@/app/api/v1/residents/route.js';

describe('/api/v1/residents', () => {
  test('returns mapped resident rows', async () => {
    requireUser.mockResolvedValue({
      id: 'user-1',
      organizationId: 'org-1',
      facilityId: 'fac-1',
      role: 'admin',
    });

    const response = await GET(new Request('http://localhost/api/v1/residents'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data[0].name).toBe('Eleanor Whitfield');
  });
});
