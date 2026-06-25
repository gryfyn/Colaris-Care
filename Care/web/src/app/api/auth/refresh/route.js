import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { signAccessToken, signRefreshToken, verifyToken } from '@/lib/jwt.js';
import { setPortalCookie, setRefreshCookie } from '@/lib/auth-cookies.js';

const REFRESH_TTL = 8 * 60 * 60;

export async function POST(request) {
  const refreshToken = request.cookies.get('refresh_token')?.value;
  if (!refreshToken) {
    return Response.json({ error: 'No refresh token' }, { status: 401 });
  }

  let decoded;
  try {
    decoded = verifyToken(refreshToken, 'refresh');
  } catch {
    return Response.json({ error: 'Invalid or expired refresh token' }, { status: 401 });
  }

  const { rows } = await query(
    'select * from app.refresh_identity($1, $2, $3)',
    [decoded.sub, decoded.organizationId || decoded.tenantId, decoded.facilityId]
  );
  const identity = rows[0];
  if (!identity) {
    return Response.json({ error: 'Session is no longer authorized' }, { status: 401 });
  }

  const tokenPayload = {
    userId: identity.user_id,
    organizationId: identity.organization_id,
    facilityId: identity.facility_id,
    role: identity.role,
    staffId: identity.staff_profile_id,
  };

  const accessToken = signAccessToken(tokenPayload);
  const { token: newRefreshToken } = signRefreshToken(tokenPayload);
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

  setRefreshCookie(response, newRefreshToken, REFRESH_TTL);
  await setPortalCookie(response, tokenPayload);
  return response;
}
