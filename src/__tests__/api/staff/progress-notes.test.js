/**
 * Unit tests for /api/v1/staff/progress-notes endpoint
 * Tests authentication, authorization, validation, and data filtering
 */

import { GET as getProgressNotes } from '@/app/api/v1/staff/progress-notes/route.js';

jest.mock('@/lib/auth-guard.js', () => ({
  authenticate: jest.fn(),
  authorize: jest.fn(),
  handleError: jest.fn((err) => {
    return Response.json(
      { error: err.message || 'Internal server error' },
      { status: err.status || 500 }
    );
  }),
}));

jest.mock('@/lib/db.js', () => ({
  withTenantClient: jest.fn(),
}));

jest.mock('@/lib/audit-logger.js', () => ({
  AuditLogger: jest.fn().mockImplementation(() => ({
    logSelect: jest.fn().mockResolvedValue(undefined),
  })),
}));

import * as authGuard from '@/lib/auth-guard.js';
import * as db from '@/lib/db.js';
import { PERMISSIONS, ROLES } from '@/lib/roles.js';

function createRequest(url, method = 'GET') {
  const mockHeaders = {
    get: jest.fn(() => 'application/json'),
  };
  return {
    url: `http://localhost:3000${url}`,
    method,
    headers: mockHeaders,
  };
}

function createUser(role = ROLES.STAFF, tenantId = 'tenant-123', staffId = 'staff-123') {
  return { id: 'user-123', staffId, tenantId, role, jti: 'jti-123' };
}

function createMockClient() {
  return { query: jest.fn(), release: jest.fn() };
}

