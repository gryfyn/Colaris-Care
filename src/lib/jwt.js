import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import logger from '@/lib/logger.js';

// Keys are resolved lazily on first use so the production BUILD never needs
// them (serverless build steps have no secrets). Resolution order:
//   1. Env vars  - JWT_PRIVATE_KEY_BASE64 / JWT_PUBLIC_KEY_BASE64 (base64 PEM),
//                  or JWT_PRIVATE_KEY / JWT_PUBLIC_KEY (raw PEM; \n is unescaped).
//                  Use these on Vercel / serverless where there is no filesystem.
//   2. Files     - JWT_PRIVATE_KEY_PATH / JWT_PUBLIC_KEY_PATH (containers / VMs).
//   3. Shared secret - JWT_SECRET_BASE64 / JWT_SECRET, then COOKIE_SECRET or
//                      TENANT_ENCRYPTION_KEY as a last-resort production-safe
//                      symmetric fallback when no RSA pair is configured.
//   4. Dev only  - insecure symmetric fallback so local dev works without keys.
let _keys = null;

function keyFromEnv(rawVar, b64Var) {
  if (process.env[b64Var]) return Buffer.from(process.env[b64Var], 'base64').toString('utf8');
  if (process.env[rawVar]) return process.env[rawVar].replace(/\\n/g, '\n');
  return null;
}

function keyFromSharedSecret() {
  if (process.env.JWT_SECRET_BASE64) {
    return Buffer.from(process.env.JWT_SECRET_BASE64, 'base64').toString('utf8');
  }

  const secret =
    process.env.JWT_SECRET ||
    process.env.COOKIE_SECRET ||
    process.env.TENANT_ENCRYPTION_KEY ||
    null;

  return secret ? String(secret) : null;
}

function loadKeys() {
  if (_keys) return _keys;

  let privateKey = keyFromEnv('JWT_PRIVATE_KEY', 'JWT_PRIVATE_KEY_BASE64');
  let publicKey  = keyFromEnv('JWT_PUBLIC_KEY',  'JWT_PUBLIC_KEY_BASE64');

  if (!privateKey || !publicKey) {
    try {
      if (!process.env.JWT_PRIVATE_KEY_PATH || !process.env.JWT_PUBLIC_KEY_PATH) {
        throw new Error('JWT key env vars and file paths are both unset');
      }
      privateKey = fs.readFileSync(path.resolve(process.env.JWT_PRIVATE_KEY_PATH), 'utf8');
      publicKey  = fs.readFileSync(path.resolve(process.env.JWT_PUBLIC_KEY_PATH),  'utf8');
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        logger.warn('DEV MODE: Using insecure symmetric JWT fallback. Generate proper RS256 keys for production.');
        privateKey = publicKey = 'dev-secret-key-not-for-production';
      } else {
        logger.error({ err }, 'Failed to load JWT keys — set JWT_PRIVATE_KEY_BASE64 / JWT_PUBLIC_KEY_BASE64 (serverless) or JWT_PRIVATE_KEY_PATH / JWT_PUBLIC_KEY_PATH (files)');
      }
    }
  }

  if (!privateKey || !publicKey) {
    const sharedSecret = keyFromSharedSecret();
    if (sharedSecret) {
      if (process.env.NODE_ENV === 'production') {
        logger.warn('JWT RSA keys unavailable; using shared-secret HS256 fallback from JWT_SECRET/COOKIE_SECRET/TENANT_ENCRYPTION_KEY.');
      }
      privateKey = sharedSecret;
      publicKey = sharedSecret;
    }
  }

  if (!privateKey || !publicKey) {
    if (process.env.NODE_ENV !== 'production') {
      logger.warn('DEV MODE: Using insecure symmetric JWT fallback. Generate proper RS256 keys for production.');
      privateKey = publicKey = 'dev-secret-key-not-for-production';
    } else {
      logger.error('Failed to load JWT keys — set JWT_PRIVATE_KEY_BASE64 / JWT_PUBLIC_KEY_BASE64, JWT_SECRET, or JWT_PRIVATE_KEY_PATH / JWT_PUBLIC_KEY_PATH');
      throw new Error('JWT keys not configured');
    }
  }

  const isAsymmetric = privateKey !== publicKey;
  _keys = { privateKey, publicKey, algo: isAsymmetric ? 'RS256' : 'HS256' };
  return _keys;
}

export function signAccessToken(payload) {
  const { privateKey, algo } = loadKeys();
  return jwt.sign(
    {
      sub:        payload.userId,
      tenantId:   payload.tenantId,
      role:       payload.role,
      staffId:    payload.staffId    || null,
      residentId: payload.residentId || null,
      jti:        uuidv4(),
      type:       'access',
    },
    privateKey,
    {
      algorithm: algo,
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '2h',
      issuer:    'dependable-care-api',
      audience:  'dependable-care-client',
    }
  );
}

export function signRefreshToken(payload) {
  const { privateKey, algo } = loadKeys();
  const jti   = uuidv4();
  const token = jwt.sign(
    {
      sub:      payload.userId,
      tenantId: payload.tenantId,
      role:     payload.role,
      staffId:  payload.staffId    || null,
      residentId: payload.residentId || null,
      jti,
      type:     'refresh',
    },
    privateKey,
    {
      algorithm: algo,
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '8h',
      issuer:    'dependable-care-api',
      audience:  'dependable-care-client',
    }
  );
  return { token, jti };
}

export function verifyToken(token, expectedType = 'access') {
  const { publicKey, algo } = loadKeys();
  const decoded = jwt.verify(token, publicKey, {
    algorithms: [algo],
    issuer:     'dependable-care-api',
    audience:   'dependable-care-client',
  });
  if (decoded.type !== expectedType) {
    throw new jwt.JsonWebTokenError(`Expected ${expectedType} token, got ${decoded.type}`);
  }
  return decoded;
}
