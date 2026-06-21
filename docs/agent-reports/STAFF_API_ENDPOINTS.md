# Staff API Endpoints Documentation

Complete reference for staff-facing API routes in Dependable Care Wellness Centre.

## Base URL
All endpoints are relative to: `/api/v1`

## Authentication & Authorization

All endpoints require:
- **Bearer Token**: JWT access token in `Authorization: Bearer <token>` header
- **Permissions**: RBAC enforcement per endpoint (see `PERMISSIONS` in `/src/lib/roles.js`)

## Response Format

### Success Response (2xx)
```json
{
  "data": {...},
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 100,
    "pages": 2
  }
}
```

### Error Response (4xx/5xx)
```json
{
  "error": "Human-readable error message",
  "field": "field_name (optional, for validation errors)"
}
```

## Pagination

Default query parameters for all listing endpoints:
- `limit`: Max records per page (1-200, default 50)
- `offset`: Number of records to skip (default 0)

Response includes: `pagination.total` (overall count), `pagination.pages` (pages at limit size)

---

## Staff Management Endpoints

### List Staff Members
**GET** `/staff`

List all staff members with filtering and pagination.

**Query Parameters:**
- `search` (optional): Search by first name, last name, or email (min 2 chars)
- `role` (optional): Filter by role — one of: `staff`, `manager`, `admin`
- `is_active` (optional): Filter by status — `true` or `false`
- `limit` (optional): Default 50, max 200
- `offset` (optional): Default 0

**Requires:** `PERMISSIONS.STAFF_READ`

**Example Request:**
```bash
GET /staff?search=john&role=staff&limit=25&offset=0
Authorization: Bearer <token>
```

**Example Response:**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "first_name": "John",
      "last_name": "Doe",
      "role": "staff",
      "email": "john@facility.org",
      "phone": "555-0123",
      "license_no": "CNA123456",
      "hire_date": "2023-01-15",
      "is_active": true,
      "created_at": "2023-01-15T10:00:00Z",
      "updated_at": "2023-06-20T14:30:00Z"
    }
  ],
  "pagination": {
    "limit": 25,
    "offset": 0,
    "total": 42,
    "pages": 2
  }
}
```

**Status Codes:**
- `200`: Success
- `400`: Invalid query parameters (e.g., invalid role)
- `401`: Missing/invalid token
- `403`: Permission denied

---

### Create Staff Member
**POST** `/staff`

Create a new staff member and generate user account.

**Requires:** `PERMISSIONS.STAFF_WRITE`

**Request Body:**
```json
{
  "first_name": "Jane",
  "last_name": "Smith",
  "role": "staff",
  "email": "jane@facility.org",
  "password": "SecurePass123!",
  "phone": "555-0124",
  "license_no": "RN987654",
  "hire_date": "2026-06-01"
}
```

**Field Validations:**
- `first_name`, `last_name`: Required, non-empty string
- `role`: Required, one of: `staff`, `manager`, `admin`
- `email`: Required, valid email format, unique per tenant
- `password`: Required, minimum 8 characters recommended
- `phone`: Optional, format checked for basic validity
- `license_no`: Optional, string
- `hire_date`: Optional, DATE format (YYYY-MM-DD)

**Example Response:**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "email": "jane@facility.org",
    "role": "staff"
  }
}
```

**Status Codes:**
- `201`: Staff member created
- `400`: Invalid input (e.g., weak password, invalid role)
- `409`: Email already exists for this tenant
- `422`: Missing required fields
- `403`: Permission denied

---

## Staff Assignments Endpoints

### List Staff Assignments
**GET** `/staff/assignments`

List resident-to-staff assignments (who is assigned to care for whom).

**Query Parameters:**
- `staff_id` (optional): Filter by staff member UUID
- `resident_id` (optional): Filter by resident UUID
- `limit` (optional): Default 50, max 200
- `offset` (optional): Default 0

**Requires:** `PERMISSIONS.STAFF_READ`

**Example Request:**
```bash
GET /staff/assignments?staff_id=550e8400-e29b-41d4-a716-446655440000&limit=50
Authorization: Bearer <token>
```

