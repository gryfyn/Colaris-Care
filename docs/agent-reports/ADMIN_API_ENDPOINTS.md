# Admin API Endpoints Security Documentation

This document outlines all API endpoints used by the admin interface, their authentication requirements, and permission checks.

## Authorization Audit Results

All admin API endpoints now enforce:
1. **Authentication**: All routes check for valid Bearer token via `authenticate()`
2. **Authorization**: All routes use `authorize()` with specific PERMISSIONS constants
3. **Role-Based Access Control**: Permissions tied to ROLES.ADMIN, ROLES.MANAGER, ROLES.STAFF via PERMISSIONS constants
4. **Consistent Error Handling**: All routes use `handleError()` for uniform HTTP status codes

---

## Staff Management Endpoints

### GET /api/v1/staff
**Purpose**: List all staff members for the facility
**Authentication**: Required (Bearer token)
**Permission**: `PERMISSIONS.STAFF_READ`
**Required Roles**: Admin, Manager, Staff
**Status Code**: 
- 200: Success
- 401: Missing/invalid token
- 403: Insufficient permissions

### POST /api/v1/staff
**Purpose**: Create new staff account and user login credentials
**Authentication**: Required (Bearer token)
**Permission**: `PERMISSIONS.STAFF_WRITE`
**Required Roles**: Admin, Manager
**Request Body**:
```json
{
  "first_name": "string (required)",
  "last_name": "string (required)",
  "role": "string (required)",
  "license_no": "string (optional)",
  "email": "string (required)",
  "phone": "string (optional)",
  "password": "string (required)"
}
```
**Status Code**:
- 201: Created
- 401: Missing/invalid token
- 403: Insufficient permissions
- 422: Invalid/missing required fields

### PATCH /api/v1/staff/[id]/deactivate
**Purpose**: Deactivate staff member and revoke all access
**Authentication**: Required (Bearer token)
**Permission**: `PERMISSIONS.STAFF_DEACTIVATE`
**Required Roles**: Admin only
**Status Code**:
- 200: Success
- 401: Missing/invalid token
- 403: Insufficient permissions

---

## Incident Report Management

### POST /api/v1/incidents
**Purpose**: Create incident report
**Authentication**: Required (Bearer token)
**Permission**: `PERMISSIONS.SAFETY_WRITE`
**Required Roles**: Staff, Manager, Admin
**Status Code**:
- 201: Created
- 401: Missing/invalid token
- 403: Insufficient permissions
- 422: Invalid/missing required fields

### GET /api/v1/incidents
**Purpose**: List all incident reports for review
**Authentication**: Required (Bearer token)
**Permission**: `PERMISSIONS.SAFETY_READ`
**Required Roles**: Staff, Manager, Admin
**Status Code**:
- 200: Success
- 401: Missing/invalid token
- 403: Insufficient permissions

### PATCH /api/v1/incidents/[id]/review
**Purpose**: Review and approve/reject incident report
**Authentication**: Required (Bearer token)
**Permission**: `PERMISSIONS.SAFETY_WRITE`
**Required Roles**: Manager, Admin (for review authority)
**Request Body**:
```json
{
  "status": "approved|rejected (required)",
  "notes": "string (optional)"
}
```
**Status Code**:
- 200: Success
- 401: Missing/invalid token
- 403: Insufficient permissions
- 404: Incident not found
- 422: Invalid status value

---

## Drug Disposal Record Management

### POST /api/v1/drug-disposal
**Purpose**: Create drug disposal record
**Authentication**: Required (Bearer token)
**Permission**: `PERMISSIONS.SAFETY_WRITE`
**Required Roles**: Staff, Manager, Admin
**Status Code**:
- 201: Created
- 401: Missing/invalid token
- 403: Insufficient permissions
- 422: Invalid/missing required fields

### GET /api/v1/drug-disposal
**Purpose**: List all drug disposal records for review
**Authentication**: Required (Bearer token)
**Permission**: `PERMISSIONS.SAFETY_READ`
**Required Roles**: Staff, Manager, Admin
**Status Code**:
- 200: Success
- 401: Missing/invalid token
- 403: Insufficient permissions

