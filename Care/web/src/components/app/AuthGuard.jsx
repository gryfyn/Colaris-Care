"use client";

import { useEffect } from "react";
import { getAccessToken, refreshSession } from "@/lib/client-auth";

/**
 * Client-side defense-in-depth against bfcache auth bypass.
 *
 * The server guard in src/proxy.js sends no-store headers so protected pages are
 * not bfcached, but some browsers still restore from the back/forward cache. This
 * hook re-checks the session whenever the page is shown — on mount, on the
 * `pageshow` event (especially `event.persisted === true`, a bfcache restore) and
 * when the tab becomes visible again. If there is no valid session it replaces the
 * current history entry with the login page so a logged-out user can never linger
 * on a cached protected render.
 */
export function useAuthGuard(portal) {
  useEffect(() => {
    let cancelled = false;

    const bounce = () => {
      if (cancelled || typeof window === "undefined") return;
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.replace(`/login?next=${next}&intent=${portal}`);
    };

    // Cheap, best-effort session validation. The access token lives in
    // localStorage and is cleared on logout, so its absence means logged out.
    // When a token is present we confirm it server-side via /api/auth/me; if the
    // access token has merely expired we try a single silent refresh (backed by
    // the httpOnly refresh cookie) before deciding the session is gone — this
    // keeps still-authenticated users from being bounced.
    const validate = async () => {
      const token = getAccessToken();
      if (!token) {
        bounce();
        return;
      }
      try {
        const res = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (res.ok) return;
        if (res.status === 401 || res.status === 403) {
          const refreshed = await refreshSession();
          if (!refreshed) bounce();
        }
      } catch {
        // Network error: don't bounce a possibly-valid user on a transient failure.
      }
    };

    validate();

    const onPageShow = (event) => {
      // Always re-validate on a bfcache restore; for normal shows the mount
      // validate() already covered it.
      if (event.persisted) validate();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") validate();
    };

    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [portal]);
}

export default function AuthGuard({ portal }) {
  useAuthGuard(portal);
  return null;
}
