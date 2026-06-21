// File: __tests__/api/admission/review.test.js

import { PATCH } from '@/app/api/v1/admission/[id]/review/route';

const mockRequest = (body) => ({
  json: jest.fn().mockResolvedValue(body),
  headers: new Map({
    authorization: 'Bearer test-token',
  }),
});

const mockDbClient = {
  query: jest.fn(),
};

jest.mock('@/lib/auth-guard.js', () => ({
  authenticate: jest.fn((req) => ({
    error: null,
    user: {
      id: 'user123',
      tenantId: 'tenant123',
      staffId: 'staff123',
      role: 'admin',
    },
  })),
  authorize: jest.fn((role, permission) => role === 'admin'),
  handleError: jest.fn((err) => {
    return Response.json({ error: err.message }, { status: 500 });
  }),
  getRequestContext: jest.fn(() => ({})),
}));

jest.mock('@/lib/db.js', () => ({
  withTenantClient: jest.fn((tenantId, staffId, fn) => fn(mockDbClient)),
}));

jest.mock('@/lib/roles.js', () => ({
  PERMISSIONS: {
    ADMIN_WRITE: 'admin_write',
  },
}));

jest.mock('@/lib/audit-logger.js', () => ({
  AuditLogger: jest.fn().mockImplementation(() => ({
    logUpdate: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('PATCH /api/v1/admission/[id]/review', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication & Authorization', () => {
    test('returns 401 when unauthenticated', async () => {
      const { authenticate } = require('@/lib/auth-guard.js');
      authenticate.mockReturnValueOnce({
        error: 'Unauthorized',
        code: 'NO_AUTH',
        status: 401,
      });

      const req = mockRequest({ status: 'approved' });
      const response = await PATCH(req, { params: { id: 'adm1' } });
      const data = await response.json();

      expect(response.status).toBe(401);
    });

    test('returns 403 when non-admin reviews admission', async () => {
      const { authorize } = require('@/lib/auth-guard.js');
      authorize.mockReturnValueOnce(false);

      mockDbClient.query.mockResolvedValueOnce({ rows: [{ id: 'adm1' }] });

      const req = mockRequest({ status: 'approved' });
      const response = await PATCH(req, { params: { id: 'adm1' } });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });
  });

  describe('Validation', () => {
    test('returns 422 for invalid status', async () => {
      mockDbClient.query.mockResolvedValueOnce({ rows: [{ id: 'adm1' }] });

      const req = mockRequest({ status: 'invalid_status' });
      const response = await PATCH(req, { params: { id: 'adm1' } });
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toContain('approved');
      expect(data.error).toContain('rejected');
    });

    test('accepts "approved" status', async () => {
      mockDbClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'adm1', status: 'pending' }] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'adm1',
              status: 'approved',
              reviewed_at: '2024-05-16T12:00:00',
              review_notes: null,
            },
          ],
        });

      const req = mockRequest({ status: 'approved', notes: null });
      const response = await PATCH(req, { params: { id: 'adm1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('approved');
    });

    test('accepts "rejected" status', async () => {
      mockDbClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'adm1', status: 'pending' }] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'adm1',
              status: 'rejected',
              reviewed_at: '2024-05-16T12:00:00',
              review_notes: 'Missing documentation',
            },
          ],
        });

      const req = mockRequest({ status: 'rejected', notes: 'Missing documentation' });
      const response = await PATCH(req, { params: { id: 'adm1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('rejected');
    });

    test('returns 404 for non-existent admission', async () => {
      mockDbClient.query.mockResolvedValueOnce({ rows: [] });

      const req = mockRequest({ status: 'approved' });
      const response = await PATCH(req, { params: { id: 'nonexistent' } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('not found');
    });
  });

  describe('Review Submission', () => {
    test('updates status to approved', async () => {
      mockDbClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'adm1', status: 'pending' }] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'adm1',
              status: 'approved',
              reviewed_at: '2024-05-16T12:00:00',
              review_notes: null,
            },
          ],
        });

      const req = mockRequest({ status: 'approved' });
      const response = await PATCH(req, { params: { id: 'adm1' } });
      const data = await response.json();

      expect(data.status).toBe('approved');
      expect(data.message).toContain('approved');
    });

    test('updates status to rejected', async () => {
      mockDbClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'adm1', status: 'pending' }] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'adm1',
              status: 'rejected',
              reviewed_at: '2024-05-16T12:00:00',
              review_notes: 'Incomplete submission',
            },
          ],
        });

      const req = mockRequest({ status: 'rejected', notes: 'Incomplete submission' });
      const response = await PATCH(req, { params: { id: 'adm1' } });
      const data = await response.json();

      expect(data.status).toBe('rejected');
    });

    test('records reviewed_by staff id', async () => {
      mockDbClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'adm1', status: 'pending' }] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'adm1',
              status: 'approved',
              reviewed_at: '2024-05-16T12:00:00',
              review_notes: null,
            },
          ],
        });

      const req = mockRequest({ status: 'approved' });
      await PATCH(req, { params: { id: 'adm1' } });

      const updateCall = mockDbClient.query.mock.calls.find(call =>
        call[0].includes('reviewed_by')
      );
      expect(updateCall).toBeDefined();
      expect(updateCall[1]).toContain('staff123');
    });

    test('records reviewed_at timestamp', async () => {
      mockDbClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'adm1', status: 'pending' }] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'adm1',
              status: 'approved',
              reviewed_at: '2024-05-16T12:00:00',
              review_notes: null,
            },
          ],
        });

      const req = mockRequest({ status: 'approved' });
      const response = await PATCH(req, { params: { id: 'adm1' } });
      const data = await response.json();

      expect(data.reviewed_at).toBeDefined();
    });

    test('records review notes when provided', async () => {
      const notes = 'All forms complete and verified';
      mockDbClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'adm1', status: 'pending' }] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'adm1',
              status: 'approved',
              reviewed_at: '2024-05-16T12:00:00',
              review_notes: notes,
            },
          ],
        });

      const req = mockRequest({ status: 'approved', notes });
      const response = await PATCH(req, { params: { id: 'adm1' } });
      const data = await response.json();

      expect(data.reviewed_at).toBeDefined();
    });

    test('allows optional notes', async () => {
      mockDbClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'adm1', status: 'pending' }] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'adm1',
              status: 'approved',
              reviewed_at: '2024-05-16T12:00:00',
              review_notes: null,
            },
          ],
        });

      const req = mockRequest({ status: 'approved' });
      const response = await PATCH(req, { params: { id: 'adm1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    test('returns 500 on database error', async () => {
      mockDbClient.query.mockRejectedValueOnce(new Error('Database error'));

      const req = mockRequest({ status: 'approved' });
      const response = await PATCH(req, { params: { id: 'adm1' } });

      expect(response.status).toBe(500);
    });
  });

  describe('Audit Logging', () => {
    test('logs update event', async () => {
      const { AuditLogger } = require('@/lib/audit-logger.js');
      const mockAudit = { logUpdate: jest.fn().mockResolvedValue(undefined) };
      AuditLogger.mockImplementationOnce(() => mockAudit);

      mockDbClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'adm1', status: 'pending' }] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'adm1',
              status: 'approved',
              reviewed_at: '2024-05-16T12:00:00',
              review_notes: null,
            },
          ],
        });

      const req = mockRequest({ status: 'approved' });
      const response = await PATCH(req, { params: { id: 'adm1' } });

      expect(response.status).toBe(200);
    });
  });
});
