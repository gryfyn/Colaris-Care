import { getRequestContext } from '@/lib/request-context.js';

function mockRequest(headers = {}) {
  return { headers: { get: (k) => (k in headers ? headers[k] : null) } };
}

describe('getRequestContext', () => {
  test('builds the user context from the authenticated user', () => {
    const ctx = getRequestContext(mockRequest(), {
      id: 'u1', staffId: 's1', tenantId: 't1', organizationId: 'o1', facilityId: 'f1', role: 'admin', jti: 'j1',
    });
    expect(ctx.user).toEqual({ id: 'u1', staffId: 's1', tenantId: 't1', organizationId: 'o1', facilityId: 'f1', role: 'admin', jti: 'j1' });
  });

  test('extracts request id and the first forwarded IP', () => {
    const ctx = getRequestContext(mockRequest({ 'x-request-id': 'req-9', 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }), {});
    expect(ctx.id).toBe('req-9');
    expect(ctx.ip).toBe('203.0.113.7');
  });

  test('defaults ip to "unknown" when no forwarded header', () => {
    expect(getRequestContext(mockRequest(), {}).ip).toBe('unknown');
  });
});
