export function getStoredUser() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.localStorage.getItem("colaris_user") || "null");
  } catch {
    return null;
  }
}

export function getAccessToken() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("colaris_access_token") || "";
}

export function storeSession({ accessToken, user }) {
  if (typeof window === "undefined") return;
  if (accessToken) window.localStorage.setItem("colaris_access_token", accessToken);
  if (user) window.localStorage.setItem("colaris_user", JSON.stringify(user));
}

export function clearSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("colaris_access_token");
  window.localStorage.removeItem("colaris_user");
  window.localStorage.removeItem("colaris_mock_session");
  document.cookie = "colaris_mock_role=; path=/; max-age=0; SameSite=Lax";
  document.cookie = "colaris_mock_facility=; path=/; max-age=0; SameSite=Lax";
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
