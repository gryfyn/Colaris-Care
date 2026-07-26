import { NextResponse } from 'next/server';
import { query, withRequestContext } from '@/lib/db.js';
import { signAccessToken, signRefreshToken } from '@/lib/jwt.js';
import { setPortalCookie, setRefreshCookie, setThemeCookie } from '@/lib/auth-cookies.js';
import { normalizeTheme } from '@/lib/themes.js';
import { verifyPassword } from '@/lib/passwords.js';
import { checkRateLimit, getRateLimitResponse, resetRateLimit } from '@/lib/rate-limiter.js';
import { recordLoginSession, logAuthEvent, requestContext } from '@/lib/session-tracking.js';
import logger from '@/lib/logger.js';

const REFRESH_TTL = 8 * 60 * 60;

function clientIp(request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
}

function redirectFor(role) {
  return role === 'admin' || role === 'superadmin'
    ? '/admin/dashboard'
    : '/staff/dashboard';
}

function safeNext(role, requestedNext) {
  if (!requestedNext || typeof requestedNext !== 'string' || !requestedNext.startsWith('/')) {
    return redirectFor(role);
  }
  if ((role === 'admin' || role === 'superadmin') && requestedNext.startsWith('/admin')) {
    return requestedNext;
  }
  if (['staff', 'manager', 'admin', 'superadmin'].includes(role) && requestedNext.startsWith('/staff')) {
    return requestedNext;
  }
  return redirectFor(role);
}

async function facilityTheme(payload) {
  return withRequestContext(payload, 'auth:login-theme', async (client) => {
    const { rows } = await client.query(
      `select settings->>'theme' as theme
         from care.facilities
        where organization_id = $1 and id = $2
        limit 1`,
      [payload.organizationId, payload.facilityId]
    );
    return normalizeTheme(rows[0]?.theme);
  }).catch(() => null);
}

export async function POST(request) {
  try {
    const maxAttempts = Number.parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10) || 25;
    const rateKey = `auth:login:${clientIp(request)}`;
    const limit = await checkRateLimit(rateKey, maxAttempts, 60);
    if (!limit.allowed) {
      const limited = getRateLimitResponse(limit);
      return Response.json(limited.body, { status: limited.status, headers: limited.headers });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON request body' }, { status: 400 });
    }

    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');
    const requestedNext = body?.next;

    if (!email || !password) {
      return Response.json({ error: 'email and password are required' }, { status: 422 });
    }

    const { ip, userAgent } = requestContext(request);

    const { rows } = await query('select * from app.login_identity($1)', [email]);
    const identity = rows[0];

    if (!identity || !verifyPassword(password, identity.password_hash)) {
      // Record the failed attempt so it surfaces in the account's sign-in
      // activity (with the user id when the email maps to a real account).
      await logAuthEvent({
        organizationId: identity?.organization_id,
        facilityId: identity?.facility_id,
        userId: identity?.user_id,
        outcome: 'failure',
        ip,
        userAgent,
        email: identity ? undefined : email,
      });
      return Response.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    await resetRateLimit(rateKey);

    const tokenPayload = {
      userId: identity.user_id,
      organizationId: identity.organization_id,
      facilityId: identity.facility_id,
      role: identity.role,
      staffId: identity.staff_profile_id,
    };

    const accessToken = signAccessToken(tokenPayload);
    const { token: refreshToken } = signRefreshToken(tokenPayload);
    const response = NextResponse.json({
      accessToken,
      redirectTo: safeNext(identity.role, requestedNext),
      user: {
        id: identity.user_id,
        email: identity.email,
        name: identity.display_name,
        role: identity.role,
        organizationId: identity.organization_id,
        facilityId: identity.facility_id,
        staffId: identity.staff_profile_id,
      },
    });

    setRefreshCookie(response, refreshToken, REFRESH_TTL);
    await setPortalCookie(response, tokenPayload);
    setThemeCookie(response, await facilityTheme(tokenPayload));

    // Persist the session + a success event (best-effort; never blocks login).
    await recordLoginSession({
      userId: identity.user_id,
      organizationId: identity.organization_id,
      facilityId: identity.facility_id,
      refreshToken,
      ttlSeconds: REFRESH_TTL,
      ip,
      userAgent,
    });
    await logAuthEvent({
      organizationId: identity.organization_id,
      facilityId: identity.facility_id,
      userId: identity.user_id,
      outcome: 'success',
      ip,
      userAgent,
    });

    return response;
  } catch (err) {
    logger.error({ err }, '[auth/login] Unhandled failure');
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
