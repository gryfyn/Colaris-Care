/**
 * Unit tests for authentication logic and handlers
 * Tests authentication utility functions, validation, and error handling
 */

import { authenticate, authorize, guardResidentAccess, maskPHI } from '@/lib/auth-guard.js';
import { query } from '@/lib/db.js';

jest.mock('@/lib/db.js');
jest.mock('@/lib/token-store.js', () => ({
  isJtiBlacklisted: jest.fn().mockResolvedValue(false),
}));
jest.mock('@/lib/jwt.js', () => ({
  verifyToken: jest.fn(),
}));
jest.mock('@/lib/roles.js', () => ({
  hasPermission: jest.fn(),
  ROLES: {
    RESIDENT_CARE_OF: 'resident_care_of',
    STAFF: 'staff',
    ADMIN: 'admin',
  },
  PHI_MASKED_FIELDS: {
    staff: ['ssn', 'payment_method'],
    resident_care_of: ['ssn', 'diagnosis', 'medications'],
  },
}));

const { verifyToken } = require('@/lib/jwt.js');
const { hasPermission, ROLES, PHI_MASKED_FIELDS } = require('@/lib/roles.js');

describe('authenticate() - JWT verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 401 when Authorization header is missing', async () => {
    const request = {
      headers: {
        get: jest.fn((name) => {
          if (name === 'authorization') return null;
          return null;
        }),
      },
    };

    const result = await authenticate(request);

    expect(result.error).toMatch(/missing or malformed authorization/i);
    expect(result.status).toBe(401);
  });

  test('returns 401 when Authorization header does not start with Bearer', async () => {
    const request = {
      headers: {
        get: jest.fn((name) => {
          if (name === 'authorization') return 'Basic dGVzdDp0ZXN0';
          return null;
        }),
      },
    };

    const result = await authenticate(request);

    expect(result.error).toMatch(/missing or malformed authorization/i);
    expect(result.status).toBe(401);
  });

  test('returns user object on valid token', async () => {
    const mockToken = {
      sub: 'user-123',
      staffId: 'staff-456',
      tenantId: 'tenant-789',
      role: 'admin',
      jti: 'jti-abc',
      exp: 1710000000,
    };

    verifyToken.mockReturnValueOnce(mockToken);

    const request = {
      headers: {
        get: jest.fn((name) => {
          if (name === 'authorization') return 'Bearer valid-token';
          return null;
        }),
      },
    };

    const result = await authenticate(request);

    expect(result.user).toEqual({
      id: 'user-123',
      staffId: 'staff-456',
      tenantId: 'tenant-789',
      role: 'admin',
      jti: 'jti-abc',
      exp: 1710000000,
    });
  });

  test('returns TOKEN_EXPIRED code when token is expired', async () => {
    const error = new Error('Token expired');
    error.name = 'TokenExpiredError';
    verifyToken.mockImplementationOnce(() => {
      throw error;
    });

    const request = {
      headers: {
        get: jest.fn((name) => {
          if (name === 'authorization') return 'Bearer expired-token';
          return null;
        }),
      },
    };

    const result = await authenticate(request);

    expect(result.error).toMatch(/token expired/i);
    expect(result.code).toBe('TOKEN_EXPIRED');
    expect(result.status).toBe(401);
  });

  test('returns 401 for invalid token signature', async () => {
    verifyToken.mockImplementationOnce(() => {
      throw new Error('Invalid signature');
    });

    const request = {
      headers: {
        get: jest.fn((name) => {
          if (name === 'authorization') return 'Bearer invalid-token';
          return null;
        }),
      },
    };

    const result = await authenticate(request);

    expect(result.error).toMatch(/invalid token/i);
    expect(result.status).toBe(401);
  });

  test('extracts token correctly from Bearer header', async () => {
    verifyToken.mockReturnValueOnce({
      sub: 'user-123',
      staffId: 'staff-456',
      tenantId: 'tenant-789',
      role: 'staff',
      jti: 'jti-xyz',
    });

    const request = {
      headers: {
        get: jest.fn((name) => {
          if (name === 'authorization') return 'Bearer my-actual-token-value';
          return null;
        }),
      },
    };

    await authenticate(request);

    expect(verifyToken).toHaveBeenCalledWith('my-actual-token-value', 'access');
  });
});

