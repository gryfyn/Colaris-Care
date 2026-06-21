import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { storeRefreshToken } from '@/lib/token-store.js';
import { signAccessToken, signRefreshToken } from '@/lib/jwt.js';
import { AuditLogger } from '@/lib/audit-logger.js';
import { getRequestContext } from '@/lib/auth-guard.js';
import { decryptFields } from '@/lib/encryption.js';
import { setRefreshCookie } from '@/lib/auth-cookies.js';
import { getTenantKey } from '@/lib/tenant-key.js';
import { checkRateLimit, getRateLimitResponse } from '@/lib/rate-limiter.js';
import logger from '@/lib/logger.js';

const audit = new AuditLogger();

const REFRESH_TTL = 8 * 60 * 60; // 8 hours in seconds

function clientIp(request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
}

export async function POST(request) {
  try {
    // IP-based throttle (defense-in-depth alongside the per-account lockout below).
    const rl = checkRateLimit(`login:${clientIp(request)}`, 10, 60);
    if (!rl.allowed) {
      const r = getRateLimitResponse(rl);
      return Response.json(r.body, { status: r.status, headers: r.headers });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON request body' }, { status: 400 });
    }

    const { email, password } = body || {};

    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      return Response.json({ error: 'email and password are required' }, { status: 422 });
    }

    const { rows } = await query(
      `SELECT
              COALESCE(s.id, r.id)                       AS id,
              ua.tenant_id,
              COALESCE(s.first_name, r.first_name)       AS first_name,
              COALESCE(s.last_name,  r.last_name)        AS last_name,
              s.role                                     AS job_role,
              ua.id                                      AS account_id,
              ua.password_hash, ua.is_active, ua.role,
              ua.failed_attempts, ua.locked_until,
              ua.password_changed_required,
              ua.staff_id, ua.resident_id
       FROM care.user_accounts ua
       LEFT JOIN ref.staff      s ON s.id = ua.staff_id
       LEFT JOIN care.residents r ON r.id = ua.resident_id
       WHERE ua.email = $1 AND ua.is_active = TRUE
       LIMIT 1`,
      [email.toLowerCase().trim()]
    );

    const user = rows[0];
    const dummyHash = '$2b$12$invalidhashfortimingattackprevention0000000000000000000';
    const hashToCompare = user?.password_hash || dummyHash;
    const passwordMatch = await bcrypt.compare(password, hashToCompare);

    const req = getRequestContext(request, null);

    if (!user || !passwordMatch) {
      await audit.logLogin({ req, userId: user?.id, success: false });
      if (user) {
        await query(
          `UPDATE care.user_accounts
           SET failed_attempts = failed_attempts + 1,
               locked_until = CASE WHEN failed_attempts + 1 >= 5
                               THEN NOW() + INTERVAL '30 minutes' ELSE locked_until END
           WHERE id = $1`,
          [user.account_id]
        );
      }
      return Response.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return Response.json(
        { error: 'Account temporarily locked due to failed login attempts', unlockAt: user.locked_until },
        { status: 423 }
      );
    }

    await query(
      'UPDATE care.user_accounts SET failed_attempts = 0, locked_until = NULL, last_login = NOW() WHERE id = $1',
      [user.account_id]
    );

    const tokenPayload = {
      userId:     user.account_id,
      staffId:    user.staff_id,
      residentId: user.resident_id,
      tenantId:   user.tenant_id,
      role:       user.role,
    };

    const accessToken                  = signAccessToken(tokenPayload);
    const { token: refreshToken, jti } = signRefreshToken(tokenPayload);

    try {
      await storeRefreshToken({
        jti,
        userId:     user.account_id,
        tenantId:   user.tenant_id,
        role:       user.role,
        staffId:    user.staff_id,
        residentId: user.resident_id,
        ttlSeconds: REFRESH_TTL,
      });
    } catch (storeErr) {
      console.warn('[auth/login] Token store unavailable, skipping refresh token persistence:', storeErr?.message || storeErr);
    }

    await audit.logLogin({ req, userId: user.id, success: true });

    // Resident records store first_name / last_name encrypted — decrypt for display.
    let displayFirstName = user.first_name;
    let displayLastName  = user.last_name;
    if (user.resident_id && user.first_name) {
      try {
        const tenantKey = await getTenantKey(user.tenant_id);
        const decrypted = decryptFields(
          { first_name: user.first_name, last_name: user.last_name },
          ['first_name', 'last_name'],
          tenantKey
        );
        displayFirstName = decrypted.first_name;
        displayLastName  = decrypted.last_name;
      } catch { /* fall back to raw values */ }
    }

    const response = NextResponse.json({
      accessToken,
      user: {
        id:         user.account_id,
        staffId:    user.staff_id,
        residentId: user.resident_id,
        firstName:  displayFirstName,
        lastName:   displayLastName,
        role:       user.role,
        tenantId:   user.tenant_id,
        passwordChangedRequired: user.password_changed_required === true,
      },
    });

    setRefreshCookie(response, refreshToken, REFRESH_TTL);

    return response;
  } catch (err) {
    logger.error({
      route: '/api/v1/auth/login',
      err: {
        message: err?.message,
        code: err?.code,
        detail: err?.detail,
        stack: err?.stack,
      },
    }, '[auth/login] Unhandled login failure');
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
