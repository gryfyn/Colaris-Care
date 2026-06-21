const env = {
  NODE_ENV:               process.env.NODE_ENV || 'development',
  PORT:                   parseInt(process.env.PORT || '3000'),
  API_VERSION:            process.env.API_VERSION || 'v1',
  DATABASE_URL:           process.env.DATABASE_URL,
  JWT_SECRET:             process.env.JWT_SECRET || process.env.COOKIE_SECRET || process.env.TENANT_ENCRYPTION_KEY || null,
  JWT_PRIVATE_KEY_PATH:   process.env.JWT_PRIVATE_KEY_PATH,
  JWT_PUBLIC_KEY_PATH:    process.env.JWT_PUBLIC_KEY_PATH,
  JWT_ACCESS_EXPIRES_IN:  process.env.JWT_ACCESS_EXPIRES_IN  || '2h',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '8h',
  ALLOWED_ORIGINS:        process.env.ALLOWED_ORIGINS || 'http://localhost:3000',
  COOKIE_SECRET:          process.env.COOKIE_SECRET  || 'dev-cookie-secret-change-in-production',
  RATE_LIMIT_WINDOW_MS:   parseInt(process.env.RATE_LIMIT_WINDOW_MS    || '60000'),
  RATE_LIMIT_MAX:         parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  AUTH_RATE_LIMIT_MAX:    parseInt(process.env.AUTH_RATE_LIMIT_MAX     || '5'),
};

export default env;
