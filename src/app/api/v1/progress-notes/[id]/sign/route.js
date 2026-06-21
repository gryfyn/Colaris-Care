import { authenticate, authorize, getRequestContext, handleError } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';

const audit = new AuditLogger();

export async function POST(request, context) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!authorize(user.role, PERMISSIONS.PROGRESS_NOTES_SIGN)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;

    const { rows } = await withTenantClient(user.tenantId, user.staffId, (c) =>
      c.query(
        `UPDATE care.progress_notes SET signed_at = NOW() WHERE id = $1 AND signed_at IS NULL AND deleted_at IS NULL RETURNING *`,
        [id]
      )
    );
    if (!rows.length) return Response.json({ error: 'Note not found or already signed' }, { status: 404 });

    const req = getRequestContext(request, user);
    await audit.log({ eventType: 'PROGRESS_NOTE_SIGN', tableName: 'care.progress_notes', recordId: id, req, phiAccessed: true });

    return Response.json({ message: 'Progress note signed and locked', signedAt: rows[0].signed_at });
  } catch (err) {
    return handleError(err);
  }
}
