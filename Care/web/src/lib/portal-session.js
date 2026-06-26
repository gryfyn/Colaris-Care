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

const DEV_FALLBACK_SECRET = 'dev-cookie-secret-change-in-production';

// The portal session cookie is the credential the middleware (proxy.js) trusts
// to authorize /admin and /staff access. Its HMAC key MUST be a real secret in
// production — never the public dev fallback — or an attacker who knows the
// fallback could forge an admin session cookie. Fail closed if misconfigured.
function resolvePortalSecret() {
  const secret = process.env.COOKIE_SECRET || process.env.JWT_SECRET || process.env.TENANT_ENCRYPTION_KEY;
  if (process.env.NODE_ENV === 'production') {
    if (!secret || secret.length < 16 || secret === DEV_FALLBACK_SECRET) {
      throw new Error(
        'COOKIE_SECRET (or JWT_SECRET) must be set to a strong value (>= 16 chars) in production to sign portal sessions. Generate with: openssl rand -hex 32'
      );
    }
    return secret;
  }
  return secret || DEV_FALLBACK_SECRET;
}

async function hmacKey() {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(resolvePortalSecret()),
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
