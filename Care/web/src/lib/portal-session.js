const COOKIE_NAME = 'colaris_portal';
const MAX_AGE_SECONDS = 15 * 60;

function base64UrlEncode(bytes) {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  const base64 = typeof btoa === 'function'
    ? btoa(binary)
    : Buffer.from(binary, 'binary').toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value) {
  const base64 = String(value).replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(String(value).length / 4) * 4, '=');
  if (typeof atob === 'function') {
    const binary = atob(base64);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  }
  return Uint8Array.from(Buffer.from(base64, 'base64'));
}

async function hmacKey() {
  const secret = process.env.COOKIE_SECRET || process.env.JWT_SECRET || process.env.TENANT_ENCRYPTION_KEY || 'dev-cookie-secret-change-in-production';
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function signPortalSession(payload) {
  const now = Math.floor(Date.now() / 1000);
  const body = {
    sub: payload.userId,
    role: payload.role,
    organizationId: payload.organizationId,
    facilityId: payload.facilityId,
    staffId: payload.staffId || null,
    exp: now + MAX_AGE_SECONDS,
  };
  const encodedBody = base64UrlEncode(new TextEncoder().encode(JSON.stringify(body)));
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(), new TextEncoder().encode(encodedBody));
  return `${encodedBody}.${base64UrlEncode(signature)}`;
}

export async function verifyPortalSession(token) {
  if (!token || !String(token).includes('.')) return null;
  const [encodedBody, encodedSignature] = String(token).split('.');
  const valid = await crypto.subtle.verify(
    'HMAC',
    await hmacKey(),
    base64UrlDecode(encodedSignature),
    new TextEncoder().encode(encodedBody)
  );
  if (!valid) return null;

  const decoded = JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedBody)));
  if (!decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) return null;
  return decoded;
}

export function portalCookieName() {
  return COOKIE_NAME;
}

export function portalCookieMaxAge() {
  return MAX_AGE_SECONDS;
}
