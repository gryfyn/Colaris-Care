# SaaS Multi-Tenant Refactoring Plan

**Objective**: Transform from single-facility application into a SaaS platform where multiple healthcare facilities operate independently on shared infrastructure.

**Current State**: Schema supports multi-tenancy (RLS, tenants table), but application logic assumes a single tenant. Auth, UI, and API routes are hardcoded or lack tenant resolution.

---

## 1. Database Schema Changes

### 1.1 Validate Existing Multi-Tenant Structure
**Status**: Schema is already multi-tenant ready ✅

Current structure:
```sql
ref.tenants(id, name, oregon_npi, oar_license, timezone, ...)  -- one row per facility
ref.staff(id, tenant_id, ...)                                   -- staff belong to one tenant
care.user_accounts(id, tenant_id, staff_id, ...)               -- linked to tenant
care.residents(id, tenant_id, ...)                             -- resident isolation per tenant
-- ... all tables include tenant_id and RLS policies
```

**No schema changes needed** — focus shifts to application layer.

### 1.2 Add Tenant Metadata Fields (Optional Enhancement)
**File**: `db/migrations/00XX_enhance_tenants_for_saas.sql`

```sql
ALTER TABLE ref.tenants ADD COLUMN IF NOT EXISTS
  subdomain           VARCHAR(100) UNIQUE,         -- for custom URLs (facility.app.com)
  logo_url            TEXT,                         -- facility branding
  primary_color       VARCHAR(7),                   -- UI theming
  status              VARCHAR(50) DEFAULT 'active', -- active, suspended, archived
  plan_type           VARCHAR(50) DEFAULT 'standard', -- pricing tier
  max_staff           INT,                          -- seat limit
  max_residents       INT,                          -- capacity limit
  onboarded_at        TIMESTAMPTZ,
  offboarded_at       TIMESTAMPTZ;

-- Optional: store billing/contact info
ALTER TABLE ref.tenants ADD COLUMN IF NOT EXISTS
  billing_email       VARCHAR(200),
  billing_phone       VARCHAR(30),
  billing_address     TEXT,
  subscription_id     VARCHAR(100);  -- Stripe/payment processor ID
```

### 1.3 User Account → Tenant Mapping (Clarification)
**Current state**:
- Each `ref.staff` has exactly one `tenant_id`
- Each `care.user_accounts` has `staff_id` + `tenant_id` 
- JWT includes `tenantId`

**No change needed** — this is already correct for SaaS model. Each facility has separate staff.

---

## 2. Authentication & Tenant Resolution

### 2.1 Implement Tenant Detection at Login
**File**: `src/app/api/v1/auth/login/route.js`

**Current issue**: Login endpoint doesn't resolve which facility the staff member belongs to. JWT may hardcode or assume a single tenant.

**New flow**:
1. User provides `email` + `password`
2. Query `care.user_accounts` → `ref.staff` to get `tenant_id`
3. If email exists in multiple tenants (should not happen in current schema), return error or prompt
4. Extract `tenant_id` from staff record
5. Emit JWT with `tenantId`

**Changes to implement**:
```javascript
const { rows } = await query(
  `SELECT
    ua.id AS account_id,
    s.id AS staff_id,
    s.tenant_id,          -- THE FACILITY THIS STAFF BELONGS TO
    s.first_name,
    s.last_name,
    s.role,
    ua.password_hash,
    ua.role AS account_role
   FROM care.user_accounts ua
   JOIN ref.staff s ON s.id = ua.staff_id
   WHERE ua.email = $1 AND ua.is_active = TRUE
   LIMIT 1`,
  [email.toLowerCase().trim()]
);

if (!user) {
  return Response.json({ error: 'Invalid credentials' }, { status: 401 });
}

// JWT MUST include the staff's tenant_id
const tokenPayload = {
  userId:     user.account_id,
  staffId:    user.staff_id,
  tenantId:   user.tenant_id,  // THE FACILITY CONTEXT
  role:       user.account_role,
};

const accessToken = signAccessToken(tokenPayload);
return Response.json({ accessToken, user: { /* user data */ } });
```

