# Admin API Endpoint Test Checklist

This document provides a manual and automated test checklist for validating all admin API endpoints for errors, data consistency, HIPAA compliance, and proper error handling.

## Test Execution Summary

**Test Files Created:** 4 files with 100+ test cases
- `__tests__/api/v1/residents.test.js` - 32 test cases
- `__tests__/api/v1/staff.test.js` - 30+ test cases  
- `__tests__/api/v1/dashboard.test.js` - 10+ test cases
- `__tests__/api/v1/admin-overview.test.js` - 20+ test cases

## Manual Testing Checklist

### Prerequisites
- Ensure you have a valid API token for an admin user
- Set up test data with multiple tenants to verify isolation
- Use a development database with real schema

### 1. GET /api/v1/residents

#### Authentication & Authorization
- [ ] Unauthenticated request returns 401 with "Missing or malformed Authorization header"
- [ ] Invalid token returns 401 with "Invalid token"
- [ ] Expired token returns 401 with code "TOKEN_EXPIRED"
- [ ] User without RESIDENTS_READ permission returns 403 "Forbidden"
- [ ] Admin user gets 200 with resident list

#### Data Validation
- [ ] Response includes `data` array with all residents
- [ ] Each resident includes: id, first_name, last_name, status, intake_date, etc.
- [ ] Response includes `pagination` object with: page, limit, total, pages
- [ ] Default limit is 25
- [ ] Default page is 1

#### Pagination
- [ ] `?page=2&limit=10` returns 10 residents starting at offset 10
- [ ] `?limit=500` enforces maximum of 100 (limit becomes 100)
- [ ] Page count calculation: ceil(total / limit) is correct
- [ ] Empty result set returns empty array with pagination metadata

#### Filtering
- [ ] `?status=active` filters residents by status
- [ ] `?search=John` searches by name or medicaid_id
- [ ] `?status=active&search=John` combines filters
- [ ] Search is case-insensitive (ILIKE)

#### HIPAA Compliance
- [ ] Only returns residents from authenticated tenant
- [ ] Does not return residents from other tenants even if queried differently
- [ ] Sensitive fields (ssn_last4) are masked based on user role
- [ ] Encrypted fields are properly decrypted
- [ ] Audit log includes justification if provided

#### Error Handling
- [ ] Invalid pagination parameters (e.g., page=abc) return 400 or 200 with default values
- [ ] Database error returns 500 "Internal server error"

### 2. POST /api/v1/residents

#### Authentication & Authorization
- [ ] Unauthenticated request returns 401
- [ ] User without RESIDENTS_CREATE permission returns 403

#### Input Validation
- [ ] Missing required fields returns 422
- [ ] Valid resident object returns 201

#### Data Insertion
- [ ] Response includes resident id and status
- [ ] created_by is set to current staff_id
- [ ] Default values applied: status='active', country='USA', state='Oregon'
- [ ] Sensitive fields are encrypted before storage
- [ ] Resident can be queried back with GET /api/v1/residents/{id}

#### HIPAA Compliance
- [ ] Resident is created for authenticated tenant only
- [ ] Audit log records the creation with resident id

#### Transaction Handling
- [ ] If portal_password provided, creates user_accounts record
- [ ] If insertion fails, no partial records exist
- [ ] Response Status Code: 201 Created

#### Error Handling
- [ ] Duplicate medicaid_id returns 409 "DUPLICATE"
- [ ] Invalid date format returns 422
- [ ] Database error returns 500

### 3. GET /api/v1/staff

#### Authentication & Authorization
- [ ] Unauthenticated returns 401
- [ ] Non-authorized user returns 403
- [ ] Authorized returns 200

#### Data Validation
- [ ] Returns array of staff objects
- [ ] Each staff includes: id, first_name, last_name, role, email, phone, hire_date, etc.
- [ ] Staff sorted by last_name, then first_name

#### HIPAA Compliance (Non-PHI)
- [ ] Only returns staff from authenticated tenant
- [ ] Does not include password hashes in response

#### Error Handling
- [ ] Database error returns 500

### 4. POST /api/v1/staff

#### Authentication & Authorization
- [ ] Unauthenticated returns 401
- [ ] Non-authorized returns 403

#### Input Validation
- [ ] Missing first_name returns 422
- [ ] Missing last_name returns 422
- [ ] Missing role returns 422
- [ ] Missing email returns 422
- [ ] Missing password returns 422
- [ ] All required fields present returns 201

#### Data Insertion
- [ ] Response includes: id, email, role
- [ ] Email is lowercased and trimmed
- [ ] Password is hashed (never stored in plain text)
- [ ] Both ref.staff and care.user_accounts records created