**Example Response:**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "staff_id": "550e8400-e29b-41d4-a716-446655440000",
      "resident_id": "660e8400-e29b-41d4-a716-446655440003",
      "staff_first_name": "John",
      "staff_last_name": "Doe",
      "staff_role": "staff",
      "resident_first_name": "Alice",
      "resident_last_name": "Johnson",
      "resident_status": "active",
      "assignment_date": "2026-05-01",
      "end_date": null,
      "is_active": true,
      "created_at": "2026-05-01T09:00:00Z"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 12,
    "pages": 1
  }
}
```

**Status Codes:**
- `200`: Success
- `401`: Missing/invalid token
- `403`: Permission denied

---

### Create Staff Assignment
**POST** `/staff/assignments`

Assign a resident to a staff member for care.

**Requires:** `PERMISSIONS.STAFF_WRITE`

**Request Body:**
```json
{
  "staff_id": "550e8400-e29b-41d4-a716-446655440000",
  "resident_id": "660e8400-e29b-41d4-a716-446655440003",
  "assignment_date": "2026-06-01",
  "end_date": null
}
```

**Field Validations:**
- `staff_id`: Required, valid UUID format
- `resident_id`: Required, valid UUID format
- `assignment_date`: Optional, defaults to current date
- `end_date`: Optional, DATE format (YYYY-MM-DD)

**Example Response:**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "staff_id": "550e8400-e29b-41d4-a716-446655440000",
    "resident_id": "660e8400-e29b-41d4-a716-446655440003",
    "assignment_date": "2026-06-01",
    "end_date": null,
    "created_at": "2026-05-18T14:30:00Z"
  }
}
```

**Status Codes:**
- `201`: Assignment created
- `400`: Invalid UUID format
- `404`: Staff member or resident not found
- `409`: Assignment already exists (staff already assigned to resident)
- `422`: Missing required fields
- `403`: Permission denied

---

## Staff Dashboard

### Get Staff Dashboard Summary
**GET** `/staff/dashboard`

Get a personalized dashboard summary for the current staff member.

**Requires:** `PERMISSIONS.STAFF_READ`

**Example Request:**
```bash
GET /staff/dashboard
Authorization: Bearer <token>
```

**Example Response:**
```json
{
  "data": {
    "assignedResidents": 5,
    "pendingProgressNotes": 3,
    "recentIncidents": [
      {
        "id": "770e8400-e29b-41d4-a716-446655440004",
        "resident_id": "660e8400-e29b-41d4-a716-446655440003",
        "incident_date": "2026-05-18",
        "incident_time": "14:30:00",
        "incident_type": "behavioral",
        "first_name": "Alice",
        "last_name": "Johnson"
      }
    ],
    "assignedForToday": [
      {
        "id": "660e8400-e29b-41d4-a716-446655440003",
        "first_name": "Alice",
        "last_name": "Johnson",
        "status": "active",
        "assignment_date": "2026-05-18"
      }
    ]
  }
}
```

**Status Codes:**
- `200`: Success
- `401`: Missing/invalid token
- `403`: Permission denied

---

## Progress Notes Endpoints

### List Progress Notes
**GET** `/staff/progress-notes`

List progress notes filtered by staff member with pagination.

**Query Parameters:**
- `staff_id` (optional): Filter by staff member who authored
- `resident_id` (optional): Filter by resident
- `review_status` (optional): Filter by status — one of: `pending`, `approved`, `rejected`
- `limit` (optional): Default 50, max 200
- `offset` (optional): Default 0

**Requires:** `PERMISSIONS.PROGRESS_NOTES_READ`

**Example Request:**
```bash
GET /staff/progress-notes?staff_id=550e8400-e29b-41d4-a716-446655440000&review_status=pending&limit=25
Authorization: Bearer <token>
```

