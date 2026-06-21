# Security Remediation - Code Examples & Implementation Guide

This document provides specific code examples to fix the critical security vulnerabilities identified in the threat model review.

---

## 1. CRITICAL PRIORITY: CSRF Protection

### Issue
State-changing endpoints lack CSRF token validation, allowing cross-origin attacks.

### Current Code (VULNERABLE)
```javascript
// src/app/api/v1/staff/create/route.js
export async function POST(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: 401 });
    
    const data = await request.json();
    // ... rest of implementation
  }
}
```

### Fixed Code
```javascript
// src/app/api/v1/staff/create/route.js
import { authenticate, authorize, getRequestContext, handleError } from '@/lib/auth-guard.js';
import { validateCsrf } from '@/lib/csrf.js';  // ADD THIS IMPORT
import { withTenantClient, query } from '@/lib/db.js';
import { generateCredentials } from '@/lib/credential-generator.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const audit = new AuditLogger();

export async function POST(request) {
  try {
    // ADD CSRF VALIDATION FIRST
    const csrfError = validateCsrf(request);
    if (csrfError) {
      return Response.json({ error: csrfError.error }, { status: csrfError.status });
    }

    const authResult = await authenticate(request);
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const user = authResult.user;
    
    // ... rest of implementation unchanged
  } catch (error) {
    return handleError(error);
  }
}
```

### Apply to All State-Changing Endpoints
Apply the same CSRF validation pattern to:
- `/api/v1/staff` (POST)
- `/api/v1/staff/assignments` (POST)
- `/api/v1/staff/[id]/deactivate` (PATCH)
- Any other POST/PUT/PATCH/DELETE endpoints

---

## 2. CRITICAL PRIORITY: Remove Dev Mode Auth Bypass

### Issue
`POST /api/v1/staff/create` allows unauthenticated requests in non-production environments.

### Current Code (VULNERABLE)
```javascript
// src/app/api/v1/staff/create/route.js (Lines 19-46)
export async function POST(request) {
  try {
    const authResult = await authenticate(request);

    let tenantId;
    let createdByStaffId;
    let user;

    if (authResult.error) {
      // In development, allow creating staff without auth for testing
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[DEV] Creating staff without authentication...');
        const { rows: tenants } = await query('SELECT id FROM ref.tenants LIMIT 1');
        if (!tenants.length) {
          const newTenantId = randomUUID();
          await query('INSERT INTO ref.tenants (id, name) VALUES ($1, $2)',
            [newTenantId, 'Dependable Care']
          );
          tenantId = newTenantId;
        } else {
          tenantId = tenants[0].id;
        }
        createdByStaffId = null;
      } else {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
    } else {
      user = authResult.user;
      if (!authorize(user.role, PERMISSIONS.STAFF_WRITE)) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      tenantId = user.tenantId;
      createdByStaffId = user.staffId;
    }
    // ... rest
  }
}
```

### Fixed Code
```javascript
// src/app/api/v1/staff/create/route.js - ALWAYS require authentication
export async function POST(request) {
  try {
    // CSRF validation (from previous fix)
    const csrfError = validateCsrf(request);
    if (csrfError) return Response.json(csrfError, { status: csrfError.status });

    // ALWAYS require authentication - NO EXCEPTIONS
    const authResult = await authenticate(request);
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const user = authResult.user;

    // Check authorization
    if (!authorize(user.role, PERMISSIONS.STAFF_WRITE)) {
      return Response.json({ error: 'Forbidden: you do not have permission to create staff' }, { status: 403 });
    }

    const tenantId = user.tenantId;
    const createdByStaffId = user.staffId;

    // ... rest of implementation
  } catch (error) {
    return handleError(error);
  }
}
```

### For Testing: Use Dedicated Test Endpoints
If development testing requires unauthenticated staff creation, create a separate endpoint:

