import { NextResponse } from 'next/server';
import { getRefreshToken, graceRefreshToken, storeRefreshToken } from '@/lib/token-store.js';
import { signAccessToken, signRefreshToken, verifyToken } from '@/lib/jwt.js';
import { setRefreshCookie } from '@/lib/auth-cookies.js';

const REFRESH_TTL = 8 * 60 * 60;
const REFRESH_ROTATION_GRACE_TTL = 30;

export async function POST(request) {
  try {
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

    let storeReady = true;
    let storedData = null;
    try {
      storedData = await getRefreshToken(decoded.sub, decoded.jti);
    } catch (storeErr) {
      storeReady = false;
      console.warn('[auth/refresh] Token store unavailable, using stateless refresh fallback:', storeErr?.message || storeErr);
    }

    const tokenPayload = {
      userId:     decoded.sub,
      tenantId:   storedData?.tenantId || decoded.tenantId,
      role:       storedData?.role || decoded.role,
      staffId:    storedData?.staffId || decoded.staffId || null,
      residentId: storedData?.residentId || decoded.residentId || null,
    };

    if (storeReady && storedData) {
      try {
        await graceRefreshToken(decoded.sub, decoded.jti, REFRESH_ROTATION_GRACE_TTL);
      } catch (storeErr) {
        console.warn('[auth/refresh] Token store rotation step failed, continuing:', storeErr?.message || storeErr);
      }
    }

    const accessToken               = signAccessToken(tokenPayload);
    const { token: newRefreshToken, jti: newJti } = signRefreshToken(tokenPayload);

    if (storeReady) {
      try {
        await storeRefreshToken({
          jti:        newJti,
          userId:     decoded.sub,
          tenantId:   tokenPayload.tenantId,
          role:       tokenPayload.role,
          staffId:    tokenPayload.staffId,
          residentId: tokenPayload.residentId,
          ttlSeconds: REFRESH_TTL,
        });
      } catch (storeErr) {
        console.warn('[auth/refresh] Token store write failed, continuing without persistence:', storeErr?.message || storeErr);
      }
    }

    const response = NextResponse.json({ accessToken });
    setRefreshCookie(response, newRefreshToken, REFRESH_TTL);

    return response;
  } catch (err) {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
