# Token Security Model — Dependable Care Wellness Centre

## Overview

This document describes how authentication tokens and CSRF protection are implemented to prevent XSS-based token theft and cross-site request forgery attacks.

---

## 1. JWT Access Token

| Property | Value |
|----------|-------|
| Storage  | React Context state (in-memory only) |
| Lifetime | 2 hours (configurable via `JWT_ACCESS_EXPIRES_IN`) |
| Algorithm | RS256 (production) / HS256 (dev fallback) |
| Transport | `Authorization: Bearer <token>` header on every API request |

**Why in-memory?**  
Any value stored in `localStorage` or `sessionStorage` is readable by every script running on the page. A single XSS vulnerability — even in a dependency — is sufficient to steal the token and impersonate the user indefinitely. React state lives in the JavaScript heap and is inaccessible outside the component tree.

**Caveat:** The access token is lost on page reload. Silent token refresh (see §3) transparently re-issues it without user interaction.

---

## 2. Refresh Token

| Property | Value |
|----------|-------|
| Storage  | `httpOnly` cookie (`refresh_token`) |
| Lifetime | 8 hours (configurable via `JWT_REFRESH_EXPIRES_IN`) |
| Scope    | Path `/api/v1/auth/refresh` only |
| Flags    | `httpOnly`, `secure` (production), `sameSite=strict` |

**Why httpOnly?**  
An `httpOnly` cookie is completely inaccessible to JavaScript. Even if an XSS attack executes arbitrary code, it cannot read the refresh token. The `sameSite=strict` flag prevents the cookie from being sent on cross-origin requests, mitigating CSRF on the refresh endpoint itself.

---

## 3. Silent Refresh (page reload recovery)

On every page mount, `AuthProvider` calls `POST /api/v1/auth/refresh`. The browser automatically attaches the `httpOnly` refresh-token cookie. If the cookie is valid, a new access token is returned and stored in React state. The user is transparently re-authenticated.

If the refresh token has expired, the user is redirected to the login page.

---

## 4. CSRF Token

| Property | Value |
|----------|-------|
| Storage  | Non-httpOnly cookie (`csrf_token`) + React state |
| Pattern  | Double-Submit Cookie |
| Transport | `X-CSRF-Token` request header |
| Enforced on | All POST / PUT / PATCH / DELETE requests to `/api/*` |
| Exempt | `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `GET /api/v1/csrf` |

### How to use (client code)

```js
import { useAuth, authHeaders } from '@/contexts/AuthContext';

function MyComponent() {
  const { auth, csrfToken } = useAuth();

  const submit = async () => {
    await fetch('/api/v1/some-endpoint', {
      method: 'POST',
      headers: authHeaders(auth.accessToken, csrfToken),
      credentials: 'same-origin',
      body: JSON.stringify(payload),
    });
  };
}
```

### How it works

1. Client calls `GET /api/v1/csrf` to receive a token and set the `csrf_token` cookie.
2. The token value is stored in React state via `AuthProvider`.
3. On every state-changing request, the client echoes the token value in the `X-CSRF-Token` header.
4. Next.js Edge Middleware compares `cookie === header` before routing to any handler.
5. A cross-origin attacker cannot read the cookie value (same-origin policy) and therefore cannot supply the matching header.

---

## 5. XSS Prevention

### Content Security Policy

`script-src 'self'` — no inline scripts, no `unsafe-inline`, no external script origins.  
`object-src 'none'` — no Flash or plugin injection.  
`base-uri 'self'` — prevents `<base>` tag hijacking.  
`form-action 'self'` — prevents form submissions to external origins.

Applied in all environments via `next.config.mjs`.

### User-Generated Content Sanitization

All free-text fields submitted by users (clinical notes, incident narratives, announcements) pass through `sanitizeText()` / `sanitizeNoteBody()` / `sanitizeFields()` from `src/lib/sanitize.js` before database insertion.

React's JSX text interpolation (`{variable}`) HTML-escapes output automatically. `dangerouslySetInnerHTML` is not used anywhere in this application.

---

## 6. SubResource Integrity (SRI)

All external dependencies are bundled by Next.js and served from the same origin — no CDN scripts are loaded at runtime. Therefore no SRI attributes are required. If a CDN font or analytics script is added in the future, `integrity` and `crossorigin="anonymous"` attributes must be included.

---

## 7. Session Termination

On logout:
1. Client calls `POST /api/v1/auth/logout` with the Bearer access token and CSRF header.
2. Server blacklists the access token `jti` in Redis (TTL = access token lifetime).
3. Server deletes the refresh token from Redis.
4. Server clears the `refresh_token` cookie.
5. Client clears React auth state and CSRF token.

The user's session is fully terminated server-side even if they close the browser without clicking logout (refresh token expiry handles that).
