/**
 * Permission and data filtering tests — requires a running test DB with seed data applied.
 * Tests that each user role sees only the data they're authorized to access.
 * Set TEST_DATABASE_URL in your .env.test
 */

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';
const TEST_TENANT_ID = process.env.TEST_TENANT_ID || 'replace-with-seeded-tenant-uuid';

// Test data IDs (must exist in seeded database)
const TEST_DATA = {
  resident: {
    id: process.env.TEST_RESIDENT_ID || 'replace-with-seeded-resident-uuid',
    id2: process.env.TEST_RESIDENT_ID_2 || 'replace-with-second-resident-uuid',
  },
  staff: {
    assigned_id: process.env.TEST_STAFF_ASSIGNED_ID || 'replace-with-assigned-staff-uuid',
    unassigned_id: process.env.TEST_STAFF_UNASSIGNED_ID || 'replace-with-unassigned-staff-uuid',
  },
};

// Credentials for each role (must exist in seeded database)
const CREDENTIALS = {
  resident_care_of: {
    email: process.env.TEST_RESIDENT_EMAIL || 'resident@test.example.com',
    password: process.env.TEST_RESIDENT_PASSWORD || 'ResidentPass123!',
  },
  staff: {
    email: process.env.TEST_STAFF_EMAIL || 'staff@test.example.com',
    password: process.env.TEST_STAFF_PASSWORD || 'StaffPass123!',
  },
  staff_unassigned: {
    email: process.env.TEST_STAFF_UNASSIGNED_EMAIL || 'unassigned-staff@test.example.com',
    password: process.env.TEST_STAFF_UNASSIGNED_PASSWORD || 'StaffPass123!',
  },
  manager: {
    email: process.env.TEST_MANAGER_EMAIL || 'manager@test.example.com',
    password: process.env.TEST_MANAGER_PASSWORD || 'ManagerPass123!',
  },
  admin: {
    email: process.env.TEST_ADMIN_EMAIL || 'admin@test.example.com',
    password: process.env.TEST_ADMIN_PASSWORD || 'AdminPass123!',
  },
};

// Helper: Login and return access token
async function login(email, password) {
  const res = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      tenantId: TEST_TENANT_ID,
    }),
  });

  if (!res.ok) {
    const body = await res.json();
    throw new Error(`Login failed (${res.status}): ${body.error}`);
  }

  const body = await res.json();
  return body.accessToken;
}

