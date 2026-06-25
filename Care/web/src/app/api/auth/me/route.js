import { requireUser, authErrorResponse } from '@/lib/auth-guard.js';

export async function GET(request) {
  try {
    const user = await requireUser(request);
    return Response.json({ user });
  } catch (err) {
    return authErrorResponse(err);
  }
}