### 2.2 Add Resident Login Support
**File**: `src/app/api/v1/auth/login/route.js` (update existing)

**Current**: Only staff login is described.  
**New**: Support residents logging in (they also have `user_accounts` entries).

```javascript
const { rows } = await query(
  `SELECT
    COALESCE(s.id, r.id) AS person_id,
    COALESCE(s.tenant_id, r.tenant_id) AS tenant_id,  -- EITHER staff or resident tenant
    ua.id AS account_id,
    ua.staff_id,
    ua.resident_id,
    ua.role
   FROM care.user_accounts ua
   LEFT JOIN ref.staff s ON s.id = ua.staff_id
   LEFT JOIN care.residents r ON r.id = ua.resident_id
   WHERE ua.email = $1 AND ua.is_active = TRUE
   LIMIT 1`,
  [email.toLowerCase().trim()]
);

// Both staff and residents: resolve tenant_id from either table
const tokenPayload = {
  userId:     user.account_id,
  staffId:    user.staff_id,
  residentId: user.resident_id,
  tenantId:   user.tenant_id,  -- BOTH HAVE TENANT CONTEXT
  role:       user.role,
};
```

### 2.3 Update JWT Token Structure
**File**: `src/lib/jwt.js`

**Existing structure** (may already be correct):
```javascript
{
  sub: userId,
  staffId,
  residentId,
  tenantId,    // THE FACILITY CONTEXT — CRITICAL FOR MULTITENANT
  role,
  jti,
  exp,
  iat
}
```

**Validation**: Ensure `tenantId` is always present and not null.

```javascript
if (!payload.tenantId) {
  throw new Error('tenantId is required in token payload for multi-tenant isolation');
}
```

### 2.4 Update Session Context Setting
**File**: `src/lib/db.js` (or wherever `withTenantClient()` is defined)

**Critical**: Every database query must set the RLS context variables.

```javascript
export async function withTenantClient(tenantId, staffId, callback) {
  if (!tenantId) {
    throw new Error('tenantId required for multi-tenant session context');
  }

  const client = await pool.connect();
  try {
    // Set RLS context for this connection
    await client.query(
      "SET app.tenant_id = $1, app.staff_id = $2",
      [tenantId, staffId]
    );

    // All queries from callback now enforce tenant isolation
    return await callback(client);
  } finally {
    client.release();
  }
}
```

---

## 3. API Route Audit & Tenant Isolation

### 3.1 Audit All API Routes for Tenant Context
**Scope**: Every endpoint in `src/app/api/v1/` must verify it's using tenant-aware queries.

**Checklist for each route**:

```
✅ Route extracts tenantId from JWT
✅ Route calls withTenantClient(tenantId, staffId, callback)
✅ Route includes tenant_id in WHERE clauses (redundant but explicit)
✅ Route does NOT assume a hardcoded or global tenant
✅ Audit logs include tenantId for tenant-specific querying
```

**Common patterns**:

**Bad** (single-tenant assumption):
```javascript
// ❌ No tenant context
const { rows } = await query(
  'SELECT * FROM care.residents WHERE id = $1',
  [id]
);
```

**Good** (multi-tenant ready):
```javascript
// ✅ Tenant context + explicit WHERE
const { rows } = await query(
  'SELECT * FROM care.residents WHERE id = $1 AND tenant_id = $2',
  [id, user.tenantId]
);
```

**Better** (tenant context set globally):
```javascript
// ✅ withTenantClient ensures RLS isolation
const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
  const { rows } = await client.query(
    'SELECT * FROM care.residents WHERE id = $1',
    [id]
  );
  return rows[0];
});
```

