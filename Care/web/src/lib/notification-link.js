// Maps a task-linked notification to the page where that pending work lives, so
// clicking a notification takes the user straight to it. `portal` is 'admin'
// or 'staff'. Falls back to the notifications page when there is no source.
export function notificationHref(notification, portal) {
  const base = portal === "admin" ? "/admin" : "/staff";
  switch (notification?.sourceType) {
    case "resident_request": return `${base}/resident-requests`;
    case "appointment": return `${base}/appointments`;
    case "care_plan": return portal === "admin" ? "/admin/care-plans" : "/staff/care-plan";
    case "medication": return `${base}/medications`;
    case "progress_note": return `${base}/progress-notes`;
    case "incident": return `${base}/incidents`;
    case "announcement": return `${base}/announcements`;
    default: return `${base}/notifications`;
  }
}
