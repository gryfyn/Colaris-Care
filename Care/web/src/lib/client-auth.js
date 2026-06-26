import { useAuthStore } from "@/lib/store/auth-store";

/**
 * Thin functional wrappers over the Zustand auth store (the single source of
 * truth). The exported signatures are unchanged so existing callers
 * (client-api.js, the shells, the login flow, AuthGuard) keep working.
 */

export function getStoredUser() {
  return useAuthStore.getState().user;
}

export function getAccessToken() {
  return useAuthStore.getState().accessToken || "";
}

export function storeSession({ accessToken, user } = {}) {
  useAuthStore.getState().setSession({ accessToken, user });
}

export function clearSession() {
  useAuthStore.getState().clearSession();
}

export async function refreshSession() {
  const response = await fetch("/api/auth/refresh", { method: "POST" });
  if (!response.ok) {
    clearSession();
    return null;
  }
  const payload = await response.json();
  storeSession(payload);
  return payload.accessToken || null;
}

export async function logout() {
  const token = getAccessToken();
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {}
  clearSession();
}
