/**
 * GET /api/v1/csrf
 *
 * Issues a fresh CSRF token in a non-httpOnly cookie and returns the value
 * in the response body so the client can store it in memory and attach it as
 * the X-CSRF-Token header on subsequent state-changing requests.
 *
 * This endpoint must be called once per page-load / session start before any
 * POST/PATCH/PUT/DELETE request is made.
 */
import { NextResponse } from 'next/server';
import { generateCsrfToken, attachCsrfCookie } from '@/lib/csrf.js';

export async function GET() {
  const token = generateCsrfToken();
  const response = NextResponse.json({ csrfToken: token });
  attachCsrfCookie(response, token);
  return response;
}
