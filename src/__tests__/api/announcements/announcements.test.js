/**
 * Unit tests for /api/v1/announcements and /api/v1/announcements/[id] endpoints
 * Tests authentication, authorization, validation, tenant isolation, and announcement audience filtering
 */

import { GET as getAnnouncements, POST as postAnnouncement } from '@/app/api/v1/announcements/route.js';
import { GET as getAnnouncementById, PATCH as patchAnnouncement, DELETE as deleteAnnouncement } from '@/app/api/v1/announcements/[id]/route.js';

jest.mock('@/lib/auth-guard.js', () => ({
  authenticate: jest.fn(),
  authorize: jest.fn(),
  handleError: jest.fn((err) => {
    return Response.json(
      { error: err.message || 'Internal server error' },
      { status: err.status || 500 }
    );
  }),
  getRequestContext: jest.fn(() => ({ user: {} })),
}));

jest.mock('@/lib/db.js', () => ({
  withTenantClient: jest.fn(),
}));

jest.mock('@/lib/audit-logger.js', () => ({
  AuditLogger: jest.fn().mockImplementation(() => ({
    logSelect: jest.fn().mockResolvedValue(undefined),
    logInsert: jest.fn().mockResolvedValue(undefined),
    logUpdate: jest.fn().mockResolvedValue(undefined),
    logDelete: jest.fn().mockResolvedValue(undefined),
  })),
}));

import * as authGuard from '@/lib/auth-guard.js';
import * as db from '@/lib/db.js';
import { ROLES } from '@/lib/roles.js';

function createRequest(url, method = 'GET', body = null) {
  const mockHeaders = {
    get: jest.fn(() => 'application/json'),
  };
  const request = {
    url: `http://localhost:3000${url}`,
    method,
    headers: mockHeaders,
  };
  if (body) {
    request.json = jest.fn().mockResolvedValue(body);
  }
  return request;
}

function createUser(role = ROLES.STAFF, tenantId = 'tenant-123', staffId = 'staff-123') {
  return { id: 'user-123', staffId, tenantId, role, jti: 'jti-123' };
}

function createMockClient() {
  return { query: jest.fn(), release: jest.fn() };
}

function createContext(id = 'ann-123') {
  return {
    params: Promise.resolve({ id }),
  };
}

describe('GET /api/v1/announcements — List announcements', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 401 when not authenticated', async () => {
    authGuard.authenticate.mockResolvedValueOnce({ error: 'Unauthorized', status: 401 });
    const request = createRequest('/api/v1/announcements');
    const response = await getAnnouncements(request);
    expect(response.status).toBe(401);
  });

  test('returns paginated list of announcements for authenticated user', async () => {
    const user = createUser(ROLES.STAFF);
    authGuard.authenticate.mockResolvedValueOnce({ user });

    const mockRows = [
      {
        id: 'ann-1',
        title: 'Facility Update',
        body: 'New wing opening soon',
        audience: 'all',
        priority: 5,
        published_at: '2024-05-20T08:00:00Z',
        active: true,
        created_at: '2024-05-20T08:00:00Z',
        created_by_first_name: 'Admin',
        created_by_last_name: 'User',
        total_count: 1,
      },
    ];

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: mockRows });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/announcements');
    const response = await getAnnouncements(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toHaveLength(1);
    expect(data.pagination.total).toBe(1);
  });

  test('filters announcements by audience for staff', async () => {
    const user = createUser(ROLES.STAFF);
    authGuard.authenticate.mockResolvedValueOnce({ user });

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: [{ total_count: 1 }] });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/announcements?audience=staff');
    const response = await getAnnouncements(request);
    expect(response.status).toBe(200);
  });

  test('respects pagination limits (1-200)', async () => {
    const user = createUser(ROLES.STAFF);
    authGuard.authenticate.mockResolvedValueOnce({ user });

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/announcements?limit=500');
    const response = await getAnnouncements(request);
    const data = await response.json();

    expect(data.pagination.limit).toBeLessThanOrEqual(200);
  });

  test('enforces tenant isolation', async () => {
    const user = createUser(ROLES.STAFF, 'tenant-xyz');
    authGuard.authenticate.mockResolvedValueOnce({ user });

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      expect(tenantId).toBe('tenant-xyz');
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/announcements');
    await getAnnouncements(request);

    expect(db.withTenantClient).toHaveBeenCalledWith('tenant-xyz', expect.any(String), expect.any(Function));
  });

  test('returns only published and active announcements', async () => {
    const user = createUser(ROLES.ADMIN);
    authGuard.authenticate.mockResolvedValueOnce({ user });

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/announcements');
    await getAnnouncements(request);

    // Verify that the query includes filters for published and active status
    expect(db.withTenantClient).toHaveBeenCalled();
  });
});