### PATCH /api/v1/drug-disposal/[id]/review
**Purpose**: Review and approve/reject drug disposal record
**Authentication**: Required (Bearer token)
**Permission**: `PERMISSIONS.SAFETY_WRITE`
**Required Roles**: Manager, Admin (for review authority)
**Request Body**:
```json
{
  "status": "approved|rejected (required)",
  "notes": "string (optional)"
}
```
**Status Code**:
- 200: Success
- 401: Missing/invalid token
- 403: Insufficient permissions
- 404: Record not found
- 422: Invalid status value

---

## Evacuation Drill Management

### POST /api/v1/evacuation-drills
**Purpose**: Create evacuation drill record
**Authentication**: Required (Bearer token)
**Permission**: `PERMISSIONS.SAFETY_WRITE`
**Required Roles**: Staff, Manager, Admin
**Status Code**:
- 201: Created
- 401: Missing/invalid token
- 403: Insufficient permissions
- 422: Invalid/missing required fields

### GET /api/v1/evacuation-drills
**Purpose**: List all evacuation drill records for review
**Authentication**: Required (Bearer token)
**Permission**: `PERMISSIONS.SAFETY_READ`
**Required Roles**: Staff, Manager, Admin
**Status Code**:
- 200: Success
- 401: Missing/invalid token
- 403: Insufficient permissions

### PATCH /api/v1/evacuation-drills/[id]/review
**Purpose**: Review and approve/reject evacuation drill record
**Authentication**: Required (Bearer token)
**Permission**: `PERMISSIONS.SAFETY_WRITE`
**Required Roles**: Manager, Admin (for review authority)
**Request Body**:
```json
{
  "status": "approved|rejected (required)",
  "notes": "string (optional)"
}
```
**Status Code**:
- 200: Success
- 401: Missing/invalid token
- 403: Insufficient permissions
- 404: Record not found
- 422: Invalid status value

---

## Dashboard & Analytics

### GET /api/v1/dashboard
**Purpose**: Get facility dashboard metrics
**Authentication**: Required (Bearer token)
**Permission**: `PERMISSIONS.ADMIN_REPORTS` OR `PERMISSIONS.RESIDENTS_READ`
**Required Roles**: Staff, Manager, Admin
**Status Code**:
- 200: Success
- 401: Missing/invalid token
- 403: Insufficient permissions

---

## Audit Log Access

### GET /api/v1/admin/audit-log
**Purpose**: Access audit trail of all PHI access and modifications
**Authentication**: Required (Bearer token)
**Permission**: `PERMISSIONS.ADMIN_AUDIT_READ`
**Required Roles**: Admin, Manager
**Query Parameters**:
- `residentId` (optional): Filter by resident
- `actorId` (optional): Filter by staff member
- `eventType` (optional): Filter by event type
- `from` (optional): Start date/time
- `to` (optional): End date/time
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 50, max: 200)
**Status Code**:
- 200: Success
- 401: Missing/invalid token
- 403: Insufficient permissions

---

## Resident Management (Admin-Related)

