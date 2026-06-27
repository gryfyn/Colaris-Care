import crypto from 'crypto';
import { query } from '@/lib/db.js';
import { hashPassword } from '@/lib/passwords.js';
import { sendEmail, verificationEmail } from '@/lib/email.js';
import { checkRateLimit } from '@/lib/rate-limiter.js';
import logger from '@/lib/logger.js';

function clientIp(request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
}

export async function POST(request) {
  const limit = await checkRateLimit(`auth:signup:${clientIp(request)}`, 6, 60).catch(() => ({ allowed: true }));
  if (limit && limit.allowed === false) {
    return Response.json({ error: 'Too many attempts. Please wait a moment and try again.' }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const displayName = String(body.name || body.displayName || '').trim() || null;

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return Response.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }
  if (password.length < 8) {
    return Response.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const passwordHash = hashPassword(password);

  try {
    await query('select app.signup_create($1, $2, $3, $4)', [email, passwordHash, displayName, token]);
  } catch (err) {
    if (String(err.message || '').includes('EMAIL_EXISTS')) {
      return Response.json({ error: 'An account with this email already exists — try signing in.' }, { status: 409 });
    }
    logger.error({ err }, '[auth/signup] failed to create signup');
    return Response.json({ error: 'Could not create your account. Please try again.' }, { status: 500 });
  }

  const origin = request.headers.get('origin') || new URL(request.url).origin;
  const link = `${origin}/verify?token=${token}`;
  const mail = verificationEmail(link);
  const result = await sendEmail({ to: email, ...mail });
  if (!result.sent) logger.warn({ reason: result.reason }, '[auth/signup] verification email not delivered');

  // When email can't be delivered (provider unconfigured / unverified domain),
  // return the link so onboarding isn't blocked. Omitted once email delivers.
  return Response.json({ ok: true, emailSent: Boolean(result.sent), verifyLink: result.sent ? undefined : link });
}