```javascript
// src/app/api/v1/test/staff/create/route.js
// ONLY available when TEST_MODE=true AND running in non-production
export async function POST(request) {
  // Guard: only in test mode
  if (process.env.TEST_MODE !== 'true') {
    return Response.json({ error: 'Not available' }, { status: 404 });
  }

  if (process.env.NODE_ENV === 'production') {
    return Response.json({ error: 'Test endpoints not available in production' }, { status: 403 });
  }

  // Test-specific implementation
  const data = await request.json();
  // ... test-only staff creation logic
}
```

---

## 3. CRITICAL PRIORITY: Prevent Privilege Escalation

### Issue
Managers can create admin accounts via `/api/v1/staff/create`.

### Current Code (VULNERABLE)
```javascript
// src/app/api/v1/staff/create/route.js (Lines 132-145)
const roleMapping = {
  'Administrator': 'admin',    // ⚠️ Managers can create admin!
  'Director': 'admin',
  'Manager': 'manager',
  'RN': 'staff',
  'LPN': 'staff',
  'QMHP': 'staff',
  'Caregiver': 'staff',
  'Med_Aide': 'staff',
  'Case_Manager': 'staff',
  'Licensee': 'admin',         // ⚠️ Managers can create admin!
  'Other': 'staff',
};
const systemRole = roleMapping[role] || 'staff';

// Create user account
const { rows: userRows } = await client.query(
  `INSERT INTO care.user_accounts (...) VALUES (...)`,
  [..., systemRole, ...]
);
```

### Fixed Code
```javascript
import { ROLES } from '@/lib/roles.js';

export async function POST(request) {
  // ... auth checks ...

  const user = authResult.user;
  
  if (!authorize(user.role, PERMISSIONS.STAFF_WRITE)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const data = await request.json();
  const { first_name, last_name, role, ... } = data;

  // ADD: Prevent privilege escalation
  const ROLE_HIERARCHY = {
    [ROLES.STAFF]: ['staff'],
    [ROLES.MANAGER]: ['staff', 'manager'],
    [ROLES.ADMIN]: ['staff', 'manager', 'admin'],
    [ROLES.SUPERADMIN]: ['staff', 'manager', 'admin', 'superadmin'],
  };

  const requestedJobRole = role; // 'Administrator', 'Manager', etc.
  const requestedSystemRole = roleMapping[requestedJobRole] || 'staff';
  
  // Verify user can create accounts with this role
  const allowedRoles = ROLE_HIERARCHY[user.role] || [];
  if (!allowedRoles.includes(requestedSystemRole)) {
    return Response.json({
      error: `You cannot create staff with role: ${requestedSystemRole}. Allowed roles: ${allowedRoles.join(', ')}`
    }, { status: 403 });
  }

  // Only proceed if role is allowed
  const systemRole = requestedSystemRole;

  // ... rest of implementation
}
```

---

## 4. CRITICAL PRIORITY: Mask Sensitive PHI

### Issue
Staff emails and phone numbers exposed to all users without role-based masking.

### Current Code (VULNERABLE)
```javascript
// src/app/api/v1/staff/route.js (GET endpoint)
export async function GET(request) {
  // ... auth checks ...

  const rows = await withTenantClient(user.tenantId, user.staffId, async (client) => {
    // ... query ...
    const { rows } = await client.query(
      `SELECT s.id, s.first_name, s.last_name, s.role, s.email, s.phone,
              s.license_no, s.hire_date, s.is_active, s.created_at, s.updated_at,
              COUNT(*) OVER() AS total_count
       FROM ref.staff s ...`
    );
    return rows;
  });

  // ⚠️ Returns unmasked email and phone to all staff
  const total = rows[0]?.total_count || 0;
  return Response.json({
    data: rows,  // ⚠️ Contains unmasked PHI
    pagination: { ... },
  }, { status: 200 });
}
```