### GET /api/v1/residents
**Purpose**: List residents (staff can see only their facility's residents)
**Authentication**: Required (Bearer token)
**Permission**: `PERMISSIONS.RESIDENTS_READ` OR `PERMISSIONS.RESIDENTS_READ_OWN`
**Required Roles**: Staff, Manager, Admin
**Tenant Isolation**: Enforced via `withTenantClient()`

### POST /api/v1/residents
**Purpose**: Create new resident record
**Authentication**: Required (Bearer token)
**Permission**: `PERMISSIONS.RESIDENTS_CREATE`
**Required Roles**: Manager, Admin
**Tenant Isolation**: Enforced via `withTenantClient()`

### GET /api/v1/residents/[id]
**Purpose**: View resident detail record
**Authentication**: Required (Bearer token)
**Permission**: `PERMISSIONS.RESIDENTS_READ` OR `PERMISSIONS.RESIDENTS_READ_OWN`
**Required Roles**: Staff, Manager, Admin
**Tenant Isolation**: Enforced via `withTenantClient()`

### PATCH /api/v1/residents/[id]
**Purpose**: Update resident information
**Authentication**: Required (Bearer token)
**Permission**: `PERMISSIONS.RESIDENTS_UPDATE`
**Required Roles**: Manager, Admin
**Tenant Isolation**: Enforced via `withTenantClient()`

### DELETE /api/v1/residents/[id]
**Purpose**: Soft-delete resident record
**Authentication**: Required (Bearer token)
**Permission**: `PERMISSIONS.RESIDENTS_DELETE`
**Required Roles**: Admin only
**Tenant Isolation**: Enforced via `withTenantClient()`

---

## Security Patterns

### Authentication Header
All requests must include:
```
Authorization: Bearer <JWT_TOKEN>
```

### Token Validation
- Bearer token is verified using `authenticate()` from `@/lib/auth-guard.js`
- Returns 401 with error message if invalid/expired
- Token contains: `sub`, `staffId`, `tenantId`, `role`, `jti`

### Authorization Pattern
```javascript
if (!authorize(user.role, PERMISSIONS.PERMISSION_NAME)) {
  return Response.json({ error: 'Forbidden: description' }, { status: 403 });
}
```

### Tenant Isolation
All PHI (Protected Health Information) queries use:
```javascript
await withTenantClient(user.tenantId, user.staffId, async (client) => {
  // All queries within this closure are tenant-isolated
});
```

### Error Responses
All endpoints use `handleError()` for consistent error formatting:
- 401: Authentication failed (invalid/expired token)
- 403: Authorization failed (insufficient permissions)
- 404: Resource not found
- 409: Conflict (optimistic locking, duplicate records)
- 422: Validation error (invalid input)
- 500: Internal server error

---

## Audit Logging

All admin operations are logged via `AuditLogger`:
- Staff creation/deactivation
- Incident report creation/review
- Drug disposal creation/review
- Evacuation drill creation/review
- Resident creation/modification/deletion
- Audit log access

Logs include:
- Actor (staff member) ID
- Action type
- Resource affected
- Timestamp
- IP address
- PHI access indicator

---

## Recommendations

1. All endpoints now use consistent PERMISSIONS constants instead of hardcoded role arrays
2. All error messages follow pattern: "Forbidden: [description of required permission]"
3. All routes use `handleError()` for uniform error handling
4. All routes with JSON parsing include input validation before database operations
5. All PHI access is logged and tenant-isolated
6. Review endpoints require SAFETY_WRITE permission (Manager/Admin level)

---

## Endpoint Summary Table

| Endpoint | Method | Auth | Permission | Roles |
|----------|--------|------|------------|-------|
| /staff | GET | Yes | STAFF_READ | Staff+ |
| /staff | POST | Yes | STAFF_WRITE | Manager+ |
| /staff/[id]/deactivate | PATCH | Yes | STAFF_DEACTIVATE | Admin |
| /incidents | GET | Yes | SAFETY_READ | Staff+ |
| /incidents | POST | Yes | SAFETY_WRITE | Staff+ |
| /incidents/[id]/review | PATCH | Yes | SAFETY_WRITE | Manager+ |
| /drug-disposal | GET | Yes | SAFETY_READ | Staff+ |
| /drug-disposal | POST | Yes | SAFETY_WRITE | Staff+ |
| /drug-disposal/[id]/review | PATCH | Yes | SAFETY_WRITE | Manager+ |
| /evacuation-drills | GET | Yes | SAFETY_READ | Staff+ |
| /evacuation-drills | POST | Yes | SAFETY_WRITE | Staff+ |
| /evacuation-drills/[id]/review | PATCH | Yes | SAFETY_WRITE | Manager+ |
| /dashboard | GET | Yes | ADMIN_REPORTS or RESIDENTS_READ | Staff+ |
| /admin/audit-log | GET | Yes | ADMIN_AUDIT_READ | Manager+ |
| /residents | GET | Yes | RESIDENTS_READ | Staff+ |
| /residents | POST | Yes | RESIDENTS_CREATE | Manager+ |
| /residents/[id] | GET | Yes | RESIDENTS_READ | Staff+ |
| /residents/[id] | PATCH | Yes | RESIDENTS_UPDATE | Manager+ |
| /residents/[id] | DELETE | Yes | RESIDENTS_DELETE | Admin |

Legend: Staff+ = Staff and above (Manager, Admin); Manager+ = Manager and above (Admin)
