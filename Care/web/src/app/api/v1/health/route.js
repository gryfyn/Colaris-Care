export async function GET() {
  return Response.json({
    ok: true,
    service: 'colaris-care-web',
    status: 'live',
    ts: new Date().toISOString(),
  });
}
