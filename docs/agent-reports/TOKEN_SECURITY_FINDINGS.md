# JWT & Token Security Audit
**Date**: 2026-05-16  
**Status**: MIXED - CRITICAL TOKEN STORAGE VULNERABILITY

---

## Executive Summary
JWT implementation uses industry-standard RS256 asymmetric signing with proper expiry times. However, **access tokens are stored in localStorage (XSS vulnerability)** instead of secure HTTP-only cookies, and refresh token rotation has a critical race condition window.

---

## 1. JWT Implementation Review

### Access Token Generation ✓ CORRECT
**File**: `src/lib/jwt.js` lines 29-47

```javascript
export function signAccessToken(payload) {
  return jwt.sign(
    {
      sub:      payload.userId,
      tenantId: payload.tenantId,
      role:     payload.role,
      staffId:  payload.staffId || null,
      jti:      uuidv4(),
      type:     'access',
    },
    privateKey,
    {
      algorithm: SIGN_ALGO,
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
      issuer:    'dependable-care-api',
      audience:  'dependable-care-client',
    }
  );
}
```

**ASSESSMENT**: ✓ Proper claims structure
- `sub` (subject): User ID
- `jti` (JWT ID): Unique token identifier for tracking
- `type`: Token type discrimination (access vs refresh)
- Expiry: **15 minutes** (short-lived, best practice)
- Signing algorithm: RS256 (asymmetric, resistant to key guessing)

### Refresh Token Implementation ✓ CORRECT
**File**: `src/lib/jwt.js` lines 49-67

```javascript
export function signRefreshToken(payload) {
  const jti   = uuidv4();
  const token = jwt.sign(
    {
      sub:      payload.userId,
      tenantId: payload.tenantId,
      jti,
      type:     'refresh',
    },
    privateKey,
    {
      algorithm: SIGN_ALGO,
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '8h',
      issuer:    'dependable-care-api',
      audience:  'dependable-care-client',
    }
  );
  return { token, jti };
}
```

**ASSESSMENT**: ✓ Proper long-lived token
- Expiry: **8 hours** (longer lifetime, still reasonable)
- Includes JTI for revocation tracking
- Returns both token and JTI for Redis storage

### Token Verification ✓ SECURE
**File**: `src/lib/jwt.js` lines 69-79

```javascript
export function verifyToken(token, expectedType = 'access') {
  const decoded = jwt.verify(token, publicKey, {
    algorithms: [SIGN_ALGO],
    issuer:     'dependable-care-api',
    audience:   'dependable-care-client',
  });
  if (decoded.type !== expectedType) {
    throw new jwt.JsonWebTokenError(`Expected ${expectedType} token, got ${decoded.type}`);
  }
  return decoded;
}
```

**ASSESSMENT**: ✓ Proper validation
- Validates signature with public key
- Verifies issuer and audience
- Enforces token type (prevents confusion attacks)
- Automatically rejects expired tokens (jwt.verify default)

---

## 2. CRITICAL: Access Token Stored in localStorage (XSS Vulnerability)

### Issue Location
**File**: `src/contexts/AuthContext.js` lines 12-23

```javascript
useEffect(() => {
  try {
    const stored = localStorage.getItem('dcllc_auth');
    if (stored) setAuth(JSON.parse(stored));
  } catch {
    localStorage.removeItem('dcllc_auth');
  }
  setLoading(false);
}, []);

const login = useCallback((accessToken, user) => {
  const data = { accessToken, user };
  localStorage.setItem('dcllc_auth', JSON.stringify(data));  // ❌ CRITICAL
  setAuth(data);
}, []);
```

**File**: `src/app/login/page.js` lines 34-44

```javascript
localStorage.setItem("dcllc_auth", JSON.stringify({
  accessToken,  // ❌ JWT stored in localStorage
  user: { ... }
}));
```

### Vulnerability Chain

```
Client receives access token in response
        ↓
Frontend stores in localStorage
        ↓
XSS attack: Malicious script injected (outdated dependency, malicious npm package, etc.)
        ↓
Script reads localStorage: localStorage.getItem('dcllc_auth')
        ↓
Attacker exfiltrates JWT to attacker server
        ↓
Attacker makes requests with stolen token
        ↓
Token is valid for 15 minutes
        ↓
Attacker can access any PHI the user has permission to read
```

### Real-World Impact
- **HIPAA Violation**: Unauthorized PHI access by attacker
- **Data Breach**: All resident records accessible to attacker
- **Silent Compromise**: No way to revoke localStorage tokens (revocation only works for refresh tokens in Redis)

### OWASP Top 10 2021
- **A01: Broken Access Control** - Compromised tokens bypass authorization
- **A03: Injection** - XSS injects malicious code
- **A07: Cross-Site Scripting (XSS)** - Direct issue

---

## 3. Refresh Token Storage: HTTP-Only Cookie ✓ CORRECT

### Implementation
**File**: `src/app/api/v1/auth/login/route.js` lines 96-102