### 3.2 Tenant Validation in `withTenantClient()`
**File**: `src/lib/db.js`

**Current implementation** (from earlier section) should:
1. Accept `tenantId` and `staffId`
2. Validate that staff belongs to the tenant (optional but recommended)
3. Set RLS context variables
4. Execute callback
5. Validate no cross-tenant data leaks

```javascript
export async function withTenantClient(tenantId, staffId, callback) {
  if (!tenantId) {
    throw new Error('tenantId required');
  }

  // Optional: verify staff actually belongs to this tenant
  const { rows: staffCheck } = await query(
    'SELECT id FROM ref.staff WHERE id = $1 AND tenant_id = $2',
    [staffId, tenantId]
  );
  if (!staffCheck.length && staffId) {
    throw new Error('Unauthorized: staff not assigned to tenant');
  }

  const client = await pool.connect();
  try {
    await client.query(
      "SET app.tenant_id = $1, app.staff_id = $2",
      [tenantId, staffId]
    );
    return await callback(client);
  } finally {
    client.release();
  }
}
```

### 3.3 Verify RLS Policies in Database
**File**: `db/complete-schema.sql` (review and validate)

**Every table with tenant_id must have RLS enabled**:

```sql
-- Example: residents table
ALTER TABLE care.residents ENABLE ROW LEVEL SECURITY;

CREATE POLICY residents_tenant_isolation ON care.residents
  USING (tenant_id = current_setting('app.tenant_id')::UUID)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::UUID);
```

**Verify all tables have policies**:
- `care.residents`
- `care.user_accounts`
- `care.care_plans`
- `care.progress_notes`
- `care.incident_reports`
- `care.evacuation_drills`
- `ref.staff`
- `ref.organizations`
- ... (all tables with tenant_id)

### 3.4 Prevent Cross-Tenant Reads
**Pattern**: Never query without tenant context.

**Dangerous query** (can leak data):
```javascript
// ❌ NEVER DO THIS
const { rows } = await query('SELECT * FROM care.residents LIMIT 100');
```

**Safe query**:
```javascript
// ✅ Always include tenant_id
const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
  // RLS automatically filters by current_setting('app.tenant_id')
  const { rows } = await client.query('SELECT * FROM care.residents LIMIT 100');
  return rows;
});
```

### 3.5 Audit Logging & Tenant Scoping
**File**: `src/lib/audit-logger.js`

**Ensure all audit logs include `tenantId`**:

