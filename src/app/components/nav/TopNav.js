'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { NAV_ITEMS_FLAT } from './nav-config';

const DARK   = "#0b1628";
const ACCENT = "#3b82f6";

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
        borderColor: hov ? "#dce9ff" : "transparent",
        borderRadius: 9,
        background: hov ? "#f0f5ff" : "transparent",
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

// ── TopNav ─────────────────────────────────────────────────────────────────────
export default function TopNav({
  active,
  user = { initials: "AD", name: "Admin", role: "Clinical Director" },
  notificationCount = 3,
}) {
  const router       = useRouter();
  const current      = NAV_ITEMS_FLAT.find(n => n.id === active);
  const currentLabel = current?.label ?? "Dashboard";
  const [userHov, setUserHov] = useState(false);

  return (
    <div style={{ flexShrink: 0 }}>
      {/* Gradient accent line */}
      <div style={{
        height: 2,
        background: "linear-gradient(90deg, #1d4ed8 0%, #3b82f6 35%, #7c3aed 65%, #3b82f6 100%)",
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

        {/* ── Page identity ──────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            background: "linear-gradient(135deg, #eef4ff 0%, #dce9ff 100%)",
            border: "1px solid #c7d8f7",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            flexShrink: 0,
          }}>
            {current?.icon ?? "⊞"}
          </div>
          <div style={{ lineHeight: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: DARK, letterSpacing: "-0.01em" }}>
              {currentLabel}
            </div>
            <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 500, marginTop: 2, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Dependable Care WC
            </div>
          </div>
        </div>

        {/* ── Spacer ─────────────────────────────────────────── */}
        <div style={{ flex: 1 }} />

        {/* ── Right cluster ──────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>

          {/* Search */}
          <IconBtn title="Search">
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
              <circle cx="8.5" cy="8.5" r="5.75" stroke="currentColor" strokeWidth="1.8"/>
              <path d="M13.5 13.5L17.5 17.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </IconBtn>

          {/* Notifications */}
          <IconBtn
            title={`${notificationCount} unread notification${notificationCount !== 1 ? "s" : ""}`}
            badge={notificationCount}
            onClick={() => router.push('/notifications')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 22c1.1 0 2-.9 2-2h-4a2 2 0 002 2zm6-6V11c0-3.07-1.63-5.64-4.5-6.32V4a1.5 1.5 0 00-3 0v.68C7.63 5.36 6 7.93 6 11v5l-2 2v1h16v-1l-2-2z" fill="currentColor"/>
            </svg>
          </IconBtn>

          <Divider />

          {/* System status */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: 20,
            padding: "4px 10px",
            flexShrink: 0,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px rgba(34,197,94,0.7)", flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: "#15803d", fontWeight: 700, letterSpacing: "0.02em" }}>Online</span>
          </div>

          <Divider />

          {/* Live clock */}
          <Clock />

          <Divider />

          {/* User chip */}
          <button
            onMouseEnter={() => setUserHov(true)}
            onMouseLeave={() => setUserHov(false)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: userHov ? "#f4f7fb" : "transparent",
              border: `1px solid ${userHov ? "#dde6f0" : "transparent"}`,
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
              background: "linear-gradient(135deg, #3b82f6 0%, #7c3aed 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 700,
              color: "#fff",
              flexShrink: 0,
              boxShadow: "0 2px 6px rgba(59,130,246,0.35)",
            }}>
              {user.initials}
            </div>
            <div style={{ textAlign: "left", lineHeight: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#1e293b" }}>{user.name}</div>
              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{user.role}</div>
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
