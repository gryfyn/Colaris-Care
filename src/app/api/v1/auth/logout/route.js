import { NextResponse } from 'next/server';
import { deleteRefreshCookie } from '@/lib/auth-cookies.js';
import { authenticate, getRequestContext } from '@/lib/auth-guard.js';
import { AuditLogger } from '@/lib/audit-logger.js';
import { deleteRefreshToken, blacklistJti } from '@/lib/token-store.js';
import { verifyToken } from '@/lib/jwt.js';

const audit = new AuditLogger();

export async function POST(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) {
      const response = NextResponse.json({ error: authResult.error }, { status: authResult.status });
      deleteRefreshCookie(response);
      return response;
    }
    const { user } = authResult;

    const refreshToken = request.cookies.get('refresh_token')?.value;
    try {
      if (refreshToken) {
        try {
          const decoded = verifyToken(refreshToken, 'refresh');
          await deleteRefreshToken(decoded.sub, decoded.jti);
        } catch {
          // expired or invalid refresh token - no-op
        }
      }

      if (user?.jti) {
        const now = Math.floor(Date.now() / 1000);
        const ttl = user.exp ? Math.max(user.exp - now, 60) : 15 * 60;
        await blacklistJti(user.jti, ttl);
      }
    } catch (storeErr) {
      console.warn('[auth/logout] Token store unavailable, clearing cookie only:', storeErr?.message || storeErr);
    }

    const req = getRequestContext(request, user);
    await audit.logLogout({ req });

    const response = NextResponse.json({ message: 'Logged out successfully' });
    deleteRefreshCookie(response);
    return response;
  } catch (err) {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