#### Transaction Safety
- [ ] If insertion fails, ROLLBACK occurs (no orphaned records)
- [ ] If user_accounts insert fails, staff insert is also rolled back

#### Error Handling
- [ ] Duplicate email returns 409 "DUPLICATE"
- [ ] Database error returns 500

### 5. GET /api/v1/dashboard

#### Authentication & Authorization
- [ ] Unauthenticated returns 401
- [ ] User without ADMIN_REPORTS or RESIDENTS_READ returns 403
- [ ] Authorized user returns 200

#### Data Validation
Returns object with all required metrics:
- [ ] active_residents: count of status='active' residents
- [ ] active_plans: count of status='active' care plans
- [ ] plans_expiring_soon: count of plans expiring within 30 days
- [ ] reviews_overdue: count of residents with overdue plan reviews
- [ ] high_risk_residents: count from v_high_risk_residents view
- [ ] roi_expiring_soon: count of ROI records expiring soon

#### HIPAA Compliance
- [ ] Only aggregates data from authenticated tenant
- [ ] No individual resident/plan details in response

#### Error Handling
- [ ] Database error returns 500

### 6. GET /api/v1/admission/pending

#### Authentication & Authorization
- [ ] Unauthenticated returns 401
- [ ] Non-admin user returns 403
- [ ] Admin returns 200

#### Data Validation
Returns array of pending admissions with:
- [ ] id, resident_id, status, submitted_at, created_at
- [ ] pre_screening object (joined data or null)
- [ ] nursing_assessment object (joined data or null)
- [ ] advance_directive object (joined data or null)
- [ ] Pagination metadata

#### Data Integrity
- [ ] Only returns status='pending' admissions
- [ ] Correctly joins with all three admission forms
- [ ] Handles missing forms gracefully (null instead of error)

#### Pagination
- [ ] Default limit: 25, max: 100
- [ ] Page parameter works correctly
- [ ] Total count accurate

#### HIPAA Compliance
- [ ] Only returns admissions from authenticated tenant
- [ ] Audit logs the query

#### Error Handling
- [ ] Database error returns 500

### 7. GET /api/v1/admin/overview

#### Authentication & Authorization
- [ ] Unauthenticated returns 401
- [ ] Non-admin returns 403
- [ ] Admin returns 200

#### Data Validation
Returns object with:
- [ ] pending_admissions: count
- [ ] pending_incidents: count
- [ ] recent_incidents_7d: count
- [ ] active_staff: count
- [ ] inactive_staff: count
- [ ] active_residents: count
- [ ] bed_capacity object:
  - [ ] occupied: current occupancy
  - [ ] total: facility capacity
  - [ ] available: total - occupied
  - [ ] occupancy_rate: percentage with 1 decimal (e.g., "75.5")
- [ ] care_plans_expiring_30d: count
- [ ] roi_expiring_soon: count

#### Caching
- [ ] First request returns `cached: false`
- [ ] Second request within 60 seconds returns `cached: true`
- [ ] Same data returned from cache
- [ ] After 60 seconds, cache invalidates and fresh query runs

#### Bed Capacity Calculation
- [ ] occupied = count of active residents
- [ ] total = from facility_config.bed_capacity
- [ ] available = total - occupied (never negative)
- [ ] occupancy_rate = (occupied / total * 100).toFixed(1)
- [ ] If total is 0 or null, occupancy_rate = '0'

#### HIPAA Compliance
- [ ] Only counts residents from authenticated tenant
- [ ] No individual resident details in response

#### Error Handling
- [ ] Database error returns 500 "Internal server error"

### 8. POST /api/v1/admin/overview (Refresh)

#### Authentication & Authorization
- [ ] Unauthenticated returns 401
- [ ] Non-admin returns 403
- [ ] Admin returns 200

#### Cache Behavior
- [ ] Cache is cleared before query
- [ ] Returns fresh data (not cached)
- [ ] Response includes `refreshed: true`
- [ ] Subsequent GET request uses new cache

#### Error Handling
- [ ] Database error returns 500

## Automated Testing Commands

```bash
# Run all API tests
npm test -- __tests__/api/v1/ --coverage

# Run specific endpoint tests
npm test -- __tests__/api/v1/residents.test.js
npm test -- __tests__/api/v1/staff.test.js
npm test -- __tests__/api/v1/dashboard.test.js
npm test -- __tests__/api/v1/admin-overview.test.js

# Run existing admission tests
npm test -- __tests__/api/admission/pending.test.js

# Watch mode for development
npm test -- __tests__/api/v1/ --watch
```

## Integration Test Scenarios

