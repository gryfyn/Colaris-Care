import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query } from '@/lib/db.js';
import { handleError } from '@/lib/auth-guard.js';
import { checkRateLimit, getRateLimitResponse } from '@/lib/rate-limiter.js';
import logger from '@/lib/logger.js';

export async function POST(request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    const rl = checkRateLimit(`forgot-password:${ip}`, 5, 60);
    if (!rl.allowed) {
      const r = getRateLimitResponse(rl);
      return Response.json(r.body, { status: r.status, headers: r.headers });
    }

    const { email } = await request.json();

    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 422 });
    }

    const trimmedEmail = email.toLowerCase().trim();

    // Don't reveal whether email exists — always return same message
    const { rows } = await query(
      'SELECT id, email FROM care.user_accounts WHERE email = $1 AND is_active = TRUE',
      [trimmedEmail]
    );

    const successMessage = { message: 'If an account exists with that email, you will receive password reset instructions' };

    if (!rows.length) {
      return Response.json(successMessage, { status: 200 });
    }

    const user = rows[0];

    // Generate a cryptographically secure token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(resetToken, 10);

    // Token expires in 30 minutes
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    try {
      await query(
        `INSERT INTO care.password_reset_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [user.id, tokenHash, expiresAt]
      );
    } catch (err) {
      logger.error({ err, userId: user.id }, 'Failed to create password reset token');
      // Still return success message to not reveal database errors
      return Response.json(successMessage, { status: 200 });
    }

    // In production, send email with reset link
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/reset-password?token=${resetToken}`;

    if (process.env.NODE_ENV === 'production') {
      // TODO: Implement email sending (SendGrid, Nodemailer, etc.)
      // Example: await sendPasswordResetEmail(user.email, resetUrl);
      logger.info({ userId: user.id, email: user.email }, 'Password reset email would be sent (not implemented yet)');
    } else {
      // Dev mode: log the reset URL for testing
      logger.info({ userId: user.id, resetUrl }, 'Password reset token created (DEV MODE)');
    }

    return Response.json(successMessage, { status: 200 });
  } catch (err) {
    logger.error({ err }, 'Error in forgot-password endpoint');
    return handleError(err);
  }
}
