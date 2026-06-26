import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import logger from '@/lib/logger.js';

let keys = null;

function keyFromEnv(rawVar, b64Var) {
  if (process.env[b64Var]) return Buffer.from(process.env[b64Var], 'base64').toString('utf8');
  if (process.env[rawVar]) return process.env[rawVar].replace(/\\n/g, '\n');
  return null;
}

function loadKeys() {
  if (keys) return keys;

  let privateKey = keyFromEnv('JWT_PRIVATE_KEY', 'JWT_PRIVATE_KEY_BASE64');
  let publicKey = keyFromEnv('JWT_PUBLIC_KEY', 'JWT_PUBLIC_KEY_BASE64');
  const isTest = process.env.NODE_ENV === 'test';

  if (!privateKey || !publicKey) {
    try {
      if (!process.env.JWT_PRIVATE_KEY_PATH || !process.env.JWT_PUBLIC_KEY_PATH) {
        throw new Error('JWT key env vars and file paths are unset');
      }
      privateKey = fs.readFileSync(path.resolve(process.env.JWT_PRIVATE_KEY_PATH), 'utf8');
      publicKey = fs.readFileSync(path.resolve(process.env.JWT_PUBLIC_KEY_PATH), 'utf8');
    } catch (err) {
      if (isTest) {
        logger.warn('TEST MODE: Using symmetric JWT fallback.');
        privateKey = publicKey = 'dev-secret-key-not-for-production';
      } else {
        logger.error({ err }, 'JWT keys are not configured');
        throw new Error('JWT RS256 keys are not configured');
      }
    }
  }

  const isAsymmetric = privateKey !== publicKey;
  if (!isAsymmetric && !isTest) {
    throw new Error('JWT RS256 requires distinct private and public keys');
  }

  keys = { privateKey, publicKey, algo: isAsymmetric ? 'RS256' : 'HS256' };
  return keys;
}

function tokenPayload(payload, type) {
  return {
    sub: payload.userId,
    organizationId: payload.organizationId || payload.tenantId,
    tenantId: payload.organizationId || payload.tenantId,
    facilityId: payload.facilityId || null,
    role: payload.role,
    staffId: payload.staffId || null,
    residentId: payload.residentId || null,
    jti: uuidv4(),
    type,
  };
}

export function signAccessToken(payload) {
  const { privateKey, algo } = loadKeys();
  return jwt.sign(tokenPayload(payload, 'access'), privateKey, {
    algorithm: algo,
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '2h',
    issuer: 'colaris-care-api',
    audience: 'colaris-care-client',
  });
}

export function signRefreshToken(payload) {
  const { privateKey, algo } = loadKeys();
  const body = tokenPayload(payload, 'refresh');
  const token = jwt.sign(body, privateKey, {
    algorithm: algo,
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '8h',
    issuer: 'colaris-care-api',
    audience: 'colaris-care-client',
  });
  return { token, jti: body.jti };
}

export function decodeToken(token) {
  // Decode without verifying the signature — used to read jti/exp at logout so a
  // revocation can be recorded even if the token is otherwise close to expiry.
  return jwt.decode(token);
}

export function verifyToken(token, expectedType = 'access') {
  const { publicKey, algo } = loadKeys();
  const decoded = jwt.verify(token, publicKey, {
    algorithms: [algo],
    issuer: 'colaris-care-api',
    audience: 'colaris-care-client',
  });
  if (decoded.type !== expectedType) {
    throw new jwt.JsonWebTokenError(`Expected ${expectedType} token, got ${decoded.type}`);
  }
  return decoded;
}
