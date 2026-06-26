import { NextResponse } from 'next/server';
import { portalCookieName, verifyPortalSession } from '@/lib/portal-session.js';

// Prevent the browser from caching or bfcache-restoring protected pages. Without
// this, pressing Back then Forward can serve a cached authenticated render from
// the back/forward cache without re-running this guard, letting a logged-out user
// see app pages via history navigation. no-store forces a fresh request (and a
// fresh cookie/auth check) on every navigation.
function noStore(response) {
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  return response;
}

function loginRedirect(request, intent) {
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}&intent=${intent}`;
  return noStore(NextResponse.redirect(url));
}

function canUsePortal(session, portal) {
  if (!session?.role) return false;
  if (portal === 'admin') {
    return session.role === 'admin' || session.role === 'superadmin';
  }
  if (portal === 'staff') {
    return ['staff', 'manager', 'admin', 'superadmin'].includes(session.role);
  }
  return false;
}

export async function proxy(request) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(portalCookieName())?.value;
  const session = await verifyPortalSession(token);

  if (pathname.startsWith('/admin') && !canUsePortal(session, 'admin')) {
    return loginRedirect(request, 'admin');
  }

  if (pathname.startsWith('/staff') && !canUsePortal(session, 'staff')) {
    return loginRedirect(request, 'staff');
  }

  return noStore(NextResponse.next());
}

export const config = {
  matcher: ['/admin/:path*', '/staff/:path*'],
};
