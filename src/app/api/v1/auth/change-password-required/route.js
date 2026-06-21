import { authenticate, handleError } from '@/lib/auth-guard';
import { withTenantClient } from '@/lib/db';
import { getRequestContext } from '@/lib/request-context';
import bcrypt from 'bcryptjs';

export async function POST(request) {
  const context = getRequestContext(request);

  try {
    const authResult = await authenticate(request);
    if (authResult.error) {
      return Response.json({ error: authResult.error, code: authResult.code }, { status: authResult.status });
    }
    const { user } = authResult;

    const { currentPassword, newPassword, confirmPassword } = await request.json();

    if (!currentPassword || !newPassword || !confirmPassword) {
      return new Response(
        JSON.stringify({ error: 'All fields required' }),
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return new Response(
        JSON.stringify({ error: 'Passwords do not match' }),
        { status: 400 }
      );
    }

    if (newPassword.length < 10) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 10 characters' }),
        { status: 400 }
      );
    }

    const result = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      // Get current user account
      const { rows: userRows } = await client.query(
        `SELECT id, password_hash
           FROM care.user_accounts
          WHERE tenant_id = $1
            AND id = $2
            AND (staff_id IS NOT DISTINCT FROM $3 OR resident_id IS NOT DISTINCT FROM $4)`,
        [user.tenantId, user.id, user.staffId || null, user.residentId || null]
      );

      if (userRows.length === 0) {
        throw new Error('User account not found');
      }

      const userAccount = userRows[0];

      const passwordMatches = await bcrypt.compare(currentPassword, userAccount.password_hash);
      if (!passwordMatches) {
        return { error: 'Current password is incorrect', status: 401 };
      }

      // Hash new password with bcrypt
      const newPasswordHash = await bcrypt.hash(newPassword, 12);

      // Update password and clear temporary flag
      const { rows: updated } = await client.query(
        `UPDATE care.user_accounts
         SET password_hash = $1, password_changed_at = CURRENT_TIMESTAMP, password_changed_required = FALSE,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING id, email, username, staff_id, resident_id, password_changed_at`,
        [newPasswordHash, userAccount.id]
      );

      const updatedUser = updated[0];

      // Log password change in credential history
      await client.query(
        `INSERT INTO audit_log.credential_history (
          tenant_id, user_account_id, staff_id, resident_id, credential_type, username, password_hash,
          was_temporary, generated_by, password_changed_at, reason, notes, generated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, $10, $11, CURRENT_TIMESTAMP)`,
        [
          user.tenantId,
          userAccount.id,
          updatedUser.staff_id || user.staffId,
          updatedUser.resident_id,
          'reset',
          updatedUser.username,
          newPasswordHash,
          false,
          user.staffId,
          'First login password change (temporary credential replaced)',
          'User changed password from temporary to permanent',
        ]
      );

      return {
        success: true,
        message: 'Password changed successfully',
        user: updatedUser,
      };
    });

    if (result.error) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    return new Response(JSON.stringify(result), { status: 200 });
  } catch (error) {
    return handleError(error, context);
  }
}