```javascript
export class AuditLogger {
  async log(event) {
    const { action, userId, tenantId, resourceId, details } = event;

    if (!tenantId) {
      throw new Error('tenantId required for audit log');
    }

    await query(
      `INSERT INTO audit_log.events (tenant_id, action, user_id, resource_id, details, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [tenantId, action, userId, resourceId, JSON.stringify(details)]
    );
  }
}
```

---

## 4. Frontend & Multi-Tenant UX

### 4.1 Facility-Specific Branding & Context
**File**: Update layout and header components

**Each facility** (tenant) should see:
- Its own name in header
- Its own branding (logo, colors)
- Data scoped to only its residents/staff

**Changes**:
```jsx
// src/app/layout.js or header component
export function TenantHeader({ user }) {
  const [tenant, setTenant] = useState(null);

  useEffect(() => {
    // Fetch tenant metadata
    if (user?.tenantId) {
      fetch(`/api/v1/tenants/${user.tenantId}`)
        .then(r => r.json())
        .then(data => setTenant(data.tenant));
    }
  }, [user?.tenantId]);

  return (
    <header style={{ backgroundColor: tenant?.primary_color || '#000' }}>
      {tenant?.logo_url && <img src={tenant.logo_url} alt={tenant.name} />}
      <h1>{tenant?.name}</h1>
    </header>
  );
}
```

### 4.2 Remove Any Tenant Selector UI
**If one exists**: Delete home/facility picker components.

**Rationale**: In SaaS model, each facility has its own login. Staff doesn't switch between facilities mid-session.

**Old UI** (remove):
- Dropdown menu "Switch facility"
- Multi-home selector

**New UI** (add):
- Logout and re-login to switch facilities
- Or, if organization uses SSO, map user to correct tenant automatically

### 4.3 Resident/Staff Lists Should Only Show Current Tenant Data
**File**: Components like `ResidentList.jsx`, `StaffDirectory.jsx`

**Before**:
```jsx
// ❌ May show data from all tenants (if query is not tenant-scoped)
const [residents, setResidents] = useState([]);
useEffect(() => {
  fetch('/api/v1/residents')
    .then(r => r.json())
    .then(data => setResidents(data));
}, []);
```

**After**:
```jsx
// ✅ API enforces tenant isolation; UI receives only current facility's data
const { auth } = useContext(AuthContext);
useEffect(() => {
  fetch('/api/v1/residents', {
    headers: { Authorization: `Bearer ${auth.accessToken}` }
  })
    .then(r => r.json())
    .then(data => setResidents(data));  // data already scoped to auth.user.tenantId
}, [auth.accessToken]);
```

### 4.4 Verify No Cross-Tenant Data in Forms/UI
**Security checklist**:
- [ ] Resident dropdown only shows residents from current facility
- [ ] Staff dropdown only shows staff from current facility
- [ ] Care plans only show for current facility's residents
- [ ] Reports only show current facility's data
- [ ] User cannot manually change tenantId in API requests

---

## 5. Audit & Logging Updates

### 5.1 Ensure All Audit Logs Include Tenant Scoping
**File**: `src/lib/audit-logger.js`

**Every audit entry must include `tenantId`** to allow per-facility audit trails.

```javascript
export class AuditLogger {
  async log(event) {
    const { action, userId, tenantId, resourceId, resourceType, details, ipAddress } = event;

    if (!tenantId) {
      throw new Error('tenantId required for multi-tenant audit integrity');
    }

    await query(
      `INSERT INTO audit_log.events 
       (tenant_id, action, user_id, resource_id, resource_type, details, ip_address, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [tenantId, action, userId, resourceId, resourceType, JSON.stringify(details), ipAddress]
    );
  }
}
```

### 5.2 Audit Log Queries Must Be Tenant-Scoped
**File**: Any admin endpoint that retrieves audit logs

**Pattern**:
```javascript
// ✅ Always filter by tenant
const { rows } = await query(
  `SELECT * FROM audit_log.events 
   WHERE tenant_id = $1 
   ORDER BY created_at DESC 
   LIMIT 100`,
  [user.tenantId]
);
```

### 5.3 Log All Multi-Tenant Critical Events
**Track**:
- [ ] Staff login + which facility
- [ ] Staff access to residents (which facility)
- [ ] Document creation/modification
- [ ] Deletion of sensitive records
- [ ] Failed authorization attempts
- [ ] Settings changes

---

## 6. Multi-Tenant Data Validation Strategy

### 6.1 Pre-Launch Validation Checklist
**Before going live**:

- [ ] All tables have `tenant_id` column (check schema)
- [ ] All tables have RLS policies enabled
- [ ] No public role has SELECT permission on any data table
- [ ] `withTenantClient()` properly sets `app.tenant_id` context
- [ ] Every API route calls `withTenantClient()` or validates tenant manually
- [ ] Audit logs capture tenant for every event
- [ ] JWT signing/verification includes `tenantId`
- [ ] No hardcoded tenant UUIDs in code
- [ ] No global state that assumes single tenant

### 6.2 Cross-Tenant Data Leak Test
**Run before launch**:

```sql
-- Simulate two facilities
INSERT INTO ref.tenants (name) VALUES ('Facility A'), ('Facility B') RETURNING id;
-- Get IDs: $TENANT_A_ID, $TENANT_B_ID

-- Create staff in each
INSERT INTO ref.staff (tenant_id, first_name, last_name, email, role)
  VALUES ($TENANT_A_ID, 'Alice', 'A', 'alice@facilityA.com', 'admin') RETURNING id;
  -- Get ID: $STAFF_A_ID

INSERT INTO ref.staff (tenant_id, first_name, last_name, email, role)
  VALUES ($TENANT_B_ID, 'Bob', 'B', 'bob@facilityB.com', 'admin') RETURNING id;
  -- Get ID: $STAFF_B_ID

-- Create residents in each
INSERT INTO care.residents (tenant_id, first_name, last_name)
  VALUES ($TENANT_A_ID, 'Resident', 'A') RETURNING id;
  -- Get ID: $RES_A_ID

INSERT INTO care.residents (tenant_id, first_name, last_name)
  VALUES ($TENANT_B_ID, 'Resident', 'B') RETURNING id;
  -- Get ID: $RES_B_ID

-- TEST: Can Alice (Facility A staff) see Bob's resident?
-- Set context as Alice
SET app.tenant_id = '$TENANT_A_ID', app.staff_id = '$STAFF_A_ID';

-- Query should return ONLY Resident A, not Resident B
SELECT * FROM care.residents WHERE id = '$RES_B_ID';
-- Result: Should be empty (RLS blocks it) ✅

-- If any rows returned: DATA LEAK ❌ Fix RLS before launch
```

### 6.3 Test Multi-Tenant Isolation via API
**Create test script**: `scripts/test-multitenant-isolation.js`

```javascript
// Login as staff from Facility A
const tokenA = await loginAs('alice@facilityA.com', 'password');

// Try to access Facility B resident
const response = await fetch('/api/v1/residents/residentB-id', {
  headers: { Authorization: `Bearer ${tokenA}` }
});

if (response.status === 200) {
  console.error('❌ DATA LEAK: Alice can see Facility B resident');
  process.exit(1);
}

if (response.status === 403 || response.status === 404) {
  console.log('✅ PASS: Tenant isolation working');
}
```

### 6.4 Verify Production Environment
- [ ] `NODE_ENV=production`
- [ ] All secrets configured (JWT keys, encryption keys)
- [ ] Database replicas (if any) have RLS enabled
- [ ] Connection pooling correctly propagates context variables
- [ ] No logs expose tenant UUIDs to wrong audience
- [ ] Backup/restore process preserves tenant isolation

---

## 7. Testing Checklist

### Unit Tests
- [ ] RLS policies block cross-tenant reads
- [ ] JWT extraction includes `tenantId`
- [ ] `withTenantClient()` enforces tenant context
- [ ] Audit logger requires `tenantId`
- [ ] Role-based access control per tenant

### Integration Tests
- [ ] Login returns correct `tenantId` for staff
- [ ] Resident login returns correct `tenantId`
- [ ] API returns 403 when accessing different tenant's resource
- [ ] Audit logs capture correct tenant
- [ ] Refresh token preserves `tenantId`
- [ ] Logout works per tenant

### E2E Tests
- [ ] Two separate facilities with same-named residents (no collision)
- [ ] Facility A staff cannot see Facility B residents (even by ID)
- [ ] Facility A staff cannot modify Facility B documents
- [ ] Resident data encrypted/accessible only to correct facility
- [ ] Reports only show data from correct facility
- [ ] Bulk operations (imports, exports) respect tenant boundaries

### Security Tests
- [ ] Brute-force token manipulation (add fake tenantId to JWT)
- [ ] SQL injection attempts in tenant-scoped queries
- [ ] Direct database queries bypass RLS (confirm they don't)
- [ ] Timing attacks on tenant detection
- [ ] CSRF tokens scoped per tenant

### Performance Tests
- [ ] RLS filtering doesn't degrade query performance
- [ ] Large tenant datasets don't leak to wrong tenants (column-level timing)
- [ ] Concurrent requests from multiple tenants don't interfere

---

## 8. Files to Audit & Modify

### Audit & Fix (High Priority)
**These files currently assume single tenant or lack tenant context**:

- [ ] `src/app/api/v1/auth/login/route.js` — ensure tenantId is extracted and passed to JWT
- [ ] `src/app/api/v1/auth/me/route.js` — return current tenant context
- [ ] `src/app/api/v1/auth/refresh/route.js` — preserve tenantId in refreshed token
- [ ] `src/lib/jwt.js` — validate tenantId is always present
- [ ] `src/lib/db.js` — audit `withTenantClient()` implementation
- [ ] `src/lib/auth-guard.js` — ensure auth extraction includes tenantId
- [ ] `src/lib/audit-logger.js` — require tenantId on all logs
- [ ] `src/contexts/AuthContext.js` — track tenant in React state
- [ ] `src/app/api/v1/**/route.js` — (all 40+ API routes) verify tenant-scoped queries

### Database Audit
- [ ] `db/db.sql` — verify all tables have tenant_id and RLS
- [ ] `db/complete-schema.sql` — verify RLS policies are comprehensive
- [ ] Audit trigger configuration (if exists)

### Frontend Audit
- [ ] `src/app/layout.js` — show current facility name
- [ ] All components that render lists (residents, staff, documents) — verify tenant isolation
- [ ] Remove any multi-tenant UI if present (facility switcher)

### Create (New)
- [ ] `scripts/test-multitenant-isolation.js` — integration test for cross-tenant blocking
- [ ] `docs/MULTITENANT_ARCHITECTURE.md` — architecture documentation (optional)

### Estimated scope:
- **~40–60 files** to audit and verify tenant-scoped queries
- **~5 new files** (tests, documentation)
- **Effort**: 5–7 days of systematic audit + testing

---

---

## 9. Rollback & Safety Plan

### During Refactoring
- Keep all existing multi-tenant schema in place (no destructive changes)
- Run all tests before deploying
- Have a backup of production database
- Run cross-tenant isolation tests in staging first

### If Issues Found
1. **Data integrity**: Verify no cross-tenant leaks occurred with SQL tests
2. **Revert code**: Rollback API changes to previous version
3. **Restore database**: If any data was written to wrong tenant, restore from backup
4. **Audit access logs**: Check if any cross-tenant access occurred

### Monitoring
- [ ] Alert on queries without tenant context (if possible)
- [ ] Monitor audit logs for anomalies (unusual access patterns)
- [ ] Test cross-tenant blocking regularly (weekly)

---

## 10. SaaS Operations & Future Enhancements

**After SaaS foundation is stable**:

### Multi-Tenant Onboarding
- New facility registration flow
- Domain/subdomain provisioning
- Admin user creation
- Initial staff/resident import (if applicable)

### Billing & Seat Management
- Per-facility pricing tiers
- Seat/user limits per facility
- Usage tracking (residents, storage, API calls)
- Automated billing based on facility usage

### SSO & Identity
- Multi-tenant SSO (SAML, OIDC per facility)
- Facility-specific authentication providers
- API key management per facility

### Operations & Support
- Facility admins can self-serve (reset passwords, manage staff)
- Support portal for cross-tenant issues
- Per-facility backup & restore (user-initiated)
- Tenant-specific data retention policies

### Advanced Features
- Cross-facility reporting (with strict permission controls)
- Tenant-scoped webhooks
- Multi-tenant third-party integrations (Cloudinary, payment processors)
- Conditional RLS for advanced access patterns (e.g., certain staff can see all residents)

### Compliance & Governance
- Each facility has its own HIPAA BAA
- Privacy policy acknowledges multi-tenant architecture  
- Terms of service include tenant data isolation guarantees
- Regular compliance audits (SOC 2, HIPAA)
- Disaster recovery testing per tenant