```javascript
response.cookies.set('refresh_token', refreshToken, {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge:   REFRESH_TTL,
  path:     '/api/v1/auth/refresh',
});
```

**ASSESSMENT**: ✓ Proper secure storage
- `httpOnly: true` - JavaScript cannot read (XSS-proof)
- `secure: true` (in production) - Only transmitted over HTTPS
- `sameSite: 'strict'` - No cross-site sending (CSRF protection)
- `path: '/api/v1/auth/refresh'` - Only sent to refresh endpoint

**However**: Access token in localStorage **defeats** the security of HTTP-only refresh tokens.

---

## 4. Refresh Token Rotation: Correct but Race Condition Risk

### Implementation
**File**: `src/app/api/v1/auth/refresh/route.js` lines 7-54

```javascript
export async function POST(request) {
  const refreshToken = request.cookies.get('refresh_token')?.value;
  
  let decoded;
  try {
    decoded = verifyToken(refreshToken, 'refresh');
  } catch {
    return Response.json({ error: 'Invalid or expired refresh token' }, { status: 401 });
  }

  const key    = `refresh:${decoded.sub}:${decoded.jti}`;
  const stored = await redis.client.get(key);
  if (!stored) {
    return Response.json({ error: 'Refresh token revoked or expired' }, { status: 401 });
  }

  const data = JSON.parse(stored);
  await redis.client.del(key);  // ❌ RACE CONDITION

  const accessToken = signAccessToken(tokenPayload);
  const { token: newRefreshToken, jti: newJti } = signRefreshToken(tokenPayload);

  await redis.client.set(`refresh:${decoded.sub}:${newJti}`, JSON.stringify(data), { EX: REFRESH_TTL });

  const response = NextResponse.json({ accessToken });
  response.cookies.set('refresh_token', newRefreshToken, { /* ... */ });
  return response;
}
```

### Race Condition: Token Reuse Attack

**Scenario**:
1. Client has refresh token `RT1` (valid in Redis)
2. Client makes TWO refresh requests simultaneously (network race)
3. Both requests decode `RT1` successfully
4. Request A: Gets value from Redis, deletes `RT1`, issues new token `RT2a`
5. Request B: Gets value from Redis ✓ (timing window), deletes `RT1` (already deleted), issues new token `RT2b`
6. Client receives both `RT2a` and `RT2b`
7. Attacker can use old `RT1` to get duplicate tokens

**Impact**: Token reuse attacks possible in high-concurrency scenarios.

**Fix**: Use Redis GETDEL (atomic operation):
```javascript
// Atomic: Get value AND delete in one operation, preventing race condition
const stored = await redis.client.getdel(key);
if (!stored) return error;
```

---

## 5. Token Revocation on Logout: INCOMPLETE

### Implementation
**File**: `src/app/api/v1/auth/logout/route.js` lines 9-30

```javascript
export async function POST(request) {
  try {
    const { user } = await authenticate(request);

    const refreshToken = request.cookies.get('refresh_token')?.value;
    if (refreshToken) {
      try {
        const decoded = verifyToken(refreshToken, 'refresh');
        await redis.client.del(`refresh:${decoded.sub}:${decoded.jti}`);
      } catch { /* expired token — no-op */ }
    }

    if (user?.jti) {
      await redis.client.set(`blacklist:${user.jti}`, '1', { EX: 15 * 60 });
    }

    const response = NextResponse.json({ message: 'Logged out successfully' });
    response.cookies.delete({ name: 'refresh_token', path: '/api/v1/auth/refresh' });
    return response;
  } catch (err) {
    console.error('Logout error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

**ASSESSMENT**: Partial implementation
- ✓ Refresh token deleted from Redis (cannot issue new access tokens)
- ✓ Access token JTI added to blacklist (15-minute expiry window)
- ❌ Access token in localStorage is NOT revoked (JavaScript still has it)

### Gap: localStorage Token Cannot Be Revoked

**Timeline**:
```
T=0:    User logs out → refresh token revoked ✓, access token blacklisted ✓
T=1:    Browser sends request with old access token from localStorage
T=2:    Server checks blacklist: blacklist:${jti} — found, reject request ✓
BUT:    If blacklist lookup is slow or fails (Redis down), token is accepted ❌
        If attacker steals token at T=0, they can use it until T=900 (15 min blacklist TTL) ❌
