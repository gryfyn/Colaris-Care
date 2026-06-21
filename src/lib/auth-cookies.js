export const REFRESH_COOKIE_PATH = '/api/v1/auth';

function refreshCookieAttributes(maxAge) {
  return [
    `Path=${REFRESH_COOKIE_PATH}`,
    `Max-Age=${maxAge}`,
    'HttpOnly',
    'SameSite=Strict',
    process.env.NODE_ENV === 'production' ? 'Secure' : null,
  ].filter(Boolean);
}

export function serializeRefreshCookie(token, maxAge) {
  return [
    `refresh_token=${encodeURIComponent(token)}`,
    ...refreshCookieAttributes(maxAge),
  ].join('; ');
}

export function serializeDeletedRefreshCookie() {
  return [
    'refresh_token=',
    ...refreshCookieAttributes(0),
  ].join('; ');
}

// Emit a single, explicit Set-Cookie header. We deliberately do NOT also call
// response.cookies.set(): Headers.set() replaces any cookie the response API
// wrote, so the two together just risk a duplicate/ambiguous Set-Cookie.
export function setRefreshCookie(response, token, maxAge) {
  response.headers.set('Set-Cookie', serializeRefreshCookie(token, maxAge));
}

export function deleteRefreshCookie(response) {
  response.headers.set('Set-Cookie', serializeDeletedRefreshCookie());
}
