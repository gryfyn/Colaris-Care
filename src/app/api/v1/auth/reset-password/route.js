import bcrypt from 'bcryptjs';
import { query } from '@/lib/db.js';
import { handleError } from '@/lib/auth-guard.js';
import { AuditLogger } from '@/lib/audit-logger.js';
import logger from '@/lib/logger.js';

const audit = new AuditLogger();

export async function POST(request) {
  try {
    const { token, newPassword } = await request.json();

    if (!token || !newPassword) {
      return Response.json({ error: 'Token and newPassword are required' }, { status: 422 });
    }

    // Validate password length (minimum 8 characters)
    if (newPassword.length < 8) {
      return Response.json({ error: 'Password must be at least 8 characters long' }, { status: 422 });
    }

    // Find the reset token record
    const { rows: tokenRows } = await query(
      `SELECT id, user_id, token_hash, expires_at, used_at
       FROM care.password_reset_tokens
       WHERE used_at IS NULL
       ORDER BY created_at DESC
       LIMIT 100`,
      []
    );

    if (!tokenRows.length) {
      return Response.json({ error: 'Invalid or expired reset token' }, { status: 401 });
    }

    // Find matching token by comparing with hash
    let validToken = null;
    for (const row of tokenRows) {
      const isMatch = await bcrypt.compare(token, row.token_hash);
      if (isMatch) {
        validToken = row;
        break;
      }
    }

    if (!validToken) {
      return Response.json({ error: 'Invalid or expired reset token' }, { status: 401 });
    }

    // Check expiration
    if (new Date(validToken.expires_at) < new Date()) {
      return Response.json({ error: 'Reset token has expired' }, { status: 401 });
    }

    // Get user to verify it still exists
    const { rows: userRows } = await query(
      'SELECT id FROM care.user_accounts WHERE id = $1 AND is_active = TRUE',
      [validToken.user_id]
    );

    if (!userRows.length) {
      return Response.json({ error: 'User account not found' }, { status: 404 });
    }

    // Hash new password
    const newHash = await bcrypt.hash(newPassword, 12);

    // Update user password and mark token as used
    try {
      await query('BEGIN', []);

      await query(
        `UPDATE care.user_accounts
         SET password_hash = $1, password_changed_at = NOW(), failed_attempts = 0, locked_until = NULL
         WHERE id = $2`,
        [newHash, validToken.user_id]
      );

      await query(
        `UPDATE care.password_reset_tokens
         SET used_at = NOW()
         WHERE id = $1`,
        [validToken.id]
      );

      await query('COMMIT', []);

      // Audit log
      const req = {
        user: { id: validToken.user_id, role: 'unknown' },
        ip: request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown',
      };
      await audit.log({
        eventType: 'PASSWORD_RESET_SUCCESSFUL',
        tableName: 'care.user_accounts',
        recordId: validToken.user_id,
        phiAccessed: false,
        req,
      });

      return Response.json({ message: 'Password reset successfully. You can now log in with your new password.' }, { status: 200 });
    } catch (err) {
      await query('ROLLBACK', []);
      logger.error({ err, userId: validToken.user_id }, 'Failed to reset password');
      return Response.json({ error: 'Failed to reset password' }, { status: 500 });
    }
  } catch (err) {
    logger.error({ err }, 'Error in reset-password endpoint');
    return handleError(err);
  }
}