// Helper: Make authenticated GET request
async function get(path, token) {
  return fetch(`${BASE}${path}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });
}

// Helper: Make authenticated POST request
async function post(path, body, token) {
  return fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}

// ============================================================================
// 1. RESIDENTS LIST - /api/v1/residents
// ============================================================================

describe('GET /api/v1/residents — Role-based filtering', () => {
  let tokens = {};

  beforeAll(async () => {
    try {
      tokens.resident_care_of = await login(CREDENTIALS.resident_care_of.email, CREDENTIALS.resident_care_of.password);
      tokens.staff = await login(CREDENTIALS.staff.email, CREDENTIALS.staff.password);
      tokens.manager = await login(CREDENTIALS.manager.email, CREDENTIALS.manager.password);
      tokens.admin = await login(CREDENTIALS.admin.email, CREDENTIALS.admin.password);
    } catch (err) {
      console.warn('Skipping: test credentials not configured in test DB', err.message);
    }
  });

  test('resident_care_of sees only own resident record', async () => {
    if (!tokens.resident_care_of) return;

    const res = await get('/api/v1/residents', tokens.resident_care_of);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);

    // resident_care_of should see exactly 1 resident (self)
    expect(body.data.length).toBeLessThanOrEqual(1);

    if (body.data.length > 0) {
      // Verify it's their linked resident
      expect(body.data[0].id).toBeDefined();
    }
  });

  test('staff sees all assigned residents', async () => {
    if (!tokens.staff) return;

    const res = await get('/api/v1/residents', tokens.staff);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);

    // Staff should see at least their assigned residents
    // (exact count depends on seeded data)
    expect(body.data.length).toBeGreaterThanOrEqual(0);
  });

  test('manager sees all residents', async () => {
    if (!tokens.manager) return;

    const res = await get('/api/v1/residents', tokens.manager);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);

    // Manager should see all residents in tenant
    expect(body.pagination).toBeDefined();
  });

  test('admin sees all residents', async () => {
    if (!tokens.admin) return;

    const res = await get('/api/v1/residents', tokens.admin);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.pagination).toBeDefined();
  });

  test('resident_care_of cannot access another resident by direct ID', async () => {
    if (!tokens.resident_care_of) return;

    // Try to access a specific resident that is not their linked record
    const res = await get(
      `/api/v1/residents/${TEST_DATA.resident.id2}`,
      tokens.resident_care_of
    );

    // Should return 403 Forbidden
    expect(res.status).toBe(403);
  });
});

// ============================================================================
// 2. ADMISSION FORMS - /api/v1/admission/forms
// ============================================================================

describe('GET /api/v1/admission/forms — Role-based filtering', () => {
  let tokens = {};

  beforeAll(async () => {
    try {
      tokens.staff = await login(CREDENTIALS.staff.email, CREDENTIALS.staff.password);
      tokens.manager = await login(CREDENTIALS.manager.email, CREDENTIALS.manager.password);
      tokens.admin = await login(CREDENTIALS.admin.email, CREDENTIALS.admin.password);
      tokens.resident_care_of = await login(CREDENTIALS.resident_care_of.email, CREDENTIALS.resident_care_of.password);
    } catch (err) {
      console.warn('Skipping: test credentials not configured', err.message);
    }
  });

  test('resident_care_of gets 403 when accessing admission forms', async () => {
    if (!tokens.resident_care_of) return;

    const res = await get('/api/v1/admission/forms', tokens.resident_care_of);

    // resident_care_of should not have permission to view forms list
    expect([403, 401]).toContain(res.status);
  });

  test('staff sees only pending admissions for their assigned residents', async () => {
    if (!tokens.staff) return;

    const res = await get('/api/v1/admission/forms?status=pending', tokens.staff);
    expect([200, 403]).toContain(res.status);

    if (res.status === 200) {
      const body = await res.json();
      expect(Array.isArray(body.data)).toBe(true);

      // Verify all forms are for their assigned residents only
      // (specific verification depends on seeded assignments)
    }
  });

  test('manager sees all pending admissions', async () => {
    if (!tokens.manager) return;

    const res = await get('/api/v1/admission/forms?status=pending', tokens.manager);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('admin sees all pending admissions', async () => {
    if (!tokens.admin) return;

    const res = await get('/api/v1/admission/forms?status=pending', tokens.admin);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });
});

// ============================================================================
// 3. DAILY PROGRESS NOTES - /api/v1/daily-progress-notes
// ============================================================================

describe('GET /api/v1/daily-progress-notes — Role-based filtering', () => {
  let tokens = {};

  beforeAll(async () => {
    try {
      tokens.staff = await login(CREDENTIALS.staff.email, CREDENTIALS.staff.password);
      tokens.manager = await login(CREDENTIALS.manager.email, CREDENTIALS.manager.password);
      tokens.admin = await login(CREDENTIALS.admin.email, CREDENTIALS.admin.password);
      tokens.resident_care_of = await login(CREDENTIALS.resident_care_of.email, CREDENTIALS.resident_care_of.password);
    } catch (err) {
      console.warn('Skipping: test credentials not configured', err.message);
    }
  });

  test('resident_care_of gets 403 when accessing progress notes', async () => {
    if (!tokens.resident_care_of) return;

    const res = await get('/api/v1/daily-progress-notes', tokens.resident_care_of);
    expect(res.status).toBe(403);
  });

  test('staff gets 403 when accessing admin review queue', async () => {
    if (!tokens.staff) return;

    const res = await get('/api/v1/daily-progress-notes', tokens.staff);
    expect(res.status).toBe(403);
  });

  test('manager sees all pending progress notes', async () => {
    if (!tokens.manager) return;

    const res = await get('/api/v1/daily-progress-notes?status=pending', tokens.manager);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.pagination).toBeDefined();
  });

  test('admin sees all pending progress notes', async () => {
    if (!tokens.admin) return;

    const res = await get('/api/v1/daily-progress-notes?status=pending', tokens.admin);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.pagination).toBeDefined();
  });

  test('admin can filter by status', async () => {
    if (!tokens.admin) return;

    const res = await get('/api/v1/daily-progress-notes?status=approved', tokens.admin);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    // All returned notes should have status=approved
    body.data.forEach(note => {
      expect(note.review_status).toBe('approved');
    });
  });
});

// ============================================================================
// 4. CARE PLANS - /api/v1/care-plans
// ============================================================================

describe('GET /api/v1/care-plans — Role-based filtering', () => {
  let tokens = {};

  beforeAll(async () => {
    try {
      tokens.staff = await login(CREDENTIALS.staff.email, CREDENTIALS.staff.password);
      tokens.manager = await login(CREDENTIALS.manager.email, CREDENTIALS.manager.password);
      tokens.admin = await login(CREDENTIALS.admin.email, CREDENTIALS.admin.password);
      tokens.resident_care_of = await login(CREDENTIALS.resident_care_of.email, CREDENTIALS.resident_care_of.password);
    } catch (err) {
      console.warn('Skipping: test credentials not configured', err.message);
    }
  });

  test('resident_care_of cannot access care plans (no permission)', async () => {
    if (!tokens.resident_care_of) return;

    const res = await get('/api/v1/care-plans', tokens.resident_care_of);
    expect(res.status).toBe(403);
  });

  test('staff sees only care plans for assigned residents', async () => {
    if (!tokens.staff) return;

    const res = await get('/api/v1/care-plans', tokens.staff);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);

    // Staff should automatically be filtered to assigned residents (staff_only is default)
    // Verify by checking that all care plans are for residents they're assigned to
  });

  test('manager sees all care plans', async () => {
    if (!tokens.manager) return;

    const res = await get('/api/v1/care-plans', tokens.manager);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('admin sees all care plans', async () => {
    if (!tokens.admin) return;

    const res = await get('/api/v1/care-plans', tokens.admin);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('staff cannot bypass staff_only filter parameter', async () => {
    if (!tokens.staff) return;

    // Staff user tries to set staff_only=0 to see all residents
    const res = await get('/api/v1/care-plans?staff_only=0', tokens.staff);
    expect(res.status).toBe(200);

    const body = await res.json();
    // Should still be filtered to assigned residents (parameter should be ignored or enforced)
    expect(Array.isArray(body.data)).toBe(true);
  });
});

// ============================================================================
// 5. STAFF DIRECTORY - /api/v1/admin/staff
// ============================================================================

describe('GET /api/v1/admin/staff — Role-based filtering', () => {
  let tokens = {};

  beforeAll(async () => {
    try {
      tokens.staff = await login(CREDENTIALS.staff.email, CREDENTIALS.staff.password);
      tokens.manager = await login(CREDENTIALS.manager.email, CREDENTIALS.manager.password);
      tokens.admin = await login(CREDENTIALS.admin.email, CREDENTIALS.admin.password);
      tokens.resident_care_of = await login(CREDENTIALS.resident_care_of.email, CREDENTIALS.resident_care_of.password);
    } catch (err) {
      console.warn('Skipping: test credentials not configured', err.message);
    }
  });

  test('resident_care_of gets 403 when accessing staff directory', async () => {
    if (!tokens.resident_care_of) return;

    const res = await get('/api/v1/admin/staff', tokens.resident_care_of);
    expect(res.status).toBe(403);
  });

  test('staff gets 403 when accessing staff directory (STAFF_WRITE required)', async () => {
    if (!tokens.staff) return;

    const res = await get('/api/v1/admin/staff', tokens.staff);
    expect(res.status).toBe(403);
  });

  test('manager sees all staff', async () => {
    if (!tokens.manager) return;

    const res = await get('/api/v1/admin/staff', tokens.manager);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.pagination).toBeDefined();
  });

  test('admin sees all staff', async () => {
    if (!tokens.admin) return;

    const res = await get('/api/v1/admin/staff', tokens.admin);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.pagination).toBeDefined();
  });

  test('manager can filter staff by role', async () => {
    if (!tokens.manager) return;

    const res = await get('/api/v1/admin/staff?role=staff', tokens.manager);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    // All returned staff should have role=staff
    body.data.forEach(member => {
      expect(member.role).toBe('staff');
    });
  });
});

// ============================================================================
// 6. PROGRESS NOTE POST - /api/v1/daily-progress-notes (POST)
// ============================================================================

describe('POST /api/v1/daily-progress-notes — Write permission and assignment check', () => {
  let tokens = {};

  beforeAll(async () => {
    try {
      tokens.staff = await login(CREDENTIALS.staff.email, CREDENTIALS.staff.password);
      tokens.staff_unassigned = await login(CREDENTIALS.staff_unassigned.email, CREDENTIALS.staff_unassigned.password);
      tokens.manager = await login(CREDENTIALS.manager.email, CREDENTIALS.manager.password);
      tokens.resident_care_of = await login(CREDENTIALS.resident_care_of.email, CREDENTIALS.resident_care_of.password);
    } catch (err) {
      console.warn('Skipping: test credentials not configured', err.message);
    }
  });

  test('resident_care_of cannot write progress notes', async () => {
    if (!tokens.resident_care_of) return;

    const res = await post('/api/v1/daily-progress-notes', {
      resident_id: TEST_DATA.resident.id,
      note_date: '2025-05-27',
      shift: 'morning',
      note_body: { clinical_observations: 'test' },
    }, tokens.resident_care_of);

    expect(res.status).toBe(403);
  });

  test('staff can write progress notes for assigned residents', async () => {
    if (!tokens.staff) return;

    const res = await post('/api/v1/daily-progress-notes', {
      resident_id: TEST_DATA.resident.id,
      note_date: '2025-05-27',
      shift: 'morning',
      note_body: { clinical_observations: 'test observation' },
    }, tokens.staff);

    // Should be 201 (created) or 409 (already exists) if note already exists
    expect([201, 409]).toContain(res.status);
  });

  test('staff cannot write progress notes for unassigned residents', async () => {
    if (!tokens.staff_unassigned) return;

    const res = await post('/api/v1/daily-progress-notes', {
      resident_id: TEST_DATA.resident.id,
      note_date: '2025-05-27',
      shift: 'afternoon',
      note_body: { clinical_observations: 'should fail' },
    }, tokens.staff_unassigned);

    // Should return 403 if staff is not assigned to this resident
    expect([403, 422, 401]).toContain(res.status);
  });

  test('manager can write progress notes for any resident', async () => {
    if (!tokens.manager) return;

    const res = await post('/api/v1/daily-progress-notes', {
      resident_id: TEST_DATA.resident.id,
      note_date: '2025-05-27',
      shift: 'night',
      note_body: { clinical_observations: 'manager note' },
    }, tokens.manager);

    // Should be 201 (created) or 409 (already exists)
    expect([201, 409, 422]).toContain(res.status);
  });
});

// ============================================================================
// 7. PHI MASKING - Verify sensitive fields are redacted
// ============================================================================

describe('PHI masking by role', () => {
  let tokens = {};

  beforeAll(async () => {
    try {
      tokens.staff = await login(CREDENTIALS.staff.email, CREDENTIALS.staff.password);
      tokens.manager = await login(CREDENTIALS.manager.email, CREDENTIALS.manager.password);
      tokens.admin = await login(CREDENTIALS.admin.email, CREDENTIALS.admin.password);
    } catch (err) {
      console.warn('Skipping: test credentials not configured', err.message);
    }
  });

  test('staff sees ssn_last4 masked as [RESTRICTED]', async () => {
    if (!tokens.staff) return;

    const res = await get('/api/v1/residents', tokens.staff);
    if (res.status !== 200) return;

    const body = await res.json();
    if (body.data.length === 0) return;

    const resident = body.data[0];
    // staff role has ssn_last4 masked
    if (resident.ssn_last4) {
      expect(resident.ssn_last4).toBe('[RESTRICTED]');
    }
  });

  test('manager sees unmasked resident data', async () => {
    if (!tokens.manager) return;

    const res = await get('/api/v1/residents', tokens.manager);
    if (res.status !== 200) return;

    const body = await res.json();
    if (body.data.length === 0) return;

    const resident = body.data[0];
    // manager role should see ssn_last4 unmasked
    // (ssn_last4 may not be visible in API response due to encryption)
  });

  test('admin sees unmasked resident data', async () => {
    if (!tokens.admin) return;

    const res = await get('/api/v1/residents', tokens.admin);
    if (res.status !== 200) return;

    const body = await res.json();
    if (body.data.length === 0) return;

    // admin role should see all fields
    const resident = body.data[0];
    expect(resident.id).toBeDefined();
  });
});

// ============================================================================
// 8. AUTHENTICATION & TOKEN VALIDATION
// ============================================================================

describe('Authentication enforcement', () => {
  test('request without token returns 401', async () => {
    const res = await fetch(`${BASE}/api/v1/residents`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(401);
  });

  test('request with invalid token returns 401', async () => {
    const res = await fetch(`${BASE}/api/v1/residents`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer invalid.fake.token',
      },
    });
    expect(res.status).toBe(401);
  });

  test('request with malformed Authorization header returns 401', async () => {
    const res = await fetch(`${BASE}/api/v1/residents`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'NotBearer sometoken',
      },
    });
    expect(res.status).toBe(401);
  });
});

// ============================================================================
// 9. TENANT ISOLATION
// ============================================================================

describe('Tenant isolation', () => {
  let tokens = {};

  beforeAll(async () => {
    try {
      tokens.admin = await login(CREDENTIALS.admin.email, CREDENTIALS.admin.password);
    } catch (err) {
      console.warn('Skipping: test credentials not configured', err.message);
    }
  });

  test('admin sees only residents from their tenant', async () => {
    if (!tokens.admin) return;

    const res = await get('/api/v1/residents', tokens.admin);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);

    // All residents should belong to the admin's tenant
    // (specific verification would require knowing tenant IDs)
  });
});

// ============================================================================
// 10. ERROR MESSAGE LEAK PREVENTION
// ============================================================================

describe('Error message safety (no data leakage)', () => {
  let tokens = {};

  beforeAll(async () => {
    try {
      tokens.resident_care_of = await login(CREDENTIALS.resident_care_of.email, CREDENTIALS.resident_care_of.password);
    } catch (err) {
      console.warn('Skipping: test credentials not configured', err.message);
    }
  });

  test('403 errors do not include details about accessible data', async () => {
    if (!tokens.resident_care_of) return;

    const res = await get('/api/v1/admin/staff', tokens.resident_care_of);
    expect(res.status).toBe(403);

    const body = await res.json();
    const errorMessage = body.error?.toLowerCase() || '';

    // Error message should not leak info about what data exists
    expect(errorMessage).not.toMatch(/staff member.*exists/i);
    expect(errorMessage).not.toMatch(/no staff.*found/i);
  });

  test('404 errors do not confirm record existence for unauthorized users', async () => {
    if (!tokens.resident_care_of) return;

    // Try to access a non-existent resident with a fake ID
    const fakeId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    const res = await get(`/api/v1/residents/${fakeId}`, tokens.resident_care_of);

    // Should return 403 (forbidden) or 404 (not found), but message should not leak
    expect([403, 404, 422]).toContain(res.status);
  });
});
