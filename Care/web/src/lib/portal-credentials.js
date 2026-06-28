import crypto from 'crypto';

export function normalizePortalEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  return normalized.includes('@') ? normalized : '';
}

// Deterministic-ish temporary password for a freshly provisioned login.
export function generatePortalPassword(loginEmail) {
  const localPart = String(loginEmail || '').split('@')[0].replace(/[^a-z0-9]/g, '').slice(0, 8) || 'portal';
  const randomPart = crypto.randomBytes(4).toString('hex');
  return `${localPart}-${randomPart}`;
}

// Truthful notice for a real, stored staff login (vs. the display-only notice).
export function buildStaffLoginNotice({ loginEmail, name, password, created }) {
  const displayName = String(name || 'New staff member').trim();
  if (created) {
    return {
      title: `${displayName}'s staff login is ready`,
      body: `Share these so they can sign in to the staff portal. Login email: ${loginEmail}. Temporary password: ${password}. Ask them to change it after first sign-in.`,
      loginEmail,
      temporaryPassword: password,
      active: true,
    };
  }
  return {
    title: `${displayName} linked to this facility`,
    body: `An existing Colaris account (${loginEmail}) was added to this facility as staff. Their existing password is unchanged.`,
    loginEmail,
    active: true,
  };
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
