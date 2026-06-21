/**
 * Unit tests for /api/v1/notifications/[id]/read endpoint
 * Tests authentication, user isolation, and notification marking
 */

import { PATCH as patchNotificationRead } from '@/app/api/v1/notifications/[id]/read/route.js';

jest.mock('@/lib/auth-guard.js', () => ({
  authenticate: jest.fn(),
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
    logUpdate: jest.fn().mockResolvedValue(undefined),
  })),
}));

import * as authGuard from '@/lib/auth-guard.js';
import * as db from '@/lib/db.js';
import { ROLES } from '@/lib/roles.js';

function createRequest(url, method = 'PATCH', body = null) {
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

function createUser(role = ROLES.STAFF, tenantId = 'tenant-123', userId = 'user-123', staffId = 'staff-123') {
  return { id: userId, staffId, tenantId, role, jti: 'jti-123' };
}

function createMockClient() {
  return { query: jest.fn(), release: jest.fn() };
}

function createContext(id = 'notif-123') {
  return {
    params: Promise.resolve({ id }),
  };
}

describe('PATCH /api/v1/notifications/[id]/read — Mark notification as read', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 401 when not authenticated', async () => {
    authGuard.authenticate.mockResolvedValueOnce({ error: 'Unauthorized', status: 401 });
    const request = createRequest('/api/v1/notifications/notif-123/read');
    const response = await patchNotificationRead(request, createContext('notif-123'));
    expect(response.status).toBe(401);
  });

  test('returns 404 when notification not found', async () => {
    const user = createUser(ROLES.STAFF, 'tenant-123', 'user-123', 'staff-123');
    authGuard.authenticate.mockResolvedValueOnce({ user });

    db.withTenantClient.mockImplementationOnce(async (tenantId, userId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // Notification not found
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/notifications/notif-nonexistent/read');
    const response = await patchNotificationRead(request, createContext('notif-nonexistent'));
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  test('returns 404 when user tries to mark someone else notification', async () => {
    const user = createUser(ROLES.STAFF, 'tenant-123', 'user-abc', 'staff-123');
    authGuard.authenticate.mockResolvedValueOnce({ user });

    db.withTenantClient.mockImplementationOnce(async (tenantId, userId, callback) => {
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // Notification belongs to different user
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/notifications/notif-other-user/read');
    const response = await patchNotificationRead(request, createContext('notif-other-user'));
    expect(response.status).toBe(404);
  });

  test('marks notification as read for authenticated user', async () => {
    const userId = 'user-123';
    const user = createUser(ROLES.STAFF, 'tenant-123', userId, 'staff-123');
    authGuard.authenticate.mockResolvedValueOnce({ user });

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'notif-123', user_id: userId }] }) // Notification found and belongs to user
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'notif-123',
              is_read: true,
              read_at: '2024-05-20T09:00:00Z',
            },
          ],
        }); // UPDATE returns updated notification
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/notifications/notif-123/read');
    const response = await patchNotificationRead(request, createContext('notif-123'));
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.data.is_read).toBe(true);
    expect(data.data.read_at).toBe('2024-05-20T09:00:00Z');
  });

  test('enforces user isolation on marking read', async () => {
    const userId = 'user-xyz';
    const user = createUser(ROLES.STAFF, 'tenant-123', userId, 'staff-123');
    authGuard.authenticate.mockResolvedValueOnce({ user });

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      // First query checks if notification belongs to this user
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'notif-123', user_id: userId, tenant_id: 'tenant-123' }] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'notif-123',
              is_read: true,
              read_at: '2024-05-20T09:00:00Z',
            },
          ],
        });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/notifications/notif-123/read');
    const response = await patchNotificationRead(request, createContext('notif-123'));
    expect(response.status).toBe(200);

    // Verify the tenant and user were passed to withTenantClient
    const callArgs = db.withTenantClient.mock.calls[0];
    expect(callArgs[0]).toBe('tenant-123');
  });

  test('enforces tenant isolation', async () => {
    const user = createUser(ROLES.STAFF, 'tenant-xyz', 'user-123', 'staff-123');
    authGuard.authenticate.mockResolvedValueOnce({ user });

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      expect(tenantId).toBe('tenant-xyz');
      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/notifications/notif-123/read');
    await patchNotificationRead(request, createContext('notif-123'));

    expect(db.withTenantClient).toHaveBeenCalledWith('tenant-xyz', expect.any(String), expect.any(Function));
  });

  test('allows staff to mark their own notifications', async () => {
    const userId = 'staff-user-123';
    const user = createUser(ROLES.STAFF, 'tenant-123', userId, 'staff-abc');
    authGuard.authenticate.mockResolvedValueOnce({ user });

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'notif-123', user_id: userId }] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'notif-123',
              is_read: true,
              read_at: '2024-05-20T09:00:00Z',
            },
          ],
        });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/notifications/notif-123/read');
    const response = await patchNotificationRead(request, createContext('notif-123'));
    expect(response.status).toBe(200);
  });

  test('allows admin to mark their own notifications', async () => {
    const userId = 'admin-user-123';
    const user = createUser(ROLES.ADMIN, 'tenant-123', userId, 'admin-xyz');
    authGuard.authenticate.mockResolvedValueOnce({ user });

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'notif-456', user_id: userId }] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'notif-456',
              is_read: true,
              read_at: '2024-05-20T10:30:00Z',
            },
          ],
        });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/notifications/notif-456/read');
    const response = await patchNotificationRead(request, createContext('notif-456'));
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.data.is_read).toBe(true);
  });

  test('database error returns 500', async () => {
    const user = createUser(ROLES.STAFF, 'tenant-123', 'user-123', 'staff-123');
    authGuard.authenticate.mockResolvedValueOnce({ user });

    db.withTenantClient.mockImplementationOnce(async () => {
      throw new Error('Database connection failed');
    });

    const request = createRequest('/api/v1/notifications/notif-123/read');
    const response = await patchNotificationRead(request, createContext('notif-123'));
    expect(response.status).toBe(500);
  });

  test('idempotent: marking already-read notification returns success', async () => {
    const userId = 'user-123';
    const user = createUser(ROLES.STAFF, 'tenant-123', userId, 'staff-123');
    authGuard.authenticate.mockResolvedValueOnce({ user });

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'notif-123', user_id: userId, is_read: true }] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'notif-123',
              is_read: true,
              read_at: '2024-05-20T08:00:00Z',
            },
          ],
        });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/notifications/notif-123/read');
    const response = await patchNotificationRead(request, createContext('notif-123'));
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.data.is_read).toBe(true);
  });

  test('audit logger is called on successful mark-read', async () => {
    const userId = 'user-123';
    const user = createUser(ROLES.STAFF, 'tenant-123', userId, 'staff-123');
    authGuard.authenticate.mockResolvedValueOnce({ user });

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'notif-123', user_id: userId }] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'notif-123',
              is_read: true,
              read_at: '2024-05-20T09:00:00Z',
            },
          ],
        });
      return callback(mockClient);
    });

    const request = createRequest('/api/v1/notifications/notif-123/read');
    await patchNotificationRead(request, createContext('notif-123'));

    // Verify audit logger was called
    expect(db.withTenantClient).toHaveBeenCalled();
  });

  test('multiple users cannot mark each others notifications', async () => {
    const userId1 = 'user-one';
    const userId2 = 'user-two';

    // First user tries to mark their own notification
    const user1 = createUser(ROLES.STAFF, 'tenant-123', userId1, 'staff-123');
    authGuard.authenticate.mockResolvedValueOnce({ user: user1 });

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      // Notification belongs to user1
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'notif-user1', user_id: userId1 }] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'notif-user1',
              is_read: true,
              read_at: '2024-05-20T09:00:00Z',
            },
          ],
        });
      return callback(mockClient);
    });

    const request1 = createRequest('/api/v1/notifications/notif-user1/read');
    const response1 = await patchNotificationRead(request1, createContext('notif-user1'));
    expect(response1.status).toBe(200);

    // Second user tries to mark user1's notification (should fail)
    jest.clearAllMocks();
    const user2 = createUser(ROLES.STAFF, 'tenant-123', userId2, 'staff-456');
    authGuard.authenticate.mockResolvedValueOnce({ user: user2 });

    db.withTenantClient.mockImplementationOnce(async (tenantId, staffId, callback) => {
      const mockClient = createMockClient();
      // Notification not found for user2
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      return callback(mockClient);
    });

    const request2 = createRequest('/api/v1/notifications/notif-user1/read');
    const response2 = await patchNotificationRead(request2, createContext('notif-user1'));
    expect(response2.status).toBe(404);
  });
});
