import { NextResponse } from 'next/server';

export function proxy(request) {
  const response = NextResponse.next();

  // Assign a request ID for tracing
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID();
  response.headers.set('x-request-id', requestId);

  // CORS
  const origin         = request.headers.get('origin');
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map(s => s.trim());

  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set('access-control-allow-origin',   origin);
    response.headers.set('access-control-allow-credentials', 'true');
    response.headers.set('access-control-allow-methods',  'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    response.headers.set('access-control-allow-headers',  'Content-Type,Authorization,X-Request-ID');
  }

  // Short-circuit preflight requests
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: response.headers });
  }

  return response;
}

export const config = {
  matcher: '/api/:path*',
};
