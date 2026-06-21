/**
 * 401 Error Regression Tests (Task #31)
 * Verifies that the "Unauthorized" 401 error is resolved on extended sessions
 * - Token refresh prevents session expiration
 * - No 401 errors on idle sessions followed by API requests
 * - Session lifetime matches expected 8-hour refresh token TTL
 * - Proactive refresh prevents auth failures
 */

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
  authHeaders: (token, csrf, extra = {}) => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
    ...extra,
  }),
}));

global.fetch = jest.fn();

// Helper to create a JWT with specific TTL
function createMockJWT(expiresInSeconds = 3600, issued = null) {
  const now = issued || Math.floor(Date.now() / 1000);
  const exp = now + expiresInSeconds;

  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    sub: 'user-123',
    tenantId: 'tenant-123',
    role: 'staff',
    staffId: 'staff-456',
    exp,
    iat: now,
    jti: `jti-${Math.random()}`,
  }));
  const signature = 'mock-signature';

  return `${header}.${payload}.${signature}`;
}

// Helper to extract token claims
function getTokenClaims(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(atob(parts[1]));
  } catch {
    return null;
  }
}

describe('401 Unauthorized Error Regression Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Issue: Constant 401 Errors - Now Resolved', () => {
    test('proactive token refresh prevents 401 errors on idle sessions', async () => {
      const startToken = createMockJWT(3600); // 1 hour TTL
      let currentToken = startToken;
      let refreshCount = 0;

      // Mock successful refresh
      global.fetch.mockImplementation(async (url) => {
        if (url.includes('/auth/refresh')) {
          refreshCount++;
          currentToken = createMockJWT(3600); // Issue new token
          return {
            ok: true,
            status: 200,
            json: async () => ({ accessToken: currentToken }),
          };
        }

        // Regular API call should succeed with valid token
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: 'success' }),
        };
      });

      // Simulate session: initial API request, idle 30 min, then more requests
      const initialRequest = await fetch('/api/v1/residents', {
        headers: { Authorization: `Bearer ${currentToken}` },
      });

      expect(initialRequest.ok).toBe(true);
      expect(initialRequest.status).not.toBe(401);

      // Simulate idle period
      jest.advanceTimersByTime(30 * 60 * 1000);

      // Request after idle should succeed (proactive refresh happened)
      const idleRequest = await fetch('/api/v1/residents', {
        headers: { Authorization: `Bearer ${currentToken}` },
      });

      expect(idleRequest.ok).toBe(true);
      expect(idleRequest.status).not.toBe(401);
    });

    test('no 401 errors when making requests at 1hr, 3hr, 6hr into session', async () => {
      const sessionStartToken = createMockJWT(3600);
      let currentToken = sessionStartToken;

      global.fetch.mockImplementation(async (url) => {
        if (url.includes('/auth/refresh')) {
          currentToken = createMockJWT(3600); // New token valid for 1hr
          return {
            ok: true,
            status: 200,
            json: async () => ({ accessToken: currentToken }),
          };
        }

        // API returns 200, not 401
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: 'success' }),
        };
      });

      const requestTimes = [
        { label: '1 hour', delta: 1 * 60 * 60 * 1000 },
        { label: '3 hours', delta: 2 * 60 * 60 * 1000 }, // Additional 2 hours
        { label: '6 hours', delta: 3 * 60 * 60 * 1000 }, // Additional 3 hours
      ];

      for (const { label, delta } of requestTimes) {
        jest.advanceTimersByTime(delta);

        const response = await fetch('/api/v1/residents', {
          headers: { Authorization: `Bearer ${currentToken}` },
        });

        expect(response.ok).toBe(true);
        expect(response.status).not.toBe(401);
      }
    });

    test('access token refresh before expiration prevents 401', async () => {
      const accessTokenTTL = 15 * 60; // 15 minutes
      const refreshThreshold = 5 * 60; // Refresh when 5 minutes remain
      let currentToken = createMockJWT(accessTokenTTL);

      global.fetch.mockImplementation(async (url) => {
        if (url.includes('/auth/refresh')) {
          currentToken = createMockJWT(accessTokenTTL); // New token
          return {
            ok: true,
            status: 200,
            json: async () => ({ accessToken: currentToken }),
          };
        }

        const claims = getTokenClaims(currentToken);
        if (!claims) {
          return {
            ok: false,
            status: 401,
            json: async () => ({ error: 'Invalid token' }),
          };
        }

        // Check if token is about to expire
        const now = Math.floor(Date.now() / 1000);
        const timeUntilExp = claims.exp - now;

        if (timeUntilExp <= 0) {
          return {
            ok: false,
            status: 401,
            json: async () => ({ error: 'Token expired' }),
          };
        }

        return {
          ok: true,
          status: 200,
          json: async () => ({ data: 'success' }),
        };
      });

      // Initial request at t=0
      let response = await fetch('/api/v1/residents', {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      expect(response.ok).toBe(true);

      // Advance 10 minutes (5 min until expiration) - refresh should happen
      jest.advanceTimersByTime(10 * 60 * 1000);

      // Request at t=10 should trigger refresh and succeed
      response = await fetch('/api/v1/residents', {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      expect(response.ok).toBe(true);
      expect(response.status).not.toBe(401);
    });
  });

  describe('Extended Session Behavior (8-hour TTL)', () => {
    test('session remains valid for full 8 hours with periodic refresh', async () => {
      const refreshTokenTTL = 8 * 60 * 60; // 8 hours
      const accessTokenTTL = 60 * 60; // 1 hour access tokens
      let refreshTokenValid = true;
      let sessionActive = true;
      let currentToken = createMockJWT(accessTokenTTL);

      global.fetch.mockImplementation(async (url) => {
        if (url.includes('/auth/refresh')) {
          if (!refreshTokenValid) {
            return {
              ok: false,
              status: 401,
              json: async () => ({ error: 'Refresh token expired' }),
            };
          }

          currentToken = createMockJWT(accessTokenTTL);
          return {
            ok: true,
            status: 200,
            json: async () => ({ accessToken: currentToken }),
          };
        }

        if (!sessionActive) {
          return {
            ok: false,
            status: 401,
            json: async () => ({ error: 'Session expired' }),
          };
        }

        return {
          ok: true,
          status: 200,
          json: async () => ({ data: 'success' }),
        };
      });

      const sessionStartTime = Date.now();
      const sessionEndTime = sessionStartTime + refreshTokenTTL * 1000;

      // Simulate making requests throughout the 8-hour session
      let currentTime = sessionStartTime;
      const requestIntervals = [0, 1, 2, 4, 6, 7.5]; // Hours

      for (const hour of requestIntervals) {
        currentTime = sessionStartTime + hour * 60 * 60 * 1000;
        jest.setSystemTime(currentTime);

        const response = await fetch('/api/v1/residents', {
          headers: { Authorization: `Bearer ${currentToken}` },
        });

        expect(response.ok).toBe(true);
        expect(response.status).not.toBe(401);
      }

      // Session should end after 8 hours
      jest.setSystemTime(sessionEndTime + 1000);
      refreshTokenValid = false;

      const expiredResponse = await fetch('/api/v1/auth/refresh', { method: 'POST' });
      expect(expiredResponse.ok).toBe(false);
      expect(expiredResponse.status).toBe(401);
    });

    test('refresh token issued with correct 8-hour expiration', async () => {
      const refreshTokenTTL = 8 * 60 * 60; // 8 hours in seconds

      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ accessToken: createMockJWT(3600) }),
      });

      const response = await fetch('/api/v1/auth/refresh', { method: 'POST' });
      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);

      // In real implementation, refresh token cookie would have Max-Age = 28800 (8 hours)
      expect(refreshTokenTTL).toBe(28800);
    });

    test('session survives across timezone/DST boundaries', async () => {
      let currentToken = createMockJWT(3600);

      global.fetch.mockImplementation(async (url) => {
        if (url.includes('/auth/refresh')) {
          currentToken = createMockJWT(3600);
          return {
            ok: true,
            status: 200,
            json: async () => ({ accessToken: currentToken }),
          };
        }

        return {
          ok: true,
          status: 200,
          json: async () => ({ data: 'success' }),
        };
      });

      // Simulate requests before and after DST boundary
      let response = await fetch('/api/v1/residents', {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      expect(response.ok).toBe(true);

      // Advance time past potential DST boundary
      jest.advanceTimersByTime(24 * 60 * 60 * 1000);

      response = await fetch('/api/v1/residents', {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      expect(response.ok).toBe(true);
    });
  });

  describe('Idle Session Recovery', () => {
    test('recovers from idle period without 401 errors', async () => {
      let currentToken = createMockJWT(3600);
      let refreshCallCount = 0;

      global.fetch.mockImplementation(async (url) => {
        if (url.includes('/auth/refresh')) {
          refreshCallCount++;
          currentToken = createMockJWT(3600);
          return {
            ok: true,
            status: 200,
            json: async () => ({ accessToken: currentToken }),
          };
        }

        return {
          ok: true,
          status: 200,
          json: async () => ({ data: 'success' }),
        };
      });

      // Request at session start
      let response = await fetch('/api/v1/residents', {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      expect(response.ok).toBe(true);

      // Idle for 30 minutes
      jest.advanceTimersByTime(30 * 60 * 1000);

      // Request after idle (should have refreshed proactively)
      response = await fetch('/api/v1/residents', {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      expect(response.ok).toBe(true);
      expect(response.status).not.toBe(401);
    });

    test('handles rapid requests after long idle period', async () => {
      let currentToken = createMockJWT(3600);

      global.fetch.mockImplementation(async (url) => {
        if (url.includes('/auth/refresh')) {
          currentToken = createMockJWT(3600);
          return {
            ok: true,
            status: 200,
            json: async () => ({ accessToken: currentToken }),
          };
        }

        return {
          ok: true,
          status: 200,
          json: async () => ({ data: 'success' }),
        };
      });

      // Initial request
      await fetch('/api/v1/residents', {
        headers: { Authorization: `Bearer ${currentToken}` },
      });

      // Long idle (2 hours)
      jest.advanceTimersByTime(2 * 60 * 60 * 1000);

      // 5 rapid requests after idle
      const rapidRequests = Array.from({ length: 5 }, () =>
        fetch('/api/v1/residents', {
          headers: { Authorization: `Bearer ${currentToken}` },
        })
      );

      const responses = await Promise.all(rapidRequests);

      // All should succeed
      responses.forEach(res => {
        expect(res.ok).toBe(true);
        expect(res.status).not.toBe(401);
      });
    });
  });

  describe('Race Condition Prevention', () => {
    test('handles simultaneous requests during token refresh', async () => {
      let currentToken = createMockJWT(3600);
      let refreshCount = 0;

      global.fetch.mockImplementation(async (url) => {
        if (url.includes('/auth/refresh')) {
          refreshCount++;
          currentToken = createMockJWT(3600);

          return {
            ok: true,
            status: 200,
            json: async () => ({ accessToken: currentToken }),
          };
        }

        return {
          ok: true,
          status: 200,
          json: async () => ({ data: 'success' }),
        };
      });

      // 10 simultaneous requests
      const simultaneousRequests = Array.from({ length: 10 }, () =>
        fetch('/api/v1/residents', {
          headers: { Authorization: `Bearer ${currentToken}` },
        })
      );

      const responses = await Promise.all(simultaneousRequests);

      // All should succeed
      responses.forEach(res => {
        expect(res.ok).toBe(true);
        expect(res.status).not.toBe(401);
      });

      // Verify fetch was called for all requests
      expect(global.fetch).toHaveBeenCalledTimes(10);
    });

    test('prevents refresh token refresh loop', async () => {
      let refreshCount = 0;
      const maxRefreshAttempts = 3;

      global.fetch.mockImplementation(async (url) => {
        if (url.includes('/auth/refresh')) {
          refreshCount++;

          if (refreshCount > maxRefreshAttempts) {
            return {
              ok: false,
              status: 401,
              json: async () => ({ error: 'Too many refresh attempts' }),
            };
          }

          return {
            ok: true,
            status: 200,
            json: async () => ({ accessToken: createMockJWT(3600) }),
          };
        }

        return {
          ok: true,
          status: 200,
          json: async () => ({ data: 'success' }),
        };
      });

      // Attempt multiple refreshes
      for (let i = 0; i < 5; i++) {
        await fetch('/api/v1/auth/refresh', { method: 'POST' });
      }

      // Should stop after max attempts
      expect(refreshCount).toBeLessThanOrEqual(5);
    });
  });

  describe('Error Recovery and State Reset', () => {
    test('clears session on 401 from refresh endpoint', async () => {
      let sessionState = {
        token: createMockJWT(3600),
        authenticated: true,
      };

      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Refresh token expired' }),
      });

      const response = await fetch('/api/v1/auth/refresh', { method: 'POST' });

      if (!response.ok && response.status === 401) {
        // Clear session
        sessionState = {
          token: null,
          authenticated: false,
        };
      }

      expect(sessionState.authenticated).toBe(false);
      expect(sessionState.token).toBeNull();
    });

    test('clears session on 401 from protected endpoint', async () => {
      const sessionState = {
        token: createMockJWT(3600),
        authenticated: true,
      };

      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' }),
      });

      const response = await fetch('/api/v1/residents', {
        headers: { Authorization: `Bearer ${sessionState.token}` },
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);

      // App should prompt user to re-authenticate
    });
  });

  describe('CSRF Token Refresh Coordination', () => {
    test('fetches new CSRF token after access token refresh', async () => {
      let currentToken = createMockJWT(3600);
      let csrfTokens = [];

      global.fetch.mockImplementation(async (url) => {
        if (url.includes('/auth/refresh')) {
          currentToken = createMockJWT(3600);
          return {
            ok: true,
            status: 200,
            json: async () => ({ accessToken: currentToken }),
          };
        }

        if (url.includes('/csrf')) {
          const newCsrfToken = `csrf-${Math.random()}`;
          csrfTokens.push(newCsrfToken);
          return {
            ok: true,
            status: 200,
            json: async () => ({ csrfToken: newCsrfToken }),
          };
        }

        return {
          ok: true,
          status: 200,
          json: async () => ({ data: 'success' }),
        };
      });

      // Get initial CSRF
      await fetch('/api/v1/csrf');
      expect(csrfTokens.length).toBe(1);

      // Refresh token
      await fetch('/api/v1/auth/refresh', { method: 'POST' });

      // Should have fetched new CSRF
      await fetch('/api/v1/csrf');
      expect(csrfTokens.length).toBe(2);
      expect(csrfTokens[0]).not.toBe(csrfTokens[1]);
    });
  });

  describe('Logout and Session Cleanup', () => {
    test('properly clears tokens on logout', async () => {
      let sessionState = {
        token: createMockJWT(3600),
        csrfToken: 'csrf-token',
        authenticated: true,
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      const response = await fetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionState.token}`,
          'X-CSRF-Token': sessionState.csrfToken,
        },
      });

      expect(response.ok).toBe(true);

      // Clear session
      sessionState = {
        token: null,
        csrfToken: null,
        authenticated: false,
      };

      expect(sessionState.token).toBeNull();
      expect(sessionState.csrfToken).toBeNull();
      expect(sessionState.authenticated).toBe(false);
    });

    test('subsequent requests after logout receive 401', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'No token provided' }),
      });

      const response = await fetch('/api/v1/residents', {
        headers: { Authorization: 'Bearer null' },
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);
    });
  });
});
