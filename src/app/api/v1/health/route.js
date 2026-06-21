import { healthCheck } from '@/lib/db.js';

export async function GET() {
  try {
    const dbTime = await healthCheck();
    return Response.json({ status: 'ok', db: dbTime });
  } catch (err) {
    return Response.json({ status: 'error', error: err.message }, { status: 503 });
  }
}