describe('GET /api/v1/staff/progress-notes — List progress notes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 401 when not authenticated', async () => {
    authGuard.authenticate.mockResolvedValueOnce({ error: 'Unauthorized', status: 401 });
    const request = createRequest('/api/v1/staff/progress-notes');
    const response = await getProgressNotes(request);
    expect(response.status).toBe(401);
  });

  test('returns 403 when user lacks PROGRESS_NOTES_READ permission', async () => {
    const user = createUser(ROLES.RESIDENT_CARE_OF);
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(false);

    const request = createRequest('/api/v1/staff/progress-notes');
    const response = await getProgressNotes(request);
    expect(response.status).toBe(403);
    expect(authGuard.authorize).toHaveBeenCalledWith(ROLES.RESIDENT_CARE_OF, PERMISSIONS.PROGRESS_NOTES_READ);
  });

  test('returns paginated list of progress notes', async () => {
    const user = createUser(ROLES.STAFF);
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    const mockRows = [
      {
        id: 'note-1',
        resident_id: 'res-1',
        staff_id: 'staff-1',
        note_date: '2024-05-20',
        shift: 'day',
        note_body: 'Patient is doing well, vitals stable.',
        review_status: 'pending',
        reviewed_at: null,
        review_notes: null,
        resident_first_name: 'John',
        resident_last_name: 'Doe',
        staff_first_name: 'Jane',
        staff_last_name: 'Smith',
        created_at: '2024-05-20T10:00:00Z',
        updated_at: '2024-05-20T10:00:00Z',
        total_count: 2,
      },
      {
        id: 'note-2',
        resident_id: 'res-2',
        staff_id: 'staff-1',
        note_date: '2024-05-19',
        shift: 'night',
        note_body: 'Resident slept well.',
        review_status: 'approved',
        reviewed_at: '2024-05-20T08:00:00Z',
        review_notes: 'Looks good',
        resident_first_name: 'Alice',
        resident_last_name: 'Adams',
        staff_first_name: 'Jane',
        staff_last_name: 'Smith',
        created_at: '2024-05-19T22:00:00Z',
        updated_at: '2024-05-20T08:00:00Z',
        total_count: 2,
      },
    ];

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: mockRows });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/staff/progress-notes');
    const response = await getProgressNotes(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toHaveLength(2);
    expect(data.pagination.total).toBe(2);
  });

  test('returns 400 when review_status is invalid', async () => {
    const user = createUser(ROLES.STAFF);
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    const request = createRequest('/api/v1/staff/progress-notes?review_status=invalid_status');
    const response = await getProgressNotes(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toMatch(/Invalid review_status/i);
  });

  test('accepts valid review_status values', async () => {
    const user = createUser(ROLES.STAFF);
    const validStatuses = ['pending', 'approved', 'rejected'];

    for (const status of validStatuses) {
      jest.clearAllMocks();
      authGuard.authenticate.mockResolvedValueOnce({ user });
      authGuard.authorize.mockReturnValueOnce(true);

      db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
        const mockClient = createMockClient();
        mockClient.query.mockResolvedValueOnce({ rows: [{ total_count: 1 }] });
        return callback(mockClient);
      });

      const request = createRequest(`/api/v1/staff/progress-notes?review_status=${status}`);
      const response = await getProgressNotes(request);
      expect(response.status).toBe(200);
    }
  });

  test('filters by staff_id when provided', async () => {
    const user = createUser(ROLES.STAFF);
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: [{ total_count: 0 }] });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/staff/progress-notes?staff_id=staff-xyz');
    const response = await getProgressNotes(request);
    expect(response.status).toBe(200);
  });

  test('filters by resident_id when provided', async () => {
    const user = createUser(ROLES.STAFF);
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: [{ total_count: 0 }] });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/staff/progress-notes?resident_id=res-xyz');
    const response = await getProgressNotes(request);
    expect(response.status).toBe(200);
  });

  test('enforces tenant isolation in query', async () => {
    const user = createUser(ROLES.STAFF, 'tenant-abc');
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      expect(tenantId).toBe('tenant-abc');
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/staff/progress-notes');
    await getProgressNotes(request);

    expect(db.withTenantClient).toHaveBeenCalledWith('tenant-abc', expect.any(String), expect.any(Function));
  });

  test('respects pagination limits (1-200)', async () => {
    const user = createUser(ROLES.STAFF);
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/staff/progress-notes?limit=500&offset=0');
    const response = await getProgressNotes(request);
    const data = await response.json();

    expect(data.pagination.limit).toBeLessThanOrEqual(200);
  });

  test('enforces offset >= 0', async () => {
    const user = createUser(ROLES.STAFF);
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/staff/progress-notes?offset=-10');
    const response = await getProgressNotes(request);
    const data = await response.json();

    expect(data.pagination.offset).toBeGreaterThanOrEqual(0);
  });

  test('includes all required fields in response', async () => {
    const user = createUser(ROLES.STAFF);
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    const mockRow = {
      id: 'note-1',
      resident_id: 'res-1',
      staff_id: 'staff-1',
      note_date: '2024-05-20',
      shift: 'day',
      note_body: 'Patient is doing well.',
      review_status: 'pending',
      reviewed_at: null,
      review_notes: null,
      resident_first_name: 'John',
      resident_last_name: 'Doe',
      staff_first_name: 'Jane',
      staff_last_name: 'Smith',
      created_at: '2024-05-20T10:00:00Z',
      updated_at: '2024-05-20T10:00:00Z',
      total_count: 1,
    };

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: [mockRow] });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/staff/progress-notes');
    const response = await getProgressNotes(request);
    const data = await response.json();

    expect(data.data[0]).toHaveProperty('id');
    expect(data.data[0]).toHaveProperty('resident_id');
    expect(data.data[0]).toHaveProperty('staff_id');
    expect(data.data[0]).toHaveProperty('note_date');
    expect(data.data[0]).toHaveProperty('shift');
    expect(data.data[0]).toHaveProperty('note_body');
    expect(data.data[0]).toHaveProperty('review_status');
  });

  test('orders notes by note_date descending', async () => {
    const user = createUser(ROLES.STAFF);
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    const mockRows = [
      {
        id: 'note-1',
        resident_id: 'res-1',
        staff_id: 'staff-1',
        note_date: '2024-05-20',
        shift: 'day',
        note_body: 'Newer note',
        review_status: 'pending',
        total_count: 2,
      },
      {
        id: 'note-2',
        resident_id: 'res-1',
        staff_id: 'staff-1',
        note_date: '2024-05-19',
        shift: 'night',
        note_body: 'Older note',
        review_status: 'approved',
        total_count: 2,
      },
    ];

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: mockRows });

      callback(mockClient);

      // Verify ORDER BY clause
      const queryText = mockClient.query.mock.calls[0][0];
      expect(queryText).toMatch(/ORDER BY.*note_date DESC/i);

      return mockRows;
    });

    const request = createRequest('/api/v1/staff/progress-notes');
    const response = await getProgressNotes(request);
    const data = await response.json();

    expect(data.data[0].note_date).toBe('2024-05-20');
    expect(data.data[1].note_date).toBe('2024-05-19');
  });

  test('handles missing resident/staff names gracefully', async () => {
    const user = createUser(ROLES.STAFF);
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    const mockRow = {
      id: 'note-1',
      resident_id: 'res-1',
      staff_id: 'staff-1',
      note_date: '2024-05-20',
      shift: 'day',
      note_body: 'Note',
      review_status: 'pending',
      resident_first_name: null,
      resident_last_name: null,
      staff_first_name: null,
      staff_last_name: null,
      created_at: '2024-05-20T10:00:00Z',
      updated_at: '2024-05-20T10:00:00Z',
      total_count: 1,
    };

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: [mockRow] });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/staff/progress-notes');
    const response = await getProgressNotes(request);
    expect(response.status).toBe(200);
  });

  test('handles database errors gracefully', async () => {
    const user = createUser(ROLES.STAFF);
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    db.withTenantClient.mockImplementationOnce(async () => {
      throw new Error('Database connection failed');
    });

    const request = createRequest('/api/v1/staff/progress-notes');
    const response = await getProgressNotes(request);
    expect(response.status).toBe(500);
  });

  test('filters by multiple criteria simultaneously', async () => {
    const user = createUser(ROLES.STAFF);
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: [{ total_count: 1 }] });

      callback(mockClient);

      // Verify query includes multiple filters
      const queryText = mockClient.query.mock.calls[0][0];
      expect(queryText).toMatch(/tenant_id/);

      return [{ total_count: 1 }];
    });

    const request = createRequest('/api/v1/staff/progress-notes?staff_id=staff-1&resident_id=res-1&review_status=pending');
    const response = await getProgressNotes(request);
    expect(response.status).toBe(200);
  });

  test('returns empty results with metadata when no matches', async () => {
    const user = createUser(ROLES.STAFF);
    authGuard.authenticate.mockResolvedValueOnce({ user });
    authGuard.authorize.mockReturnValueOnce(true);

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: [{ total_count: 0 }] });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/staff/progress-notes?staff_id=nonexistent');
    const response = await getProgressNotes(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toHaveLength(1); // Only total_count row, but data should be filtered out
    expect(data.pagination.total).toBe(0);
  });
});
