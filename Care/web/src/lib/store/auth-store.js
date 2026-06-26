import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * Client-side auth/session store (single source of truth).
 *
 * Holds only the non-PHI identity needed by the UI: accessToken plus a small
 * user object ({ id, role, displayName, organizationId, facilityId }). It is
 * persisted to localStorage under one key ('colaris.auth.v1') via the persist
 * middleware, and it also mirrors the original single-value keys the app used
 * before this store existed so any code still reading them directly keeps
 * working.
 *
 * SSR-safe: every window/localStorage access is guarded so the store can be
 * created and read during server render without throwing.
 */

const PERSIST_KEY = "colaris.auth.v1";
const LEGACY_TOKEN_KEY = "colaris_access_token";
const LEGACY_USER_KEY = "colaris_user";

const hasWindow = () => typeof window !== "undefined";

// During server render there is no localStorage; persist reads/writes go to a
// no-op store so creation never throws.
const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

// Keep only the non-PHI identity fields. Accepts both the store's own shape
// (displayName) and the API shape (name) and drops everything else (email,
// staffId, …) so PHI/PII never lands in the client store.
function sanitizeUser(user) {
  if (!user || typeof user !== "object") return null;
  return {
    id: user.id ?? null,
    role: user.role ?? null,
    displayName: user.displayName ?? user.name ?? null,
    organizationId: user.organizationId ?? null,
    facilityId: user.facilityId ?? null,
  };
}

// Mirror the canonical session into the original single-value localStorage keys
// so code still reading them directly (e.g. the compliance page) keeps working.
function writeLegacy(accessToken, user) {
  if (!hasWindow()) return;
  try {
    if (accessToken) window.localStorage.setItem(LEGACY_TOKEN_KEY, accessToken);
    else window.localStorage.removeItem(LEGACY_TOKEN_KEY);
    if (user) window.localStorage.setItem(LEGACY_USER_KEY, JSON.stringify(user));
    else window.localStorage.removeItem(LEGACY_USER_KEY);
  } catch {
    /* storage may be unavailable (private mode / quota) — ignore. */
  }
}

// Clear the legacy mock-session artifacts the old clearSession() removed.
function clearMockArtifacts() {
  if (!hasWindow()) return;
  try {
    window.localStorage.removeItem("colaris_mock_session");
    document.cookie = "colaris_mock_role=; path=/; max-age=0; SameSite=Lax";
    document.cookie = "colaris_mock_facility=; path=/; max-age=0; SameSite=Lax";
  } catch {
    /* ignore */
  }
}

export const useAuthStore = create(
  persist(
    (set, get) => ({
      accessToken: "",
      user: null,

      // Partial updates are supported: passing only { accessToken } (as the
      // refresh flow does) leaves the existing user untouched.
      setSession: (session = {}) => {
        const { accessToken, user } = session;
        set((state) => {
          const nextToken =
            accessToken !== undefined ? accessToken || "" : state.accessToken;
          const nextUser =
            user !== undefined ? sanitizeUser(user) : state.user;
          writeLegacy(nextToken, nextUser);
          return { accessToken: nextToken, user: nextUser };
        });
      },

      clearSession: () => {
        set({ accessToken: "", user: null });
        writeLegacy("", null);
        clearMockArtifacts();
      },

      isAuthenticated: () => Boolean(get().accessToken),
    }),
    {
      name: PERSIST_KEY,
      storage: createJSONStorage(() =>
        hasWindow() ? window.localStorage : noopStorage,
      ),
      partialize: (state) => ({
        accessToken: state.accessToken,
        user: state.user,
      }),
    },
  ),
);

// Backward-compat: on first client load, if the new persisted store has no
// session but the original keys do, hydrate from them so users who signed in
// before this store existed are not logged out by the upgrade.
function hydrateFromLegacy() {
  if (!hasWindow()) return;
  if (useAuthStore.getState().accessToken) return;
  let token = "";
  let user = null;
  try {
    token = window.localStorage.getItem(LEGACY_TOKEN_KEY) || "";
    user = JSON.parse(window.localStorage.getItem(LEGACY_USER_KEY) || "null");
  } catch {
    return;
  }
  if (token || user) {
    const clean = sanitizeUser(user);
    useAuthStore.setState({ accessToken: token, user: clean });
    writeLegacy(token, clean);
  }
}

if (hasWindow()) hydrateFromLegacy();
