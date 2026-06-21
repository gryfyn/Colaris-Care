'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const DARK   = "#2A1F3A";
const ACCENT = "#8B6FA3";

const PAGE_LABELS = {
  home:          { label: "Home",          icon: "⌂" },
  health:        { label: "My Health",     icon: "♥" },
  appointments:  { label: "Appointments",  icon: "◷" },
  activities:    { label: "Activities",    icon: "★" },
  team:          { label: "My Care Team",  icon: "◉" },
  announcements: { label: "Announcements", icon: "⚐" },
  requests:      { label: "Requests",      icon: "◈" },
};

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const time = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  const date = now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  return (
    <div style={{ textAlign: "right", lineHeight: 1 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", letterSpacing: "-0.01em" }}>{time}</div>
      <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 500, marginTop: 3 }}>{date}</div>
    </div>
  );
}

function IconBtn({ children, title, badge, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={title}
      style={{
        position: "relative",
        width: 38,
        height: 38,
        border: "1px solid",
        borderColor: hov ? "#C4A8D8" : "transparent",
        borderRadius: 9,
        background: hov ? "#f5f0fa" : "transparent",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.14s ease",
        color: hov ? ACCENT : "#64748b",
        flexShrink: 0,
      }}
    >
      {children}
      {badge != null && badge > 0 && (
        <span style={{
          position: "absolute",
          top: 7,
          right: 7,
          width: 7,
          height: 7,
          background: "#ef4444",
          borderRadius: "50%",
          border: "2px solid #fff",
          boxShadow: "0 0 0 1px rgba(239,68,68,0.3)",
        }} />
      )}
    </button>
  );
}

function Divider() {
  return <div style={{ width: 1, height: 22, background: "#e2e8f0", flexShrink: 0 }} />;
}

export default function ResidentTopNav({ activeSection, resident, notificationCount = 1, onMenuClick }) {
  const router   = useRouter();
  const page     = PAGE_LABELS[activeSection] ?? PAGE_LABELS.home;
  const [userHov, setUserHov] = useState(false);

  const initials = resident?.name?.split(" ").map(w => w[0]).join("") ?? "?";

  return (
    <div style={{ flexShrink: 0 }}>
      {/* Lavender gradient accent line */}
      <div style={{
        height: 2,
        background: "linear-gradient(90deg, #7c3aed 0%, #8B6FA3 40%, #a78eба 70%, #8B6FA3 100%)",
      }} />

      {/* Main bar */}
      <div style={{
        background: "#fff",
        borderBottom: "1px solid #e8eef5",
        padding: "0 20px",
        height: 58,
        display: "flex",
        alignItems: "center",
        gap: 12,
        boxShadow: "0 2px 12px rgba(11,22,40,0.06)",
        position: "relative",
        zIndex: 10,
      }}>

        {/* ── Hamburger (mobile only) ────────────────────────── */}
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open menu"
          className="app-show-mobile"
          style={{
            width: 38, height: 38, borderRadius: 9, flexShrink: 0,
            border: "1px solid #e8eef5", background: "#fff", color: DARK,
            alignItems: "center", justifyContent: "center", cursor: "pointer",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>

        {/* ── Page identity ──────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            background: "linear-gradient(135deg, #f5f0fa 0%, #E8DFF5 100%)",
            border: "1px solid #C4A8D8",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 15,
            flexShrink: 0,
          }}>
            {page.icon}
          </div>
          <div style={{ lineHeight: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: DARK, letterSpacing: "-0.01em" }}>
              {page.label}
            </div>
            <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 500, marginTop: 2, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Resident Portal
            </div>
          </div>
        </div>

        {/* ── Spacer ─────────────────────────────────────────── */}
        <div style={{ flex: 1 }} />

        {/* ── Right cluster ──────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>

          {/* Search (hidden on phones to keep the bar uncluttered) */}
          <span className="app-hide-mobile" style={{ display: "inline-flex" }}>
            <IconBtn title="Search">
              <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
                <circle cx="8.5" cy="8.5" r="5.75" stroke="currentColor" strokeWidth="1.8"/>
                <path d="M13.5 13.5L17.5 17.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </IconBtn>
          </span>

          {/* Notifications */}
          <IconBtn
            title={`${notificationCount} new notification${notificationCount !== 1 ? "s" : ""}`}
            badge={notificationCount}
            onClick={() => router.push('/notifications?type=resident')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 22c1.1 0 2-.9 2-2h-4a2 2 0 002 2zm6-6V11c0-3.07-1.63-5.64-4.5-6.32V4a1.5 1.5 0 00-3 0v.68C7.63 5.36 6 7.93 6 11v5l-2 2v1h16v-1l-2-2z" fill="currentColor"/>
            </svg>
          </IconBtn>

          {/* Live clock + dividers (hidden on phones) */}
          <span className="app-hide-mobile" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Divider />
            <Clock />
            <Divider />
          </span>

          {/* User chip */}
          <button
            onMouseEnter={() => setUserHov(true)}
            onMouseLeave={() => setUserHov(false)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: userHov ? "#f5f0fa" : "transparent",
              border: `1px solid ${userHov ? "#C4A8D8" : "transparent"}`,
              borderRadius: 9,
              padding: "5px 10px 5px 5px",
              cursor: "pointer",
              transition: "all 0.14s ease",
              flexShrink: 0,
            }}
          >
            <div style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #8B6FA3 0%, #A78EBA 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 700,
              color: "#fff",
              flexShrink: 0,
              boxShadow: "0 2px 6px rgba(139,111,163,0.35)",
            }}>
              {initials}
            </div>
            <div style={{ textAlign: "left", lineHeight: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#1e293b" }}>{resident?.name ?? "Resident"}</div>
              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>Room {resident?.room ?? "—"}</div>
            </div>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ color: "#94a3b8", flexShrink: 0 }}>
              <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
