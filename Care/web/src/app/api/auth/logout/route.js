import { NextResponse } from 'next/server';
import { deleteAuthCookies } from '@/lib/auth-cookies.js';
import { decodeToken } from '@/lib/jwt.js';
import { revokeToken } from '@/lib/token-blacklist.js';
import logger from '@/lib/logger.js';

function bearerToken(request) {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token || null;
}

export async function POST(request) {
  const response = NextResponse.json({ message: 'Logged out successfully' });

  // Revoke the presented access token so it can no longer be used after logout.
  try {
    const token = bearerToken(request);
    if (token) {
      const decoded = decodeToken(token);
      if (decoded?.jti) {
        await revokeToken(decoded.jti, decoded.exp);
      }
    }
  } catch (err) {
    // Revocation is best-effort; clearing cookies below still logs the user out.
    logger.warn({ err }, '[auth/logout] Failed to revoke access token');
  }

  // Clear the httpOnly portal cookie and refresh cookie so server-side guards reject.
  deleteAuthCookies(response);
  return response;
}
