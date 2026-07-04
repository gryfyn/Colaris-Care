import crypto from 'crypto';
import { query } from '@/lib/db.js';
import { hashPassword } from '@/lib/passwords.js';
import { checkRateLimit, getRateLimitResponse } from '@/lib/rate-limiter.js';
import logger from '@/lib/logger.js';

function clientIp(request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
}

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

// POST /api/auth/reset-password  — public. Consumes a reset token and sets a new
// password. Body: { token, newPassword }
export async function POST(request) {
  try {
    const limit = await checkRateLimit(`auth:reset:${clientIp(request)}`, 10, 60);
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

    const token = String(body?.token || '');
    const newPassword = String(body?.newPassword || '');

    if (!token || !newPassword) {
      return Response.json({ error: 'token and newPassword are required' }, { status: 422 });
    }
    if (newPassword.length < 8) {
      return Response.json({ error: 'Password must be at least 8 characters.' }, { status: 422 });
    }

    const { rows } = await query('select app.password_reset_consume($1, $2) as ok', [sha256(token), hashPassword(newPassword)]);
    if (!rows[0]?.ok) {
      return Response.json({ error: 'This reset link is invalid or has expired. Request a new one.' }, { status: 400 });
    }

    return Response.json({ data: { message: 'Password reset. You can now sign in with your new password.' } });
  } catch (err) {
    logger.error({ err }, '[auth/reset-password] failure');
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