**Example Response:**
```json
{
  "data": [
    {
      "id": "880e8400-e29b-41d4-a716-446655440005",
      "resident_id": "660e8400-e29b-41d4-a716-446655440003",
      "staff_id": "550e8400-e29b-41d4-a716-446655440000",
      "note_date": "2026-05-18",
      "shift": "day",
      "note_body": {"text": "Resident showed improved mood..."},
      "review_status": "pending",
      "resident_first_name": "Alice",
      "resident_last_name": "Johnson",
      "staff_first_name": "John",
      "staff_last_name": "Doe",
      "created_at": "2026-05-18T10:00:00Z",
      "updated_at": "2026-05-18T10:00:00Z"
    }
  ],
  "pagination": {
    "limit": 25,
    "offset": 0,
    "total": 8,
    "pages": 1
  }
}
```

**Status Codes:**
- `200`: Success
- `400`: Invalid query parameters (e.g., invalid review_status)
- `401`: Missing/invalid token
- `403`: Permission denied

---

## Medications Endpoints

### List Medications
**GET** `/staff/medications`

List medications for assigned residents with pagination.

**Query Parameters:**
- `resident_id` (optional): Filter by resident
- `staff_id` (optional): Filter medications for residents assigned to this staff
- `is_active` (optional): Filter by status — `true` or `false`
- `limit` (optional): Default 50, max 200
- `offset` (optional): Default 0

**Requires:** `PERMISSIONS.RESIDENTS_READ`

**Example Request:**
```bash
GET /staff/medications?resident_id=660e8400-e29b-41d4-a716-446655440003&is_active=true
Authorization: Bearer <token>
```

**Example Response:**
```json
{
  "data": [
    {
      "id": "990e8400-e29b-41d4-a716-446655440006",
      "resident_id": "660e8400-e29b-41d4-a716-446655440003",
      "drug_name": "Sertraline",
      "drug_strength": "50mg",
      "drug_form": "tablet",
      "dosage": "50mg",
      "route": "oral",
      "frequency": "once daily",
      "rx_number": "RX123456",
      "is_active": true,
      "is_controlled_substance": false,
      "is_prn": false,
      "special_instructions": "Take with food",
      "start_date": "2026-04-15",
      "end_date": null,
      "prescriber": "Dr. Smith",
      "pharmacy": "Main Pharmacy",
      "indication": "Depression",
      "created_by": "550e8400-e29b-41d4-a716-446655440000",
      "created_at": "2026-04-15T09:00:00Z",
      "updated_at": "2026-04-15T09:00:00Z",
      "first_name": "Alice",
      "last_name": "Johnson"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 3,
    "pages": 1
  }
}
```

**Status Codes:**
- `200`: Success
- `401`: Missing/invalid token
- `403`: Permission denied

---

### Create Medication Record
**POST** `/staff/medications`

Create a new medication record for a resident.

**Requires:** `PERMISSIONS.RESIDENTS_WRITE`

**Request Body:**
```json
{
  "resident_id": "660e8400-e29b-41d4-a716-446655440003",
  "drug_name": "Sertraline",
  "drug_strength": "50mg",
  "drug_form": "tablet",
  "dosage": "50mg",
  "route": "oral",
  "frequency": "once daily",
  "prescriber": "Dr. Smith",
  "pharmacy": "Main Pharmacy",
  "rx_number": "RX123456",
  "indication": "Depression",
  "start_date": "2026-06-01",
  "is_controlled_substance": false,
  "is_prn": false,
  "special_instructions": "Take with food"
}
```

**Field Validations:**
- `resident_id`: Required, UUID format
- `drug_name`: Required, string
- `dosage`: Required, string
- `route`: Required, one of: `oral`, `sublingual`, `topical`, `injection`, `inhalation`, `transdermal`, `other`
- `frequency`: Required, string
- `prescriber`: Required, string
- `start_date`: Required, DATE format (YYYY-MM-DD)
- Other fields: Optional

**Example Response:**
```json
{
  "data": {
    "id": "990e8400-e29b-41d4-a716-446655440006",
    "resident_id": "660e8400-e29b-41d4-a716-446655440003",
    "drug_name": "Sertraline",
    "dosage": "50mg",
    "route": "oral",
    "frequency": "once daily",
    "start_date": "2026-06-01",
    "created_at": "2026-05-18T14:30:00Z"
  }
}
```

