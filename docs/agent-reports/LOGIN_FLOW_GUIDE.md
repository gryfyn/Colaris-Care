# Complete Login Flow Guide

## System Architecture

### 1. **Authentication & Authorization**
- **JWT tokens** (RS256) stored in localStorage
- **Access tokens** expire in 15 minutes
- **Refresh tokens** stored in secure HTTP-only cookies
- **Redis** (with in-memory fallback) stores refresh token state

### 2. **User Roles & Routes**
```
Admin/Manager/SuperAdmin → Redirected to /admin
Staff/Other Roles → Redirected to /staff
Unauthenticated → Redirected to /login (root /)
```

## Complete Login Flow

### Step 1: User Visits Application
```
User opens http://localhost:3000
↓
Root layout loads with AuthProvider
↓
AuthContext reads localStorage for existing auth
```

### Step 2: User Reaches Login Page
```
If authenticated:
  - Root page (/) checks auth.user.role
  - Redirects to /admin (if admin/manager/superadmin)
  - Redirects to /staff (if other roles)

If not authenticated:
  - Root page (/) displays login form
  - OR user navigates to /login directly
```

### Step 3: User Submits Login Credentials
```
User enters email and password
↓
Frontend validates non-empty fields
↓
POST /api/v1/auth/login
  - Body: { email, password }
  - No Authorization header needed
```

### Step 4: Backend Authenticates
```
POST /api/v1/auth/login handler:
  1. Query database for user_account by email
  2. Compare password with bcryptjs
  3. Check if account is locked (5+ failed attempts)
  4. Generate access token (JWT RS256, 15 min expiry)
  5. Generate refresh token (8 hour expiry)
  6. Store refresh token in Redis
  7. Return { accessToken, user }
```

### Step 5: Frontend Stores Auth & Redirects
```
Login page receives response:
  - Extract accessToken and user object
  - Store in localStorage: {
      accessToken: "...",
      user: {
        id, firstName, lastName, role, staffId, tenantId
      }
    }
  - Check user.role
  - Redirect to /admin or /staff based on role
```

### Step 6: Protected Page Initialization
```
When accessing /admin or /staff:
  1. AuthContext reads localStorage
  2. useAuth() hook provides auth to component
  3. Component checks if auth exists
  4. If no auth → redirect to /login
  5. If auth exists → load protected page
```

### Step 7: API Calls with Authentication
```
Staff page calls GET /api/v1/auth/me:
  - Header: Authorization: Bearer {accessToken}
  - Auth middleware authenticates token
  - Returns user staff information
  - Page displays staff data
```

## Key Files

| File | Purpose |
|------|---------|
| `src/contexts/AuthContext.js` | Manages auth state, reads/writes localStorage |
| `src/app/page.js` | Root login page, redirects to role-based portal |
| `src/app/login/page.js` | Alternative login page |
| `src/app/admin/page.js` | Admin portal (protected) |
| `src/app/staff/page.js` | Staff portal (protected) |
| `src/app/api/v1/auth/login/route.js` | Login API endpoint |
| `src/app/api/v1/auth/me/route.js` | Get current user info |
| `src/lib/auth-guard.js` | JWT verification, authentication middleware |
| `src/lib/redis.js` | Redis with in-memory fallback |

## Testing Login Flow

### Create Test Staff Member
```bash
curl -X POST http://localhost:3000/api/v1/staff/create \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Test",
    "last_name": "User",
    "role": "RN",
    "email": "test@dependablecare.local"
  }'
```

Response includes:
```json
{
  "credentials": {
    "username": "tuser",
    "password": "GeneratedPassword123"
  },
  "user_account": {
    "email": "test@dependablecare.local",
    "role": "staff"
  }
}
```

### Test Login Flow
```bash
# 1. Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@dependablecare.local","password":"GeneratedPassword123"}'

# Response contains accessToken and user

# 2. Get user info (requires token)
curl http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer $accessToken"

# 3. Get staff list (requires token)
curl http://localhost:3000/api/v1/staff \
  -H "Authorization: Bearer $accessToken"
```

## Troubleshooting

### "Invalid email or password"
- Check credentials are correct
- Verify staff member email in database
- Ensure bcrypt hashing is applied

### "Missing or malformed Authorization header"
- Check accessToken is stored in localStorage
- Verify Bearer token is sent in API calls
- Check token hasn't expired (15 min)

### "No staff data found"
- Verify /api/v1/auth/me endpoint returns { user: ... }
- Check staff page reads data.user not data.staff
- Confirm JWT token is valid

### Stuck on loading page
- Clear localStorage: `localStorage.clear()`
- Check browser console for errors
- Verify AuthContext is loading correctly

## Role-Based Access

### Admin Routes
- `/admin` - Admin dashboard
- Accessible to: admin, manager, superadmin roles

### Staff Routes
- `/staff` - Staff portal
- Accessible to: staff and other non-admin roles

### Automatic Redirection
```javascript
const redirectPath = ['admin', 'manager', 'superadmin'].includes(user.role) 
  ? '/admin' 
  : '/staff';
```
