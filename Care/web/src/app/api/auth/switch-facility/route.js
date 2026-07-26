import { NextResponse } from 'next/server';
import { requireUser, AuthError, authErrorResponse } from '@/lib/auth-guard.js';
import { query, withRequestContext } from '@/lib/db.js';
import { signAccessToken, signRefreshToken } from '@/lib/jwt.js';
import { setPortalCookie, setRefreshCookie, setThemeCookie } from '@/lib/auth-cookies.js';
import { normalizeTheme } from '@/lib/themes.js';
import { rotateSession, recordLoginSession, requestContext } from '@/lib/session-tracking.js';
import logger from '@/lib/logger.js';

const REFRESH_TTL = 8 * 60 * 60;

async function facilityTheme(payload) {
  return withRequestContext(payload, 'auth:switch-facility-theme', async (client) => {
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

// POST /api/auth/switch-facility  { facilityId }
// Switches the active home. Validates the user has an active membership for the
// target facility, then re-mints the access/refresh/portal tokens with the new
// facility + that membership's role so every subsequent request (and RLS) is
// scoped to the new facility.
export async function POST(request) {
  try {
    const user = await requireUser(request);

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON request body' }, { status: 400 });
    }
    const facilityId = String(body?.facilityId || '');
    if (!facilityId) {
      return Response.json({ error: 'facilityId is required' }, { status: 422 });
    }

    const { rows } = await query('select * from app.membership_identity($1, $2)', [user.id, facilityId]);
    const identity = rows[0];
    if (!identity) {
      return Response.json({ error: 'You do not have access to that facility.' }, { status: 403 });
    }

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

    // Keep session tracking coherent: rotate the current session onto the new
    // refresh token (best-effort).
    const oldRefresh = request.cookies.get('refresh_token')?.value;
    if (oldRefresh) {
      await rotateSession({ oldRefreshToken: oldRefresh, newRefreshToken: refreshToken, ttlSeconds: REFRESH_TTL });
    } else {
      const { ip, userAgent } = requestContext(request);
      await recordLoginSession({
        userId: identity.user_id,
        organizationId: identity.organization_id,
        facilityId: identity.facility_id,
        refreshToken,
        ttlSeconds: REFRESH_TTL,
        ip,
        userAgent,
      });
    }

    return response;
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    logger.error({ err }, '[auth/switch-facility] failure');
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
