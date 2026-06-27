import { query } from '@/lib/db.js';

// Confirms a signup's email from its one-time token.
export async function POST(request) {
  const { token } = await request.json().catch(() => ({}));
  if (!token) return Response.json({ error: 'Missing verification token.' }, { status: 400 });
  const { rows } = await query('select app.signup_verify($1) as email', [token]);
  if (!rows[0]?.email) {
    return Response.json({ error: 'This verification link is invalid or has already been used.' }, { status: 400 });
  }
  return Response.json({ ok: true, email: rows[0].email });
}

// Lets the verify / onboarding screens check signup status by token.
export async function GET(request) {
  const token = new URL(request.url).searchParams.get('token');
  if (!token) return Response.json({ error: 'Missing token.' }, { status: 400 });
  const { rows } = await query('select * from app.signup_status($1)', [token]);
  const s = rows[0];
  if (!s) return Response.json({ error: 'Unknown signup.' }, { status: 404 });
  return Response.json({ email: s.email, displayName: s.display_name, verified: s.verified, completed: s.completed });
}
