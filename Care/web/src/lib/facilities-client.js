import { apiData } from "@/lib/client-api";
import { getAccessToken, storeSession } from "@/lib/client-auth";

// The homes the signed-in user belongs to + which one is active.
// -> { facilities:[{id,name,role,current}], currentFacilityId, max, canAdd }
export function fetchFacilities() {
  return apiData("/api/v1/facilities");
}

// Admin only. Adds a home under the user's org (server enforces the max).
// -> { id, name }
export function createFacility(name) {
  return apiData("/api/v1/facilities", { method: "POST", body: JSON.stringify({ name }) });
}

// Switch the active home. Re-mints the session server-side; on success updates
// the client store so subsequent requests use the new facility. The caller is
// responsible for navigating/reloading so all data refetches under the new home.
export async function switchFacility(facilityId) {
  const token = getAccessToken();
  const res = await fetch("/api/auth/switch-facility", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ facilityId }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error || "Could not switch facility.");
  storeSession({ accessToken: payload.accessToken, user: payload.user });
  return payload.user;
}