```

### Missing: Client-Side Token Cleanup

**File**: `src/contexts/AuthContext.js` lines 26-39

```javascript
const logout = useCallback(async () => {
  try {
    const stored = localStorage.getItem('dcllc_auth');
    const token = stored ? JSON.parse(stored)?.accessToken : null;
    if (token) {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  } catch {}
  localStorage.removeItem('dcllc_auth');  // ✓ Cleanup happens
  setAuth(null);
}, []);
```

✓ localStorage is cleared on logout, but token is valid until 15-minute blacklist expires.

---

## 6. JWT Key Management

### Development Mode Issue
**File**: `src/lib/jwt.js` lines 9-22

```javascript
function loadKeys() {
  try {
    privateKey = fs.readFileSync(path.resolve(process.env.JWT_PRIVATE_KEY_PATH), 'utf8');
    publicKey  = fs.readFileSync(path.resolve(process.env.JWT_PUBLIC_KEY_PATH),  'utf8');
  } catch (err) {
    logger.error({ err }, 'Failed to load JWT keys');
    if (process.env.NODE_ENV !== 'production') {
      logger.warn('DEV MODE: Using insecure symmetric JWT fallback. Generate proper RS256 keys for production.');
      privateKey = publicKey = 'dev-secret-key-not-for-production';  // ❌ CRITICAL
    } else {
      process.exit(1);
    }
  }
}
```

**ASSESSMENT**:
- ✓ Production mode exits if keys missing (fail-secure)
- ❌ Development mode uses hardcoded symmetric key (same private/public)
- ❌ Symmetric JWT (HS256) if `privateKey === publicKey`

**Risk**: If code runs with dev fallback in production (misconfigured), JWT security is broken.

---

## 7. CSRF Protection: Correct

**File**: `src/app/api/v1/auth/login/route.js` line 99

```javascript
response.cookies.set('refresh_token', refreshToken, {
  httpOnly: true,
  sameSite: 'strict',  // ← Prevents CSRF
  ...
});
```

**ASSESSMENT**: ✓ `sameSite: 'strict'` prevents cross-site token sending
- Refresh token cannot be sent by malicious website
- Protects from CSRF attacks on `/api/v1/auth/refresh` endpoint

---

## 8. Token Expiry Configuration

### Current Settings (`.env.local`)
```
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=8h
```

**ASSESSMENT**: ✓ Proper defaults
- Access token: 15 minutes (short window for compromise)
- Refresh token: 8 hours (reasonable session length for healthcare worker)

---

## Findings Summary

### CRITICAL (Production Blocker)
1. **Access tokens stored in localStorage** - XSS vulnerability exposes all PHI
2. **No XSS protection in frontend** - No Content Security Policy
3. **localStorage tokens cannot be revoked** - Valid until 15-min blacklist expiry

### HIGH
4. **Refresh token race condition** - Token reuse attack possible
5. **Dev mode symmetric JWT fallback** - If deployed with dev config, JWT broken
6. **No token binding to IP/User-Agent** - Stolen token works from any context

### MEDIUM
7. **Blacklist TTL only 15 minutes** - Matches access token lifetime (acceptable)
8. **No token version field** - Cannot invalidate all tokens on key compromise

### LOW
9. **console.error exposes some context** - Error details may leak in logs

---

## Remediation Priority

**PHASE 1 (URGENT - BLOCKING DEPLOYMENT)**
- [ ] Move access token to HTTP-only cookie (not localStorage)
- [ ] Implement Content Security Policy (CSP) to prevent XSS
- [ ] Add `X-Frame-Options: DENY` and `X-Content-Type-Options: nosniff` headers
- [ ] Replace Redis GETDEL to fix refresh token race condition

**Code Change Required**:
```javascript
// Before: Response headers only
response.cookies.set('access_token', accessToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 15 * 60,  // 15 minutes
});

// Update frontend to read from automatic cookie (no localStorage needed)
```

**PHASE 2 (CRITICAL - First 30 days)**
- [ ] Implement token binding (tie token to IP or User-Agent)
- [ ] Add token version field for emergency revocation
- [ ] Implement request signing to prevent token forgery
- [ ] Add rate limiting on token endpoints

**PHASE 3 (HIGH - Ongoing)**
- [ ] Audit all token usage in codebase
- [ ] Implement token rotation on privilege escalation
- [ ] Add security headers (HSTS, CSP, etc.)
- [ ] Regular security training for developers on XSS prevention

---

## OWASP Compliance

| OWASP Issue | Status | Mitigation |
|------------|--------|-----------|
| A01: Broken Access Control | ❌ Compromised tokens bypass | Move token to HTTP-only cookie |
| A03: Injection (XSS) | ❌ localStorage exploitable | Implement CSP, move to secure cookies |
| A07: XSS | ❌ Direct vulnerability | Same as A03 |
| A08: Software and Data Integrity Failures | ⚠️ Dev key fallback risky | Ensure production config always used |

---

## Testing Recommendations

```bash
# Test 1: Verify HTTP-only cookie (should fail from JavaScript)
curl -H "Cookie: access_token=xyz" http://localhost:3000/api/v1/residents

# Test 2: Verify CSRF protection
# Send POST from different origin with refresh_token in body (should be rejected)

# Test 3: Token blacklist effectiveness
# Logout, then immediately use token
# Should be rejected after 3-5 second delay (Redis lookup)

# Test 4: Refresh token race condition
# Send 100 refresh requests in parallel
# Count unique tokens issued (should be 1, not 100)
```
