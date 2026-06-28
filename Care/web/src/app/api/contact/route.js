import { sendEmail } from '@/lib/email.js';
import { checkRateLimit } from '@/lib/rate-limiter.js';
import logger from '@/lib/logger.js';

const esc = (s) => String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

// Marketing contact + demo-request forms post here; we relay the lead to the
// support inbox via Resend. Always returns ok to the browser (no provider leak).
export async function POST(request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  const limit = await checkRateLimit(`lead:${ip}`, 6, 60).catch(() => ({ allowed: true }));
  if (limit && limit.allowed === false) {
    return Response.json({ error: 'Too many submissions — please try again shortly.' }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return Response.json({ error: 'A valid email is required.' }, { status: 400 });
  }
  const kind = body.kind === 'demo' ? 'Demo request' : 'Contact message';

  const fields = Object.entries(body)
    .filter(([k]) => k !== 'kind')
    .map(([k, v]) => `${k}: ${String(v ?? '').slice(0, 4000)}`)
    .join('\n');

  const result = await sendEmail({
    to: 'support@getcolaris.com',
    replyTo: email,
    subject: `${kind} from ${name || email}`,
    text: `New ${kind.toLowerCase()} via getcolaris.com\n\n${fields}`,
    html: `<h3 style="font-family:Inter,Arial">New ${kind.toLowerCase()}</h3><pre style="font-family:Inter,Arial;white-space:pre-wrap;font-size:14px">${esc(fields)}</pre>`,
  });
  if (!result.sent) logger.warn({ reason: result.reason }, '[contact] lead email not delivered');

  return Response.json({ ok: true });
}
