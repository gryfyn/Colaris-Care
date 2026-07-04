import crypto from 'crypto';
import { query } from '@/lib/db.js';
import { sendEmail, passwordResetEmail } from '@/lib/email.js';
import { checkRateLimit, getRateLimitResponse } from '@/lib/rate-limiter.js';
import logger from '@/lib/logger.js';

const TTL_MINUTES = 30;

function clientIp(request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
}

function appOrigin(request) {
  const env = process.env.NEXT_PUBLIC_APP_URL;
  if (env) return env.replace(/\/$/, '');
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  return host ? `${proto}://${host}` : new URL(request.url).origin;
}

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

// POST /api/auth/forgot-password  — public. Emails a reset link for an active
// account. Always returns the same generic message so it can't be used to probe
// which emails exist.
export async function POST(request) {
  try {
    const limit = await checkRateLimit(`auth:forgot:${clientIp(request)}`, 5, 60);
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
    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 422 });
    }

    const generic = { data: { message: 'If an account exists for that email, a password reset link is on its way.' } };

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = sha256(token);

    let rows = [];
    try {
      ({ rows } = await query('select * from app.password_reset_create($1, $2, $3)', [email, tokenHash, TTL_MINUTES]));
    } catch (err) {
      logger.error({ err }, '[auth/forgot-password] token create failed');
      return Response.json(generic);
    }

    if (rows.length) {
      const resetUrl = `${appOrigin(request)}/reset-password?token=${token}`;
      const result = await sendEmail({ to: rows[0].email, ...passwordResetEmail(resetUrl) });
      if (!result.sent) {
        logger.warn({ reason: result.reason }, '[auth/forgot-password] email not sent');
        // Dev convenience only: expose the link when email is not configured and
        // we are not in production, so the flow is testable without a mail key.
        if (process.env.NODE_ENV !== 'production') {
          return Response.json({ data: { ...generic.data, devResetUrl: resetUrl } });
        }
      }
    }

    return Response.json(generic);
  } catch (err) {
    logger.error({ err }, '[auth/forgot-password] failure');
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
