import crypto from 'crypto';
import { authenticate, handleError, getRequestContext } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { AuditLogger } from '@/lib/audit-logger.js';

const audit = new AuditLogger();
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function cloudinaryConfig() {
  const cloudinaryUrl = process.env.CLOUDINARY_URL;
  if (cloudinaryUrl) {
    const match = cloudinaryUrl.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/i);
    if (match) {
      return {
        apiKey: match[1],
        apiSecret: match[2],
        cloudName: match[3],
      };
    }
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const missing = [];
  if (!cloudName) missing.push('CLOUDINARY_CLOUD_NAME');
  if (!apiKey) missing.push('CLOUDINARY_API_KEY');
  if (!apiSecret) missing.push('CLOUDINARY_API_SECRET');
  if (missing.length) {
    throw { status: 503, message: `Cloudinary is not configured: missing ${missing.join(', ')}` };
  }
  return { cloudName, apiKey, apiSecret };
}

function signUpload(params, apiSecret) {
  const payload = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  return crypto.createHash('sha1').update(`${payload}${apiSecret}`).digest('hex');
}

export async function POST(request, context) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error }, { status: authResult.status });
    const { user } = authResult;

    if (!['admin', 'manager', 'superadmin'].includes(user.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    const formData = await request.formData();
    const file = formData.get('photo');
    if (!file || typeof file.arrayBuffer !== 'function') {
      return Response.json({ error: 'photo file is required' }, { status: 422 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return Response.json({ error: 'Photo must be JPEG, PNG, or WebP' }, { status: 415 });
    }
    if (file.size > MAX_PHOTO_BYTES) {
      return Response.json({ error: 'Photo must be 5 MB or smaller' }, { status: 413 });
    }

    const sheet = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const { rows } = await client.query(
        'SELECT id, resident_id FROM care.resident_face_sheets WHERE id = $1 AND tenant_id = $2',
        [id, user.tenantId]
      );
      return rows[0];
    });
    if (!sheet) return Response.json({ error: 'Face sheet not found' }, { status: 404 });

    const { cloudName, apiKey, apiSecret } = cloudinaryConfig();
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `dcllc/${user.tenantId}/face-sheets`;
    const publicId = String(sheet.resident_id);
    const uploadParams = {
      folder,
      overwrite: 'true',
      public_id: publicId,
      timestamp,
      transformation: 'c_fill,g_face,w_800,h_800,q_auto',
    };
    const signature = signUpload(uploadParams, apiSecret);

    const uploadBody = new FormData();
    uploadBody.set('file', file);
    uploadBody.set('api_key', apiKey);
    uploadBody.set('timestamp', String(timestamp));
    uploadBody.set('signature', signature);
    uploadBody.set('folder', folder);
    uploadBody.set('public_id', publicId);
    uploadBody.set('overwrite', 'true');
    uploadBody.set('transformation', uploadParams.transformation);

    const cloudRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: uploadBody,
    });
    const cloudData = await cloudRes.json().catch(() => ({}));
    if (!cloudRes.ok) {
      return Response.json(
        { error: cloudData.error?.message || 'Cloudinary upload failed' },
        { status: cloudRes.status || 502 }
      );
    }

    const metadata = {
      public_id: cloudData.public_id,
      format: cloudData.format,
      bytes: cloudData.bytes,
      width: cloudData.width,
      height: cloudData.height,
      resource_type: cloudData.resource_type,
      version: cloudData.version,
    };

    const updated = await withTenantClient(user.tenantId, user.staffId, async (client) => {
      const { rows } = await client.query(
        `UPDATE care.resident_face_sheets
            SET photo_url = $1,
                photo_public_id = $2,
                photo_uploaded_at = NOW(),
                photo_metadata = $3,
                last_updated_by = $4,
                updated_at = NOW()
          WHERE id = $5 AND tenant_id = $6
          RETURNING id, resident_id, photo_url, photo_public_id, photo_uploaded_at, photo_metadata`,
        [
          cloudData.secure_url,
          cloudData.public_id,
          JSON.stringify(metadata),
          user.staffId,
          id,
          user.tenantId,
        ]
      );
      return rows[0];
    });

    await audit.logUpdate({
      tableName: 'care.resident_face_sheets',
      recordId: id,
      residentId: sheet.resident_id,
      diffKeys: ['photo_url', 'photo_public_id'],
      req: getRequestContext(request, user),
    });

    return Response.json({ data: updated });
  } catch (err) {
    if (err?.status) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return handleError(err);
  }
}