### Fixed Code
```javascript
// src/lib/data-masking.js - New utility file
import { ROLES } from '@/lib/roles.js';

export function maskStaffData(staff, viewerRole) {
  if (!staff) return staff;

  // Admin and manager roles can see all data
  if ([ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.MANAGER].includes(viewerRole)) {
    return staff;
  }

  // Regular staff members see masked data
  if (viewerRole === ROLES.STAFF) {
    return {
      ...staff,
      email: '[email masked]',
      phone: '[phone masked]',
      license_no: '[license masked]',
      // Other PHI fields
    };
  }

  // Resident care staff only see own info
  if (viewerRole === ROLES.RESIDENT_CARE_OF) {
    return {
      id: staff.id,
      first_name: staff.first_name,
      last_name: staff.last_name,
      role: staff.role,
      // Nothing else
    };
  }

  return staff;
}

export function maskStaffList(staffList, viewerRole) {
  return staffList.map(staff => maskStaffData(staff, viewerRole));
}
```

### Apply Masking in API Endpoint
```javascript
// src/app/api/v1/staff/route.js
import { maskStaffList } from '@/lib/data-masking.js';

export async function GET(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.STAFF_READ)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const role = searchParams.get('role');
    const isActive = searchParams.get('is_active');
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'));

    // ... query code ...

    const rows = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      // ... build and execute query ...
    });

    const req = getRequestContext(request, user);
    await audit.logSelect({ tableName: 'ref.staff', req }).catch(err => console.error('Audit log error:', err));

    const total = rows[0]?.total_count || 0;
    
    // APPLY MASKING BEFORE RETURNING
    const maskedData = maskStaffList(rows, user.role);

    return Response.json({
      data: maskedData,
      pagination: {
        limit,
        offset,
        total,
        pages: Math.ceil(total / limit),
      },
    }, { status: 200 });
  } catch (err) {
    return handleError(err);
  }
}
```

---

## 5. HIGH PRIORITY: Fix Credential Handling

### Issue
Plaintext temporary passwords returned in API response body.

### Current Code (VULNERABLE)
```javascript
// src/app/api/v1/staff/create/route.js
const credentials = generateCredentials(first_name, last_name, 'staff');
const passwordHash = await bcrypt.hash(credentials.password, 12);

// ... staff record created ...

const response = {
  staff: staffRows[0],
  user_account: userRows[0],
  credentials: {
    username: credentials.username,
    password: credentials.password,  // ⚠️ PLAINTEXT PASSWORD IN RESPONSE
    temporary: true,
    mustChangePassword: true,
  },
};

return Response.json({ data: response }, { status: 201 });
```

### Fixed Code
```javascript
// src/app/api/v1/staff/create/route.js
import { generateCredentials } from '@/lib/credential-generator.js';
import { sendCredentialsEmail } from '@/lib/email-service.js';
import { randomUUID } from 'crypto';

export async function POST(request) {
  // ... validation ...

  const credentials = generateCredentials(first_name, last_name, 'staff');
  const passwordHash = await bcrypt.hash(credentials.password, 12);

  const result = await withTenantClient(tenantId, createdByStaffId, async (client) => {
    // Create staff record
    const { rows: staffRows } = await client.query(
      `INSERT INTO ref.staff (...) VALUES (...) RETURNING id, first_name, last_name, role, email`,
      [...]
    );
    const staffId = staffRows[0].id;

    // Create user account
    const { rows: userRows } = await client.query(
      `INSERT INTO care.user_accounts (tenant_id, staff_id, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, role`,
      [tenantId, staffId, staffEmail, passwordHash, systemRole, true]
    );

    return { staff: staffRows[0], user_account: userRows[0], staffId };
  });

  // Send credentials via secure email (instead of API response)
  const credentialsToken = randomUUID();
  await storeTemporaryCredentials(result.staffId, credentialsToken, credentials.password);
  
  try {
    await sendCredentialsEmail({
      email: staffEmail,
      username: credentials.username,
      credentialsToken,
      resetLink: `https://dcllc.app/auth/claim-credentials?token=${credentialsToken}`,
      tenantId,
    });
  } catch (emailError) {
    console.error('Failed to send credentials email:', emailError);
    // Still return success - credentials stored temporarily
  }

  // Return response WITHOUT plaintext password
  const response = {
    staff: result.staff,
    user_account: result.user_account,
    message: 'Staff member created. Credentials sent via email.',
    credentialsDeliveryMethod: 'email',
  };

  return Response.json({ data: response }, { status: 201 });
}