**Status Codes:**
- `201`: Medication created
- `400`: Invalid route or other validation error
- `404`: Resident not found
- `422`: Missing required fields
- `403`: Permission denied

---

## Certifications Endpoints

### List Staff Certifications
**GET** `/staff/certifications`

List staff certifications with pagination.

**Query Parameters:**
- `staff_id` (optional): Filter by staff member
- `certification_type` (optional): Filter by certification type (case-insensitive)
- `limit` (optional): Default 50, max 200
- `offset` (optional): Default 0

**Requires:** `PERMISSIONS.STAFF_READ`

**Example Request:**
```bash
GET /staff/certifications?staff_id=550e8400-e29b-41d4-a716-446655440000&limit=50
Authorization: Bearer <token>
```

**Example Response:**
```json
{
  "data": [
    {
      "id": "aa0e8400-e29b-41d4-a716-446655440007",
      "staff_id": "550e8400-e29b-41d4-a716-446655440000",
      "certification_type": "CPR",
      "certification_name": "CPR/BLS Certification",
      "certificate_no": "CPR123456",
      "issued_date": "2024-01-15",
      "expiry_date": "2026-01-15",
      "verified_date": "2024-01-16",
      "verified_by_first_name": "Jane",
      "verified_by_last_name": "Smith",
      "notes": "Valid and current",
      "first_name": "John",
      "last_name": "Doe",
      "created_at": "2024-01-15T10:00:00Z",
      "updated_at": "2024-01-15T10:00:00Z"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 2,
    "pages": 1
  }
}
```

**Status Codes:**
- `200`: Success
- `401`: Missing/invalid token
- `403`: Permission denied

---

### Add Staff Certification
**POST** `/staff/certifications`

Add a new certification record for a staff member.

**Requires:** `PERMISSIONS.STAFF_WRITE`

**Request Body:**
```json
{
  "staff_id": "550e8400-e29b-41d4-a716-446655440000",
  "certification_type": "CPR",
  "certification_name": "CPR/BLS Certification",
  "certificate_no": "CPR123456",
  "issued_date": "2026-01-15",
  "expiry_date": "2028-01-15",
  "notes": "Valid and current"
}
```

**Field Validations:**
- `staff_id`: Required, UUID format
- `certification_type`: Required, string
- `issued_date`: Required, DATE format (YYYY-MM-DD)
- Other fields: Optional

**Example Response:**
```json
{
  "data": {
    "id": "aa0e8400-e29b-41d4-a716-446655440007",
    "staff_id": "550e8400-e29b-41d4-a716-446655440000",
    "certification_type": "CPR",
    "certification_name": "CPR/BLS Certification",
    "issued_date": "2026-01-15",
    "expiry_date": "2028-01-15",
    "created_at": "2026-05-18T14:30:00Z"
  }
}
```

**Status Codes:**
- `201`: Certification added
- `404`: Staff member not found
- `422`: Missing required fields
- `403`: Permission denied

---

## Incidents Endpoints

### List Incidents
**GET** `/incidents`

List incident reports with filtering and pagination.

**Query Parameters:**
- `resident_id` (optional): Filter by resident
- `incident_type` (optional): Filter by type — one of: `accident`, `medication_error`, `complaint`, `behavioral`, `suspected_abuse_neglect`
- `limit` (optional): Default 50, max 200
- `offset` (optional): Default 0

**Requires:** `PERMISSIONS.SAFETY_READ`

**Example Request:**
```bash
GET /incidents?resident_id=660e8400-e29b-41d4-a716-446655440003&limit=25
Authorization: Bearer <token>
```

**Example Response:**
```json
{
  "data": [
    {
      "id": "bb0e8400-e29b-41d4-a716-446655440008",
      "resident_id": "660e8400-e29b-41d4-a716-446655440003",
      "incident_date": "2026-05-18",
      "incident_time": "14:30:00",
      "incident_type": "behavioral",
      "location": "Common Area",
      "completed_by_name": "John Doe",
      "first_name": "Alice",
      "last_name": "Johnson",
      "staff_first_name": "John",
      "staff_last_name": "Doe",
      "created_at": "2026-05-18T15:00:00Z",
      "updated_at": "2026-05-18T15:00:00Z"
    }
  ],
  "pagination": {
    "limit": 25,
    "offset": 0,
    "total": 5,
    "pages": 1
  }
}
```