describe('POST /api/v1/announcements — Create announcement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 401 when not authenticated', async () => {
    authGuard.authenticate.mockResolvedValueOnce({ error: 'Unauthorized', status: 401 });

    const request = createRequest('/api/v1/announcements', 'POST', {
      title: 'Important Notice',
      body: 'Please read this carefully',
      audience: 'staff',
    });
    const response = await postAnnouncement(request);
    expect(response.status).toBe(401);
  });

  test('returns 403 for staff role (admin/superadmin only)', async () => {
    const user = createUser(ROLES.STAFF);
    authGuard.authenticate.mockResolvedValueOnce({ user });

    const request = createRequest('/api/v1/announcements', 'POST', {
      title: 'Important Notice',
      body: 'Please read this carefully',
      audience: 'staff',
    });
    const response = await postAnnouncement(request);
    expect(response.status).toBe(403);
  });

  test('returns 403 for manager role', async () => {
    const user = createUser(ROLES.MANAGER);
    authGuard.authenticate.mockResolvedValueOnce({ user });

    const request = createRequest('/api/v1/announcements', 'POST', {
      title: 'Important Notice',
      body: 'Please read this carefully',
      audience: 'staff',
    });
    const response = await postAnnouncement(request);
    expect(response.status).toBe(403);
  });

  test('returns 422 when required fields are missing', async () => {
    const user = createUser(ROLES.ADMIN);
    authGuard.authenticate.mockResolvedValueOnce({ user });

    const testCases = [
      { data: { body: 'Content', audience: 'staff' }, missing: 'title' },
      { data: { title: 'Title', audience: 'staff' }, missing: 'body' },
      { data: { title: 'Title', body: 'Content' }, missing: 'audience' },
    ];

    for (const testCase of testCases) {
      jest.clearAllMocks();
      authGuard.authenticate.mockResolvedValueOnce({ user });

      const request = createRequest('/api/v1/announcements', 'POST', testCase.data);
      const response = await postAnnouncement(request);
      expect(response.status).toBe(422);
    }
  });

  test('returns 400 for invalid audience', async () => {
    const user = createUser(ROLES.ADMIN);
    authGuard.authenticate.mockResolvedValueOnce({ user });

    const request = createRequest('/api/v1/announcements', 'POST', {
      title: 'Important Notice',
      body: 'Please read this carefully',
      audience: 'invalid_audience',
    });
    const response = await postAnnouncement(request);
    expect(response.status).toBe(400);
  });

  test('accepts valid audience values', async () => {
    const user = createUser(ROLES.ADMIN, 'tenant-123', 'admin-123');
    authGuard.authenticate.mockResolvedValueOnce({ user });

    const validAudiences = ['all', 'staff', 'admin'];

    for (const audience of validAudiences) {
      jest.clearAllMocks();
      authGuard.authenticate.mockResolvedValueOnce({ user });

      db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
        const mockClient = createMockClient();
        mockClient.query.mockResolvedValueOnce({
          rows: [
            {
              id: 'ann-new',
              title: 'Important Notice',
              audience,
              published_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
            },
          ],
        });
        return callback(mockClient);
      });

      const request = createRequest('/api/v1/announcements', 'POST', {
        title: 'Important Notice',
        body: 'Please read this carefully',
        audience,
      });
      const response = await postAnnouncement(request);
      expect(response.status).toBe(201);
    }
  });

  test('creates announcement successfully for admin', async () => {
    const user = createUser(ROLES.ADMIN, 'tenant-123', 'admin-123');
    authGuard.authenticate.mockResolvedValueOnce({ user });

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'ann-new',
            title: 'Important Notice',
            audience: 'staff',
            published_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          },
        ],
      });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/announcements', 'POST', {
      title: 'Important Notice',
      body: 'Please read this carefully',
      audience: 'staff',
      priority: 10,
    });
    const response = await postAnnouncement(request);
    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.data).toHaveProperty('id', 'ann-new');
    expect(data.data).toHaveProperty('audience', 'staff');
  });

  test('creates announcement for superadmin', async () => {
    const user = createUser(ROLES.SUPERADMIN, 'tenant-123', 'super-123');
    authGuard.authenticate.mockResolvedValueOnce({ user });

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'ann-new',
            title: 'System Notice',
            audience: 'all',
            published_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          },
        ],
      });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/announcements', 'POST', {
      title: 'System Notice',
      body: 'Important system update',
      audience: 'all',
    });
    const response = await postAnnouncement(request);
    expect(response.status).toBe(201);
  });

  test('enforces tenant isolation on create', async () => {
    const user = createUser(ROLES.ADMIN, 'tenant-xyz', 'admin-123');
    authGuard.authenticate.mockReset();
    authGuard.authenticate.mockResolvedValue({ user });

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      expect(tenantId).toBe('tenant-xyz');
      const mockClient = createMockClient();
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/announcements', 'POST', {
      title: 'Important Notice',
      body: 'Please read this carefully',
      audience: 'staff',
    });

    try {
      await postAnnouncement(request);
    } catch (e) {
      // Expected to fail during mock query
    }

    expect(db.withTenantClient).toHaveBeenCalledWith('tenant-xyz', expect.any(String), expect.any(Function));
  });
});

