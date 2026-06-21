import bcrypt from 'bcryptjs';
import { authenticate, getRequestContext, handleError } from '@/lib/auth-guard.js';
import { query } from '@/lib/db.js';
import { AuditLogger } from '@/lib/audit-logger.js';

const audit = new AuditLogger();

export async function POST(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }
    const { user } = authResult;

    const { currentPassword, newPassword } = await request.json();
    if (!currentPassword || !newPassword) {
      return Response.json({ error: 'currentPassword and newPassword are required' }, { status: 422 });
    }

    const { rows } = await query(
      'SELECT password_hash FROM care.user_accounts WHERE id = $1',
      [user.id]
    );
    if (!rows.length) return Response.json({ error: 'Account not found' }, { status: 404 });

    const match = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!match) return Response.json({ error: 'Current password is incorrect' }, { status: 401 });

    const newHash = await bcrypt.hash(newPassword, 12);
    await query(
      'UPDATE care.user_accounts SET password_hash = $1, password_changed_at = NOW() WHERE id = $2',
      [newHash, user.id]
    );

    const req = getRequestContext(request, user);
    await audit.log({ eventType: 'PASSWORD_CHANGE', tableName: 'care.user_accounts', recordId: user.id, phiAccessed: false, req });

    return Response.json({ message: 'Password changed successfully' });
  } catch (err) {
    return handleError(err);
  }
}