**Status Codes:**
- `200`: Success
- `400`: Invalid query parameters
- `401`: Missing/invalid token
- `403`: Permission denied

---

### Create Incident Report
**POST** `/incidents`

Create a new incident report.

**Requires:** `PERMISSIONS.SAFETY_WRITE`

**Request Body:**
```json
{
  "resident_id": "660e8400-e29b-41d4-a716-446655440003",
  "incident_date": "2026-05-18",
  "incident_time": "14:30:00",
  "incident_types": ["behavioral"],
  "location": "Common Area",
  "witnessed": true,
  "witnessed_by": "Staff Member Name",
  "incident_details": "Resident became agitated during group activity...",
  "staff_actions_taken": "Moved resident to quiet area, offered PRN medication...",
  "follow_up_plan": "Monitor closely, follow up with physician...",
  "completed_by_name": "John Doe",
  "notifications": [
    {
      "party": "Parent/Guardian",
      "was_notified": true,
      "contact_name": "Jane Johnson",
      "notified_date": "2026-05-18",
      "notified_time": "15:00:00"
    }
  ]
}
```

**Field Validations:**
- `resident_id`: Required, UUID format
- `incident_date`: Required, DATE format
- `incident_time`: Required, TIME format
- `incident_types`: Required, array of types
- `incident_details`: Required, string
- `staff_actions_taken`: Required, string
- Other fields: Optional

**Example Response:**
```json
{
  "id": "bb0e8400-e29b-41d4-a716-446655440008",
  "status": "pending",
  "message": "Incident report submitted for approval"
}
```

**Status Codes:**
- `201`: Incident created
- `400`: Invalid incident_type or other validation error
- `404`: Resident not found
- `422`: Missing required fields
- `403`: Permission denied

---

## Error Handling

All endpoints return consistent error responses:

### Common Error Codes

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Bad Request | Invalid query parameters or request format |
| 401 | Unauthorized | Missing, expired, or invalid bearer token |
| 403 | Forbidden | Authenticated but insufficient permissions |
| 404 | Not Found | Resource does not exist |
| 409 | Conflict | Resource already exists (e.g., duplicate email) |
| 422 | Unprocessable Entity | Missing or invalid required fields |
| 429 | Too Many Requests | Rate limit exceeded (sensitive endpoints) |
| 500 | Internal Server Error | Server error |

### Error Response Format
```json
{
  "error": "Error description",
  "field": "field_name (optional)"
}
```

---

## Rate Limiting

Sensitive endpoints (staff creation, deactivation) implement rate limiting:
- **Default**: 10 requests per 60 seconds per user
- **Response**: `429 Too Many Requests` with `Retry-After` header

---

## Audit Logging

All endpoints automatically log:
- User ID and role
- Action performed (read, create, update, delete)
- Affected resource and ID
- Timestamp and tenant context

Audit logs are stored in `audit_log.events` and queryable via `/admin/audit-log`.

---

## Security Considerations

1. **Authentication**: All endpoints require valid JWT bearer token
2. **Authorization**: RBAC enforced per endpoint and operation
3. **Tenant Isolation**: Row-level security (RLS) enforces multi-tenant data separation
4. **Input Validation**: All inputs validated and sanitized
5. **Encryption**: PHI fields encrypted at rest (AES-256-GCM)
6. **Audit Trail**: All PHI access logged and auditable
7. **HIPAA Compliance**: Follows 42 CFR Part 2 standards

---

## Migration: Add staff_assignments Table

Run migration to enable staff assignment endpoints:

```bash
psql -U postgres -d dcllc < db/migrations/0015_staff_assignments.sql
```

This creates:
- `care.staff_assignments` table
- Indexes for performance
- RLS policies for multi-tenant isolation
- Audit trigger for `updated_at`