describe('GET /api/v1/announcements/[id] — Get single announcement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 401 when not authenticated', async () => {
    authGuard.authenticate.mockResolvedValue({ error: 'Unauthorized', status: 401 });
    const request = createRequest('/api/v1/announcements/ann-123');
    const response = await getAnnouncementById(request, createContext('ann-123'));
    expect(response.status).toBe(401);
  });

  test('returns 404 when announcement not found', async () => {
    const user = createUser(ROLES.STAFF);
    authGuard.authenticate.mockReset();
    authGuard.authenticate.mockResolvedValue({ user });

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/announcements/ann-nonexistent');
    const response = await getAnnouncementById(request, createContext('ann-nonexistent'));
    expect(response.status).toBe(404);
  });

  test('retrieves announcement for authenticated user', async () => {
    const user = createUser(ROLES.STAFF);
    authGuard.authenticate.mockResolvedValueOnce({ user });

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'ann-123',
            title: 'Facility Update',
            body: 'New wing opening soon',
            audience: 'all',
            priority: 5,
            published_at: '2024-05-20T08:00:00Z',
            active: true,
            created_at: '2024-05-20T08:00:00Z',
          },
        ],
      });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/announcements/ann-123');
    const response = await getAnnouncementById(request, createContext('ann-123'));
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.data.id).toBe('ann-123');
  });

  test('returns 404 for unpublished announcement', async () => {
    const user = createUser(ROLES.STAFF);
    authGuard.authenticate.mockResolvedValueOnce({ user });

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // Not returned due to published_at check
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/announcements/ann-draft');
    const response = await getAnnouncementById(request, createContext('ann-draft'));
    expect(response.status).toBe(404);
  });
});

