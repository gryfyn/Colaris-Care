import { portalCookieMaxAge, portalCookieName, signPortalSession } from '@/lib/portal-session.js';

export const REFRESH_COOKIE_PATH = '/api/auth';

function cookieAttributes(maxAge, path = REFRESH_COOKIE_PATH) {
  return [
    `Path=${path}`,
    `Max-Age=${maxAge}`,
    'HttpOnly',
    'SameSite=Strict',
    process.env.NODE_ENV === 'production' ? 'Secure' : null,
  ].filter(Boolean);
}

export function serializeRefreshCookie(token, maxAge) {
  return [
    `refresh_token=${encodeURIComponent(token)}`,
    ...cookieAttributes(maxAge),
  ].join('; ');
}

export function serializeDeletedRefreshCookie() {
  return [
    'refresh_token=',
    ...cookieAttributes(0),
  ].join('; ');
}

export async function serializePortalCookie(payload) {
  return [
    `${portalCookieName()}=${encodeURIComponent(await signPortalSession(payload))}`,
    ...cookieAttributes(portalCookieMaxAge(), '/'),
  ].join('; ');
}

export function serializeDeletedPortalCookie() {
  return [
    `${portalCookieName()}=`,
    ...cookieAttributes(0, '/'),
  ].join('; ');
}

function appendCookie(response, value) {
  response.headers.append('Set-Cookie', value);
}

export function setRefreshCookie(response, token, maxAge) {
  appendCookie(response, serializeRefreshCookie(token, maxAge));
}

export async function setPortalCookie(response, payload) {
  appendCookie(response, await serializePortalCookie(payload));
}

export function deleteAuthCookies(response) {
  appendCookie(response, serializeDeletedRefreshCookie());
  appendCookie(response, serializeDeletedPortalCookie());
}