// Helper: Store temporary credentials for claim link
async function storeTemporaryCredentials(staffId, token, password) {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  const passwordHash = await bcrypt.hash(password, 12);
  
  await query(
    `INSERT INTO care.temporary_credentials (staff_id, token, password_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [staffId, token, passwordHash, expiresAt]
  );
}
```

### Create Credentials Claim Endpoint
```javascript
// src/app/api/v1/auth/claim-credentials/route.js
import { verifyToken } from '@/lib/jwt.js';
import bcrypt from 'bcryptjs';

export async function POST(request) {
  const { token, newPassword } = await request.json();

  if (!token || !newPassword) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Verify new password strength
  if (newPassword.length < 12 || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    return Response.json({ 
      error: 'Password must be 12+ chars with uppercase and numbers' 
    }, { status: 400 });
  }

  // Look up temporary credential
  const { rows } = await query(
    `SELECT * FROM care.temporary_credentials 
     WHERE token = $1 AND expires_at > NOW()`,
    [token]
  );

  if (!rows.length) {
    return Response.json({ error: 'Invalid or expired credentials token' }, { status: 401 });
  }

  const tempCred = rows[0];
  const newPasswordHash = await bcrypt.hash(newPassword, 12);

  // Update user account password
  await query(
    `UPDATE care.user_accounts SET password_hash = $1, force_password_change = FALSE 
     WHERE staff_id = $2`,
    [newPasswordHash, tempCred.staff_id]
  );

  // Delete temporary credential
  await query('DELETE FROM care.temporary_credentials WHERE id = $1', [tempCred.id]);

  return Response.json({ message: 'Password set successfully' }, { status: 200 });
}
```

---

## 6. HIGH PRIORITY: Add Rate Limiting

### Issue
No rate limiting allows brute force and resource exhaustion attacks.

### Implementation
```javascript
// src/lib/rate-limit.js
import rateLimit from 'express-rate-limit';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,                      // 5 requests per window
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

export const searchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                    // 100 requests per window
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,        // 1 minute
  max: 50,                     // 50 requests per window
  standardHeaders: true,
  legacyHeaders: false,
});
```

### Apply to Routes
```javascript
// src/app/api/v1/auth/login/route.js
import { authLimiter } from '@/lib/rate-limit.js';

export async function POST(request) {
  // Note: In Next.js, apply middleware at the route level
  // For now, apply programmatically
  // ... implementation
}

// Better approach: Use Next.js middleware
// src/middleware.js
import { NextResponse } from 'next/server';
import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.headers.get('x-forwarded-for') || req.ip,
});

export function middleware(request) {
  if (request.nextUrl.pathname === '/api/v1/auth/login') {
    // Apply rate limiting logic
    // This requires a more sophisticated implementation
  }
  return NextResponse.next();
}
```

For Next.js, consider using a third-party package like `next-rate-limit`:

```javascript
// src/middleware.js
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(10, '10 s'),
});

export async function middleware(request) {
  if (request.nextUrl.pathname.startsWith('/api/v1/auth/login')) {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const { success } = await ratelimit.limit(ip);

    if (!success) {
      return new Response('Too many login attempts', { status: 429 });
    }
  }

  return NextResponse.next();
}
```

---

## 7. HIGH PRIORITY: Improve Audit Logging

### Issue
Insufficient audit logging with silent failures.

### Current Code (VULNERABLE)
```javascript
await audit.logSelect({ 
  tableName: 'ref.staff', 
  req 
}).catch(err => console.error('Audit log error:', err));  // ⚠️ Silent failure
```

### Fixed Code
```javascript
// src/lib/audit-logger.js - Enhanced
import logger from '@/lib/logger.js';

export class AuditLogger {
  async logSelect(options) {
    try {
      const { tableName, req, purpose, notes } = options;
      
      await query(
        `INSERT INTO audit_log.event_log 
         (user_id, tenant_id, action, table_name, purpose, notes, ip_address, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          req.user?.id,
          req.user?.tenantId,
          'SELECT',
          tableName,
          purpose || 'data_access',
          notes,
          req.ip,
        ]
      );
    } catch (err) {
      // CRITICAL: Don't silently fail
      logger.error('AUDIT_LOG_FAILURE', {
        operation: 'logSelect',
        table: options.tableName,
        error: err.message,
        userId: options.req?.user?.id,
      });

      // Send alert to security team
      await this.alertSecurityTeam('Audit logging failure', {
        operation: 'logSelect',
        table: options.tableName,
      });

      throw err;  // Re-throw to caller
    }
  }

  async alertSecurityTeam(message, context) {
    try {
      // Send to monitoring/alerting system
      await fetch(process.env.SECURITY_ALERT_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          severity: 'CRITICAL',
          message,
          context,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (err) {
      logger.error('Failed to send security alert', err);
    }
  }
}
```

### Use in API Endpoints
```javascript
// src/app/api/v1/staff/create/route.js
export async function POST(request) {
  // ... implementation ...

  try {
    await audit.logInsert({
      tableName: 'ref.staff',
      recordId: result.staff.id,
      residentId: null,
      req,
      purpose: 'new_staff_onboarding',
      reason: 'manager_staff_creation',
      details: {
        staffRole: systemRole,
        createdBy: user.staffId,
      },
    });
  } catch (auditErr) {
    // Log to secondary location and alert
    logger.error('Primary audit log failed', auditErr);
    // Continue operation but alert security team
    await audit.alertSecurityTeam('Audit log failure on staff creation', {
      staffId: result.staff.id,
      error: auditErr.message,
    });
  }

  return Response.json({ data: result }, { status: 201 });
}
```

---

## 8. HIGH PRIORITY: Add Session Timeout

### Issue
Access tokens don't expire; no idle timeout.

### Fixed JWT Implementation
```javascript
// src/lib/jwt.js
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_TOKEN_TTL = 15 * 60; // 15 minutes in seconds
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 days

export function signToken(payload, type = 'access') {
  const ttl = type === 'refresh' ? REFRESH_TOKEN_TTL : ACCESS_TOKEN_TTL;
  
  return jwt.sign(
    {
      ...payload,
      type,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + ttl,  // ADD expiration
    },
    JWT_SECRET,
    { algorithm: 'HS256' }
  );
}

export function verifyToken(token, expectedType = 'access') {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
      // Token expiration is verified automatically by jwt.verify()
    });

    if (decoded.type !== expectedType) {
      throw new Error(`Invalid token type: expected ${expectedType}, got ${decoded.type}`);
    }

    return decoded;
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw { name: 'TokenExpiredError', message: 'Token has expired' };
    }
    throw err;
  }
}
```

### Implement Refresh Token Rotation
```javascript
// src/app/api/v1/auth/refresh/route.js
import { signToken, verifyToken } from '@/lib/jwt.js';
import { query } from '@/lib/db.js';
import { randomUUID } from 'crypto';