describe('authorize() - RBAC permission check', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns true when role has permission', () => {
    hasPermission.mockReturnValueOnce(true);

    const result = authorize('admin', 'create_staff', 'edit_resident');

    expect(result).toBe(true);
  });

  test('returns false when role lacks permission', () => {
    hasPermission.mockReturnValueOnce(false);

    const result = authorize('staff', 'create_staff');

    expect(result).toBe(false);
  });

  test('checks any matching permission from multiple permissions', () => {
    hasPermission.mockReturnValueOnce(false).mockReturnValueOnce(true);

    const result = authorize('manager', 'create_staff', 'review_reports');

    expect(result).toBe(true);
  });

  test('passes role and permissions to hasPermission', () => {
    hasPermission.mockReturnValueOnce(false);

    authorize('manager', 'perm1', 'perm2');

    expect(hasPermission).toHaveBeenCalledWith('manager', expect.any(String));
  });
});

describe('guardResidentAccess() - resident data access control', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns null for non-resident_care_of roles', async () => {
    const result = await guardResidentAccess(
      { role: 'admin' },
      'resident-123'
    );

    expect(result).toBeNull();
  });

  test('returns 403 when resident_care_of user has no linked resident', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const result = await guardResidentAccess(
      { id: 'user-123', role: 'resident_care_of' },
      'resident-456'
    );

    expect(result.error).toMatch(/no resident record linked/i);
    expect(result.status).toBe(403);
  });

  test('returns 403 when resident_care_of tries to access different resident', async () => {
    query.mockResolvedValueOnce({
      rows: [{ resident_id: 'resident-own' }],
    });

    const result = await guardResidentAccess(
      { id: 'user-123', role: 'resident_care_of' },
      'resident-different'
    );

    expect(result.error).toMatch(/access denied.*only view your own/i);
    expect(result.status).toBe(403);
  });

  test('returns linkedResidentId when resident_care_of accesses their own record', async () => {
    query.mockResolvedValueOnce({
      rows: [{ resident_id: 'resident-123' }],
    });

    const result = await guardResidentAccess(
      { id: 'user-456', role: 'resident_care_of' },
      'resident-123'
    );

    expect(result.linkedResidentId).toBe('resident-123');
  });

  test('allows resident_care_of without requestedId (returns their own)', async () => {
    query.mockResolvedValueOnce({
      rows: [{ resident_id: 'resident-own' }],
    });

    const result = await guardResidentAccess(
      { id: 'user-789', role: 'resident_care_of' },
      undefined
    );

    expect(result.linkedResidentId).toBe('resident-own');
  });

  test('queries correct user by id', async () => {
    query.mockResolvedValueOnce({
      rows: [{ resident_id: 'resident-xyz' }],
    });

    await guardResidentAccess(
      { id: 'user-special', role: 'resident_care_of' },
      'resident-xyz'
    );

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE id = $1'),
      ['user-special']
    );
  });
});

describe('maskPHI() - PHI field masking', () => {
  test('returns original object when no masked fields for role', () => {
    const obj = {
      id: '123',
      name: 'John',
      email: 'john@example.com',
    };

    const result = maskPHI(obj, 'admin');

    expect(result).toEqual(obj);
  });

  test('masks SSN for staff role', () => {
    const obj = {
      id: '123',
      name: 'John',
      ssn: '123-45-6789',
      payment_method: 'credit_card',
    };

    const result = maskPHI(obj, 'staff');

    expect(result.ssn).toBe('[RESTRICTED]');
    expect(result.payment_method).toBe('[RESTRICTED]');
    expect(result.id).toBe('123');
    expect(result.name).toBe('John');
  });

  test('masks sensitive fields for resident_care_of', () => {
    const obj = {
      id: '456',
      name: 'Jane',
      ssn: '987-65-4321',
      diagnosis: 'Type 2 Diabetes',
      medications: 'Metformin',
    };

    const result = maskPHI(obj, 'resident_care_of');

    expect(result.ssn).toBe('[RESTRICTED]');
    expect(result.diagnosis).toBe('[RESTRICTED]');
    expect(result.medications).toBe('[RESTRICTED]');
  });

  test('does not mutate original object', () => {
    const obj = {
      id: '789',
      ssn: '555-55-5555',
    };
    const original = { ...obj };

    maskPHI(obj, 'staff');

    expect(obj).toEqual(original);
  });

  test('handles null input gracefully', () => {
    const result = maskPHI(null, 'staff');
    expect(result).toBeNull();
  });

  test('handles undefined input gracefully', () => {
    const result = maskPHI(undefined, 'staff');
    expect(result).toBeUndefined();
  });

  test('preserves undefined fields', () => {
    const obj = {
      id: '123',
      name: undefined,
      ssn: '123-45-6789',
    };

    const result = maskPHI(obj, 'staff');

    expect(result.name).toBeUndefined();
    expect(result.ssn).toBe('[RESTRICTED]');
  });
});
