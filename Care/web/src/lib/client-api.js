import { getAccessToken, refreshSession } from "@/lib/client-auth";

export async function apiData(path, options = {}) {
  return apiRequest(path, options, true);
}

async function apiRequest(path, options, allowRefresh) {
  const token = getAccessToken();
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (response.status === 401 && allowRefresh) {
    const refreshed = await refreshSession();
    if (refreshed) return apiRequest(path, options, false);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(payload.error || `Request failed with ${response.status}`);
    err.status = response.status;
    throw err;
  }
  return payload.data;
}

export function statusTone(status) {
  const normalized = String(status || "").toLowerCase();
  if (["active", "current", "given", "administered", "completed", "published", "success", "confirmed"].includes(normalized)) return "green";
  if (["pending", "review due", "due soon", "open", "under_review", "due", "scheduled", "recorded"].includes(normalized)) return "amber";
  if (["draft", "discontinued", "discharged", "archived", "cancelled", "closed", "read"].includes(normalized)) return "gray";
  if (["missed", "refused", "critical", "denied", "failure"].includes(normalized)) return "red";
  return "blue";
}

export function displayDate(value, fallback = "Not recorded") {
  if (!value) return fallback;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}
