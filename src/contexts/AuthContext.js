'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

// Security model:
// - Access token: held in React state (in-memory) only.  Never written to
//   localStorage or sessionStorage, which are accessible to any script running
//   on the page.
// - Refresh token: httpOnly cookie managed entirely by the server.
// - CSRF token: fetched from /api/v1/csrf and held in React state.  Sent as
//   the X-CSRF-Token header on every state-changing request.
//
// On a cold page-load, silentRefresh() is called: it posts to the refresh
// endpoint (which reads the httpOnly cookie), receives a new access token,
// and also fetches a fresh CSRF token.  The user is transparently
// re-authenticated without any browser storage being touched.

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(null);   // { accessToken, user }
  const [csrfToken, setCsrfToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch a fresh CSRF token and store it in state.
  const refreshCsrf = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/csrf', { credentials: 'same-origin' });
      if (res.ok) {
        const { csrfToken: t } = await res.json();
        setCsrfToken(t);
      }
    } catch { /* non-fatal */ }
  }, []);

  // On mount, attempt a silent token refresh using the httpOnly refresh cookie.
  useEffect(() => {
    let cancelled = false;
    async function silentRefresh() {
      try {
        const res = await fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'same-origin' });
        if (!res.ok) {
          if (!cancelled) setLoading(false);
          return;
        }
        const { accessToken } = await res.json();
        const meRes = await fetch('/api/v1/auth/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
          credentials: 'same-origin',
        });
        if (meRes.ok) {
          const { user } = await meRes.json();
          if (!cancelled) {
            setAuth({ accessToken, user });
            // Fetch CSRF token after successful authentication (non-blocking)
            refreshCsrf();
          }
        }
      } catch {
        // Network error — leave unauthenticated.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    silentRefresh();
    return () => { cancelled = true; };
  }, [refreshCsrf]);

  const login = useCallback(async (accessToken, user) => {
    setAuth({ accessToken, user });
    refreshCsrf();
  }, [refreshCsrf]);

  // Periodically refresh the access token to keep the session alive
  useEffect(() => {
    if (!auth?.accessToken) return;

    // Decode JWT to get expiration time
    let tokenExpiresAt = null;
    try {
      const parts = auth.accessToken.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        if (payload.exp) {
          tokenExpiresAt = payload.exp * 1000; // Convert to milliseconds
        }
      }
    } catch (err) {
      console.warn('Could not decode token expiration:', err);
    }

    // Calculate refresh interval: refresh when 5 minutes remain before expiration
    let nextRefreshDelay = 10 * 60 * 1000; // Default to 10 minutes
    if (tokenExpiresAt) {
      const now = Date.now();
      const timeUntilExpiration = tokenExpiresAt - now;
      const refreshThreshold = 5 * 60 * 1000; // Refresh 5 minutes before expiration
      nextRefreshDelay = Math.max(1000, timeUntilExpiration - refreshThreshold);
    }

    const refreshInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'same-origin' });
        if (res.ok) {
          const { accessToken } = await res.json();
          const meRes = await fetch('/api/v1/auth/me', {
            headers: { Authorization: `Bearer ${accessToken}` },
            credentials: 'same-origin',
          });
          if (meRes.ok) {
            const { user } = await meRes.json();
            setAuth({ accessToken, user });
            refreshCsrf();
          } else {
            setAuth(null);
            setCsrfToken(null);
          }
        } else {
          setAuth(null);
          setCsrfToken(null);
        }
      } catch {
        // Network error — keep trying
      }
    }, nextRefreshDelay);

    return () => clearInterval(refreshInterval);
  }, [auth, refreshCsrf]);

  const logout = useCallback(async () => {
    try {
      if (auth?.accessToken) {
        await fetch('/api/v1/auth/logout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${auth.accessToken}`,
            ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
          },
          credentials: 'same-origin',
        });
      }
    } catch { /* best-effort */ }
    setAuth(null);
    setCsrfToken(null);
  }, [auth, csrfToken]);

  return (
    <AuthContext.Provider value={{ auth, csrfToken, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/**
 * Build fetch headers for an authenticated, CSRF-protected request.
 * Use this helper for every state-changing fetch (POST, PATCH, PUT, DELETE).
 *
 * @param {string} accessToken
 * @param {string|null} csrfToken
 * @param {object} [extra={}]  — any additional headers
 */
export function authHeaders(accessToken, csrfToken, extra = {}) {
  return {
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(csrfToken  ? { 'X-CSRF-Token': csrfToken }              : {}),
    ...extra,
  };
}
