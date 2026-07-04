import { requireUser, AuthError, authErrorResponse } from '@/lib/auth-guard.js';
import { query } from '@/lib/db.js';
import { hashPassword, verifyPassword } from '@/lib/passwords.js';
import logger from '@/lib/logger.js';

// POST /api/auth/change-password  — authenticated self-service password change.
// Body: { currentPassword, newPassword }
export async function POST(request) {
  try {
    const user = await requireUser(request);

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON request body' }, { status: 400 });
    }

    const currentPassword = String(body?.currentPassword || '');
    const newPassword = String(body?.newPassword || '');

    if (!currentPassword || !newPassword) {
      return Response.json({ error: 'currentPassword and newPassword are required' }, { status: 422 });
    }
    if (newPassword.length < 8) {
      return Response.json({ error: 'New password must be at least 8 characters.' }, { status: 422 });
    }

    const { rows } = await query('select app.user_password_hash($1) as hash', [user.id]);
    const hash = rows[0]?.hash;
    if (!hash) {
      return Response.json({ error: 'Account not found' }, { status: 404 });
    }
    if (!verifyPassword(currentPassword, hash)) {
      return Response.json({ error: 'Current password is incorrect.' }, { status: 401 });
    }
    if (verifyPassword(newPassword, hash)) {
      return Response.json({ error: 'New password must be different from the current one.' }, { status: 422 });
    }

    await query('select app.set_user_password($1, $2) as ok', [user.id, hashPassword(newPassword)]);

    return Response.json({ data: { message: 'Password changed successfully.' } });
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    logger.error({ err }, '[auth/change-password] failure');
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
