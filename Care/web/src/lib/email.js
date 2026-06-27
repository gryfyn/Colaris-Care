// Transactional email via the Resend REST API (no SDK). Safe no-op when
// RESEND_API_KEY is absent so flows can fall back to an in-app verify link.
export async function sendEmail({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || 'Colaris <onboarding@resend.dev>';
  if (!apiKey) return { sent: false, reason: 'not_configured' };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html, text }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { sent: false, reason: data?.message || `http_${res.status}` };
    return { sent: true, id: data.id };
  } catch (err) {
    return { sent: false, reason: err.message };
  }
}

export function verificationEmail(link) {
  return {
    subject: 'Verify your email — Colaris',
    text: `Welcome to Colaris.\n\nConfirm your email to finish setting up your facility:\n${link}\n\nIf you didn't request this, you can ignore this message.`,
    html: `<div style="font-family:Inter,Segoe UI,Arial,sans-serif;max-width:480px;margin:0 auto;color:#1B2835">
      <div style="font-weight:800;font-size:20px;letter-spacing:-0.02em;color:#0F172A">Colaris</div>
      <h1 style="font-size:22px;line-height:1.2;color:#0F172A;margin:18px 0 8px">Confirm your email</h1>
      <p style="font-size:15px;line-height:1.6;color:#475569;margin:0 0 22px">Welcome to Colaris. Confirm your email to finish setting up your facility.</p>
      <a href="${link}" style="display:inline-block;background:#0F766E;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 24px;border-radius:999px">Verify email</a>
      <p style="font-size:12.5px;line-height:1.6;color:#94A3B8;margin:24px 0 0">If the button doesn't work, paste this link:<br>${link}</p>
    </div>`,
  };
}