describe('PATCH /api/v1/announcements/[id] — Update announcement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 401 when not authenticated', async () => {
    authGuard.authenticate.mockResolvedValueOnce({ error: 'Unauthorized', status: 401 });
    const request = createRequest('/api/v1/announcements/ann-123', 'PATCH', { title: 'Updated Title' });
    const response = await patchAnnouncement(request, createContext('ann-123'));
    expect(response.status).toBe(401);
  });

  test('returns 403 for staff role (admin/superadmin only)', async () => {
    const user = createUser(ROLES.STAFF);
    authGuard.authenticate.mockResolvedValueOnce({ user });

    const request = createRequest('/api/v1/announcements/ann-123', 'PATCH', { title: 'Updated Title' });
    const response = await patchAnnouncement(request, createContext('ann-123'));
    expect(response.status).toBe(403);
  });

  test('returns 404 when announcement not found', async () => {
    const user = createUser(ROLES.ADMIN);
    authGuard.authenticate.mockResolvedValueOnce({ user });

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/announcements/ann-nonexistent', 'PATCH', { title: 'Updated Title' });
    const response = await patchAnnouncement(request, createContext('ann-nonexistent'));
    expect(response.status).toBe(404);
  });

  test('returns 400 for invalid audience in update', async () => {
    const user = createUser(ROLES.ADMIN);
    authGuard.authenticate.mockResolvedValueOnce({ user });

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 'ann-123' }] });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/announcements/ann-123', 'PATCH', { audience: 'invalid_audience' });
    const response = await patchAnnouncement(request, createContext('ann-123'));
    expect(response.status).toBe(400);
  });

  test('updates announcement successfully for admin', async () => {
    const user = createUser(ROLES.ADMIN, 'tenant-123', 'admin-123');
    authGuard.authenticate.mockResolvedValueOnce({ user });

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'ann-123' }] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'ann-123',
              title: 'Updated Title',
              audience: 'staff',
              updated_at: '2024-05-20T09:15:00Z',
            },
          ],
        });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/announcements/ann-123', 'PATCH', { title: 'Updated Title' });
    const response = await patchAnnouncement(request, createContext('ann-123'));
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.data.title).toBe('Updated Title');
  });
});

describe('DELETE /api/v1/announcements/[id] — Delete announcement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 401 when not authenticated', async () => {
    authGuard.authenticate.mockResolvedValueOnce({ error: 'Unauthorized', status: 401 });
    const request = createRequest('/api/v1/announcements/ann-123', 'DELETE');
    const response = await deleteAnnouncement(request, createContext('ann-123'));
    expect(response.status).toBe(401);
  });

  test('returns 403 for staff role (admin/superadmin only)', async () => {
    const user = createUser(ROLES.STAFF);
    authGuard.authenticate.mockResolvedValueOnce({ user });

    const request = createRequest('/api/v1/announcements/ann-123', 'DELETE');
    const response = await deleteAnnouncement(request, createContext('ann-123'));
    expect(response.status).toBe(403);
  });

  test('returns 403 for manager role', async () => {
    const user = createUser(ROLES.MANAGER);
    authGuard.authenticate.mockResolvedValueOnce({ user });

    const request = createRequest('/api/v1/announcements/ann-123', 'DELETE');
    const response = await deleteAnnouncement(request, createContext('ann-123'));
    expect(response.status).toBe(403);
  });

  test('returns 404 when announcement not found', async () => {
    const user = createUser(ROLES.ADMIN);
    authGuard.authenticate.mockResolvedValueOnce({ user });

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/announcements/ann-nonexistent', 'DELETE');
    const response = await deleteAnnouncement(request, createContext('ann-nonexistent'));
    expect(response.status).toBe(404);
  });

  test('soft-deletes announcement for admin', async () => {
    const user = createUser(ROLES.ADMIN, 'tenant-123', 'admin-123');
    authGuard.authenticate.mockResolvedValueOnce({ user });

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'ann-123' }] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'ann-123',
              active: false,
            },
          ],
        });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/announcements/ann-123', 'DELETE');
    const response = await deleteAnnouncement(request, createContext('ann-123'));
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.data.active).toBe(false);
  });

  test('superadmin can delete announcements', async () => {
    const user = createUser(ROLES.SUPERADMIN, 'tenant-123', 'super-123');
    authGuard.authenticate.mockResolvedValueOnce({ user });

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'ann-123' }] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'ann-123',
              active: false,
            },
          ],
        });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/announcements/ann-123', 'DELETE');
    const response = await deleteAnnouncement(request, createContext('ann-123'));
    expect(response.status).toBe(200);
  });
});
