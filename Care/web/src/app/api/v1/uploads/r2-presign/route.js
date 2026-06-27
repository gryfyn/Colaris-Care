import { PERMISSIONS } from '@/lib/roles.js';
import { readJson, withApiContext } from '@/lib/api-helpers.js';
import { presignPut, buildObjectKey, r2Configured } from '@/lib/r2.js';

// Returns a short-lived presigned PUT URL so the browser can upload a document
// directly to the private R2 bucket (no Vercel body-size limit). The caller then
// records the returned objectKey via POST /api/v1/documents.
export async function POST(request) {
  return withApiContext(request, PERMISSIONS.STAFF_READ, 'uploads:presign', async ({ user }) => {
    if (!r2Configured()) {
      const err = new Error('Document storage is not configured');
      err.status = 503;
      throw err;
    }
    const body = await readJson(request);
    const scope = body.scope === 'staff' ? 'staff' : 'residents';
    const objectKey = buildObjectKey(user.organizationId, scope, body.filename);
    return { uploadUrl: presignPut(objectKey, 600), objectKey };
  });
}
