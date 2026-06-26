import crypto from 'crypto';

export function normalizePortalEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  return normalized.includes('@') ? normalized : '';
}

export function buildPortalCredentialNotice({ email, name, portal }) {
  const loginEmail = normalizePortalEmail(email);
  if (!loginEmail) return null;

  const localPart = loginEmail.split('@')[0].replace(/[^a-z0-9]/g, '').slice(0, 8) || 'portal';
  const randomPart = crypto.randomBytes(4).toString('hex');
  const temporaryPassword = `${localPart}-${randomPart}`;
  const portalLabel = portal === 'staff' ? 'staff portal' : 'resident portal';
  const displayName = String(name || 'New user').trim();

  return {
    title: `${displayName} ${portalLabel} credentials generated`,
    body: `Login email: ${loginEmail}. Temporary password: ${temporaryPassword}. This password was generated for display only and was not stored.`,
    portal: portalLabel,
    loginEmail,
    temporaryPassword,
  };
}
