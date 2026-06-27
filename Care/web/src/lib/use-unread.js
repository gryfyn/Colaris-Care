"use client";

import { useEffect, useState } from "react";
import { apiData } from "@/lib/client-api";

// Polls the notifications feed and returns the count of unread items, so shells
// can badge the sidebar and dot the bell. Light + cancellable.
export function useUnreadCount(pollMs = 60000) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = () =>
      apiData("/api/v1/notifications")
        .then((d) => { if (alive && Array.isArray(d)) setCount(d.filter((n) => n.status === "unread").length); })
        .catch(() => {});
    load();
    const t = setInterval(load, pollMs);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { alive = false; clearInterval(t); window.removeEventListener("focus", onFocus); };
  }, [pollMs]);
  return count;
}
