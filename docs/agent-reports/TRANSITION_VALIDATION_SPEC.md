# Care Plan Status Transition Validation

## Overview

This implementation enforces a state machine for care plan status transitions to prevent invalid state changes and maintain data integrity.

## Valid State Transitions

```
draft → active (when approved)
draft → archived (discard draft plan)

active → expiring (automatic when within 30 days of review_date)
active → expired (automatic when past review_date)
active → archived (manually archive active plan)

expiring → expired (automatic when review_date passes)
expiring → active (review and renewal of expiring plan)

expired → archived (archive expired plan)

archived → [NONE] (terminal state - no transitions allowed)
```

## Invalid Transitions (Rejected with Error 422)

| Invalid Transition | Reason | Error Message |
|---|---|---|
| `any → draft` | Cannot go back to draft state | Cannot transition to draft — care plans cannot be reset to draft state |
| `expired → active` | Must create a new plan for renewal | Cannot renew expired care plans — create a new care plan instead |
| `archived → anything` | Archived is terminal state | Cannot modify archived care plans — archived status is final |
| `same → same` | Not a transition | Status is already [status] |

## Implementation Details

### Files Created

1. **src/lib/care-plan-transitions.js**
   - `isValidTransition(currentStatus, newStatus)` - Core validation function
   - `getTransitionErrorMessage(currentStatus, newStatus)` - User-friendly error messages
   - `getAllowedTransitions(status)` - Query allowed target states
   - Constants for status values and descriptions

2. **src/lib/care-plan-transitions.test.js**
   - Comprehensive unit test suite
   - 12 test cases covering valid and invalid transitions
   - Error message validation

### Files Modified

**src/app/api/v1/care-plans/[id]/route.js**
- Added import for transition validation functions
- Enhanced PATCH endpoint with pre-update validation
- Returns 422 with descriptive error for invalid transitions
- Fetches current care plan status before allowing update

## API Usage Examples

### Valid Request (draft → active)
```bash
PATCH /api/v1/care-plans/cp-123
Content-Type: application/json

{
  "version": 1,
  "status": "active"
}
```

Response (200 OK):
```json
{
  "data": {
    "id": "cp-123",
    "status": "active",
    "version": 2,
    "updated_at": "2026-05-27T12:34:56Z",
    "resident_id": "res-456"
  }
}
```

### Invalid Request (expired → active)
```bash
PATCH /api/v1/care-plans/cp-123
Content-Type: application/json

{
  "version": 1,
  "status": "active"
}
```

Response (422 Unprocessable Entity):
```json
{
  "error": "Cannot renew expired care plans — create a new care plan instead"
}
```

### Invalid Request (archived → anything)
```bash
PATCH /api/v1/care-plans/cp-123
Content-Type: application/json

{
  "version": 1,
  "status": "active"
}
```

Response (422 Unprocessable Entity):
```json
{
  "error": "Cannot modify archived care plans — archived status is final"
}
```

## Testing

All 12 test cases pass validation:

✓ Valid transitions (8 cases):
- draft → active
- draft → archived
- active → expiring
- active → expired
- active → archived
- expiring → expired
- expiring → active
- expired → archived

✓ Invalid transitions (4 cases):
- active → draft (backward)
- expired → active (must create new)
- archived → active (terminal)
- same → same (not a transition)

## State Machine Diagram

```
                 ┌─────────────┐
                 │   draft     │
                 └─────────────┘
                /              \
               /                \
            active           archived
              |                  
              ├─ expiring        
              |     |             
              |     └─ expired ──┘
              |          
              └──────────┘
```

## Enforcement Points

1. **Pre-Update Validation** - Checked before any database update
2. **Clear Error Messages** - Users understand why transition failed
3. **Allowed Transitions Query** - Clients can determine next valid states
4. **Audit Trail** - All state changes logged through AuditLogger

## Migration Path for Expired Plans

Users attempting to renew an expired plan must:
1. Create a new care plan (POST /api/v1/care-plans)
2. Copy relevant data from expired plan as needed
3. Archive the expired plan (expired → archived)

This ensures proper documentation and prevents confusion about which plan is current.
