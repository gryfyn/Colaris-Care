import { PERMISSIONS } from '@/lib/roles.js';
import { withApiContext } from '@/lib/api-helpers.js';
import { presignGet } from '@/lib/r2.js';

// Mints a short-lived presigned GET URL for a stored document. RLS scopes the
// documents row to the caller's tenant, so only authorized facility users can
// retrieve a viewable link; the link itself expires in a few minutes.
export async function GET(request, { params }) {
  const { id } = await params;
  return withApiContext(request, PERMISSIONS.RESIDENTS_READ, 'documents:read', async ({ client }) => {
    const { rows } = await client.query(
      `select id, title, document_type, object_key from care.documents where id = $1 limit 1`,
      [id]
    );
    if (!rows.length || !rows[0].object_key) {
      const err = new Error('Document not found');
      err.status = 404;
      throw err;
    }
    return {
      id: rows[0].id,
      title: rows[0].title,
      documentType: rows[0].document_type,
      url: presignGet(rows[0].object_key, 300),
    };
  });
}
