import crypto from 'crypto';
import { PERMISSIONS } from '@/lib/roles.js';
import { withApiContext } from '@/lib/api-helpers.js';

// Parse cloudinary://<api_key>:<api_secret>@<cloud_name>. The api_secret never
// leaves the server — only a short-lived signature does.
function cloudinaryConfig() {
  const raw = process.env.CLOUDINARY_URL;
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return { apiKey: u.username, apiSecret: decodeURIComponent(u.password), cloudName: u.hostname };
  } catch {
    return null;
  }
}

// Cloudinary signs the alphabetically-sorted params joined as k=v&k=v with the
// api_secret appended, hashed with SHA-1.
function sign(params, apiSecret) {
  const toSign = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&');
  return crypto.createHash('sha1').update(toSign + apiSecret).digest('hex');
}

// Returns a signed upload payload the browser uses to POST an image directly to
// Cloudinary. Any authenticated facility user may upload a portrait.
export async function GET(request) {
  return withApiContext(request, PERMISSIONS.STAFF_READ, 'uploads:sign', async ({ user }) => {
    const cfg = cloudinaryConfig();
    if (!cfg) {
      const err = new Error('Image uploads are not configured');
      err.status = 503;
      throw err;
    }
    const { searchParams } = new URL(request.url);
    const kind = searchParams.get('kind') === 'staff' ? 'staff' : 'residents';
    // Scope uploads to the tenant + kind so the media library stays organized.
    const folder = `colaris/${user.organizationId}/${kind}`;
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = sign({ folder, timestamp }, cfg.apiSecret);
    return { cloudName: cfg.cloudName, apiKey: cfg.apiKey, timestamp, folder, signature };
  });
}