export async function POST(request) {
  try {
    const refreshToken = request.cookies.get('refresh_token')?.value;

    if (!refreshToken) {
      return Response.json({ error: 'No refresh token' }, { status: 401 });
    }

    // Verify refresh token
    const decoded = verifyToken(refreshToken, 'refresh');

    // Check if refresh token is blacklisted
    const blacklistKey = `jti:blacklist:${decoded.jti}`;
    const isBlacklisted = await redis.client.exists(blacklistKey);
    if (isBlacklisted) {
      return Response.json({ error: 'Refresh token revoked' }, { status: 401 });
    }

    // Fetch user and verify still exists and is active
    const { rows: users } = await query(
      `SELECT ua.id, ua.staff_id, ua.tenant_id, ua.role
       FROM care.user_accounts ua
       WHERE ua.id = $1 AND ua.is_active = TRUE`,
      [decoded.sub]
    );

    if (!users.length) {
      return Response.json({ error: 'User not found or inactive' }, { status: 401 });
    }

    const user = users[0];

    // Generate new access token
    const newAccessToken = signToken({
      sub: user.id,
      staffId: user.staff_id,
      tenantId: user.tenant_id,
      role: user.role,
      jti: randomUUID(),
    }, 'access');

    // Optionally rotate refresh token (best practice)
    const newRefreshToken = signToken({
      sub: user.id,
      staffId: user.staff_id,
      tenantId: user.tenant_id,
      role: user.role,
      jti: randomUUID(),
    }, 'refresh');

    // Blacklist old refresh token
    const oldJti = decoded.jti;
    const ttl = 7 * 24 * 60 * 60; // 7 days
    await redis.client.setex(`jti:blacklist:${oldJti}`, ttl, 'revoked');

    // Set new refresh token cookie
    const response = Response.json({ accessToken: newAccessToken }, { status: 200 });
    response.cookies.set('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return Response.json({ error: 'Token expired', code: 'TOKEN_EXPIRED' }, { status: 401 });
    }
    return Response.json({ error: 'Invalid token' }, { status: 401 });
  }
}
```

### Frontend: Handle Token Expiration
```javascript
// src/contexts/AuthContext.js
export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(null);
  const [loading, setLoading] = useState(true);

  // ... existing code ...

  const silentRefresh = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        credentials: 'same-origin',
      });

      if (!res.ok) {
        if (res.status === 401) {
          // Token expired and refresh failed
          setAuth(null);
          // Redirect to login
          window.location.href = '/auth/login?reason=session_expired';
        }
        return;
      }

      const { accessToken } = await res.json();
      
      // Fetch user info with new token
      const meRes = await fetch('/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
        credentials: 'same-origin',
      });

      if (meRes.ok) {
        const { user } = await meRes.json();
        setAuth({ accessToken, user });

        // Schedule next refresh (before token expires)
        // Token TTL is 15 minutes, refresh after 10 minutes
        scheduleNextRefresh(10 * 60 * 1000);
      } else {
        setAuth(null);
      }
    } catch (err) {
      console.error('Silent refresh failed:', err);
      setAuth(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const scheduleNextRefresh = useCallback((delayMs) => {
    const timeoutId = setTimeout(() => {
      silentRefresh();
    }, delayMs);

    return () => clearTimeout(timeoutId);
  }, [silentRefresh]);

  useEffect(() => {
    let cancelled = false;
    silentRefresh();
    return () => { cancelled = true; };
  }, [silentRefresh]);

  // ... rest of implementation
}
```

---

## Summary

These code examples address the most critical vulnerabilities:

1. **CSRF Protection** - Add to all state-changing endpoints
2. **Remove Auth Bypass** - Always require authentication
3. **Prevent Privilege Escalation** - Check role hierarchy
4. **Mask PHI** - Apply role-based masking
5. **Fix Credentials** - Never return plaintext passwords
6. **Rate Limiting** - Prevent brute force and DoS
7. **Audit Logging** - Enhanced with alerts
8. **Session Timeout** - Implement JWT expiration

Implement in this order:
1. CSRF + Auth Bypass (2-3 hours)
2. Privilege Escalation + PHI Masking (3-4 hours)
3. Credential Handling (4-6 hours)
4. Rate Limiting + Audit Logging (4-5 hours)
5. Session Timeout (3-4 hours)

**Total estimated effort: 16-22 hours of development**

