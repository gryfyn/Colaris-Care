import { NextResponse } from 'next/server';
import { portalCookieName, verifyPortalSession } from '@/lib/portal-session.js';

function loginRedirect(request, intent) {
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}&intent=${intent}`;
  return NextResponse.redirect(url);
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

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/staff/:path*'],
};