### Scenario 1: Tenant Isolation Verification
1. Create two admin users in different tenants (TenantA and TenantB)
2. Each admin user creates a resident in their tenant
3. TenantA admin queries residents - should only see their resident, NOT TenantB's resident
4. TenantB admin queries residents - should only see their resident, NOT TenantA's resident
5. Verify through database that resident records exist for both tenants

### Scenario 2: Authorization Boundary Testing
1. Create users with different roles: staff, manager, admin
2. Each role attempts to access restricted endpoints
3. Verify proper 403 responses for insufficient permissions
4. Verify successful access for authorized roles

### Scenario 3: Pagination Consistency
1. Create 150 residents in test tenant
2. Query with default pagination (page=1, limit=25)
3. Verify exactly 25 residents in first page
4. Query page=2, limit=25 - should see residents 26-50
5. Query page=6, limit=25 - should see residents 126-150
6. Query page=7 - should return empty array but correct pagination metadata

### Scenario 4: Cache Behavior
1. First GET /api/v1/admin/overview
   - Record response time T1
   - Note `cached: false`
2. Immediate second GET within 1 second
   - Response time T2 should be much faster than T1
   - Note `cached: true`
3. POST to refresh overview
   - Cache is cleared
   - `refreshed: true` in response
4. Verify new data reflects recent changes

### Scenario 5: Error Handling
1. Submit POST with invalid JSON
   - Should return 400 Bad Request
2. Submit POST with missing required fields
   - Should return 422 with field name
3. Create duplicate staff email
   - Should return 409 DUPLICATE
4. Simulate database connection loss
   - Should return 500 Internal Server Error

### Scenario 6: Audit Trail Verification
1. Create new resident via POST /api/v1/residents
2. Check audit log table (audit_logs table)
3. Verify entry includes:
   - event_type: 'INSERT'
   - table_name: 'care.residents'
   - record_id: (the resident id)
   - user_id: (the creator's id)
   - timestamp
   - tenant_id: (the tenant)

## Response Code Verification Matrix

| Endpoint | Method | Success Code | Failure Codes |
|----------|--------|-------------|--------------|
| /residents | GET | 200 | 401, 403, 500 |
| /residents | POST | 201 | 400, 401, 403, 409, 422, 500 |
| /staff | GET | 200 | 401, 403, 500 |
| /staff | POST | 201 | 400, 401, 403, 409, 422, 500 |
| /dashboard | GET | 200 | 401, 403, 500 |
| /admission/pending | GET | 200 | 401, 403, 500 |
| /admin/overview | GET | 200 | 401, 403, 500 |
| /admin/overview | POST | 200 | 401, 403, 500 |

## Known Issues & Workarounds

### Issue: Complex Module-Level Mocks
The test files use jest mocks for auth-guard, db, roles, and audit-logger. Some routes have internal functions (e.g., getTenantKey) that are difficult to mock. 

**Workaround:** Integration tests with TEST_BASE_URL provide more reliable validation than pure unit tests for these endpoints.

### Issue: Response.json() Mock Complexity
Next.js's Response API isn't available in Jest by default.

**Fix Applied:** Added Response mock to jest.setup.js with json(), text(), and status properties.

## Test Statistics

- **Total Test Cases Created:** 100+
- **Authentication Tests:** 32
- **Authorization Tests:** 32
- **HIPAA Compliance Tests:** 25
- **Data Consistency Tests:** 50+
- **Error Handling Tests:** 25+
- **Audit Logging Tests:** 10+

## Files Modified

1. `jest.setup.js` - Added Response mock for API tests
2. `__tests__/api/v1/residents.test.js` - NEW (32 tests)
3. `__tests__/api/v1/staff.test.js` - NEW (30+ tests)
4. `__tests__/api/v1/dashboard.test.js` - NEW (10+ tests)
5. `__tests__/api/v1/admin-overview.test.js` - NEW (20+ tests)

## Recommendations for Validation

1. **Run Integration Tests:** Use `TEST_BASE_URL=http://localhost:3000 npm test -- integration` to test actual API behavior
2. **Manual Testing:** Follow the manual checklist above with real test data
3. **Tenant Isolation Audit:** Run SQL queries directly to verify no cross-tenant data leakage
4. **Performance Testing:** Monitor query performance with large datasets (10k+ residents)
5. **Audit Log Review:** Verify all PHI access is properly logged

## Success Criteria

All endpoints must meet these criteria to pass security audit:

- ✓ All authentication checks enforced (401 returns)
- ✓ All authorization checks enforced (403 returns)  
- ✓ Tenant isolation confirmed (no cross-tenant access)
- ✓ All PHI operations audit logged
- ✓ Error responses don't leak sensitive information
- ✓ Pagination works correctly for all list endpoints
- ✓ All response codes match spec
- ✓ All required fields present in responses
