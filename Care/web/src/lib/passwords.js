import crypto from 'crypto';

const KEY_LENGTH = 64;
const DEFAULT_COST = 16384;

function timingSafeStringEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function hashPassword(password, options = {}) {
  const salt = crypto.randomBytes(16).toString('hex');
  const cost = options.cost || DEFAULT_COST;
  const key = crypto.scryptSync(String(password), salt, KEY_LENGTH, { N: cost }).toString('hex');
  return `scrypt$${cost}$${salt}$${key}`;
}

export function verifyPassword(password, storedHash) {
  if (!password || !storedHash) return false;

  const parts = String(storedHash).split('$');
  if (parts[0] === 'scrypt' && parts.length === 4) {
    const [, costRaw, salt, expected] = parts;
    const cost = Number(costRaw);
    if (!Number.isFinite(cost) || !salt || !expected) return false;
    const actual = crypto.scryptSync(String(password), salt, KEY_LENGTH, { N: cost }).toString('hex');
    return timingSafeStringEqual(actual, expected);
  }

  if (parts[0] === 'sha256' && parts.length === 2) {
    const actual = crypto.createHash('sha256').update(String(password)).digest('hex');
    return timingSafeStringEqual(actual, parts[1]);
  }

  if (/^[a-f0-9]{64}$/i.test(String(storedHash))) {
    const actual = crypto.createHash('sha256').update(String(password)).digest('hex');
    return timingSafeStringEqual(actual, storedHash);
  }

  return false;
}
