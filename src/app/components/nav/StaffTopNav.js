'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// ─── COLOR PALETTE (matching admin page exactly) ──────────────────
const C = {
  navy: "#0f2d5e",
  navyMid: "#1a3a5c",
  blue: "#1a56db",
  bluePale: "#eef4ff",
  blueBorder: "#bfdbfe",
  white: "#ffffff",
  bg: "#f4f8ff",
  text: "#1e2d40",
  muted: "#6b7c93",
  border: "#dde6f0",
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
    <div style={{ textAlign: "right", lineHeight: 1.2 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, letterSpacing: "-0.01em" }}>
        {time}
      </div>
      <div style={{ fontSize: 10, color: C.muted, fontWeight: 500, marginTop: 2 }}>
        {date}
      </div>
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
        border: `1px solid ${hov ? C.blueBorder : "transparent"}`,
        borderRadius: 8,
        background: hov ? C.bluePale : "transparent",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.14s ease",
        color: hov ? C.blue : C.muted,
        flexShrink: 0,
      }}
    >
      {children}
      {badge != null && badge > 0 && (
        <span style={{
          position: "absolute",
          top: 6,
          right: 6,
          width: 7,
          height: 7,
          background: "#dc2626",
          borderRadius: "50%",
          border: `2px solid ${C.white}`,
          boxShadow: "0 0 0 1px rgba(220, 38, 38, 0.3)",
        }} />
      )}
    </button>
  );
}

function Divider() {
  return <div style={{ width: 1, height: 22, background: C.border, flexShrink: 0 }} />;
}

// ── StaffTopNav ────────────────────────────────────────────────────
export default function StaffTopNav({
  activeSection,
  visibleNav,
  clockedIn,
  staff,
  notificationCount = 2,
}) {
  const router = useRouter();
  const current = visibleNav.find(s => s.id === activeSection);
  const currentLabel = current?.label ?? "Staff Portal";
  const [userHov, setUserHov] = useState(false);

  const initials = staff?.name?.split(" ").map(w => w[0]).join("") ?? "ST";

  return (
    <div style={{ flexShrink: 0 }}>
      {/* Gradient accent line */}
      <div style={{
        height: 3,
        background: `linear-gradient(90deg, ${C.navy} 0%, ${C.blue} 35%, ${C.blue} 65%, ${C.navyMid} 100%)`,
      }} />

      {/* Main bar */}
      <div style={{
        background: C.white,
        borderBottom: `1px solid ${C.border}`,
        padding: "0 20px",
        height: 60,
        display: "flex",
        alignItems: "center",
        gap: 12,
        boxShadow: "0 2px 8px rgba(15, 45, 94, 0.08)",
        position: "relative",
        zIndex: 10,
      }}>

        {/* ── Page identity ──────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            background: C.bluePale,
            border: `1px solid ${C.blueBorder}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            flexShrink: 0,
            color: C.blue,
          }}>
            {current?.icon ?? "◉"}
          </div>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{
              fontSize: 14,
              fontWeight: 700,
              color: C.navy,
              letterSpacing: "-0.01em",
            }}>
              {currentLabel}
            </div>
            <div style={{
              fontSize: 10,
              color: C.muted,
              fontWeight: 500,
              marginTop: 3,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}>
              Staff Portal
            </div>
          </div>
        </div>

        {/* ── Spacer ─────────────────────────────────────────── */}
        <div style={{ flex: 1 }} />

        {/* ── Right cluster ──────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>

          {/* Search */}
          <IconBtn title="Search">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
              <circle cx="8.5" cy="8.5" r="5.75" stroke="currentColor" strokeWidth="1.8"/>
              <path d="M13.5 13.5L17.5 17.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </IconBtn>

          {/* Notifications */}
          <IconBtn
            title={`${notificationCount} notification${notificationCount !== 1 ? "s" : ""}`}
            badge={notificationCount}
            onClick={() => router.push('/notifications')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </IconBtn>

          <Divider />

          {/* Clock status pill */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: clockedIn ? "#f0fdf4" : "#f8fafc",
            border: `1px solid ${clockedIn ? "#bbf7d0" : C.border}`,
            borderRadius: 20,
            padding: "5px 12px",
            flexShrink: 0,
          }}>
            <div style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: clockedIn ? "#22c55e" : "#cbd5e1",
              boxShadow: clockedIn ? "0 0 6px rgba(34, 197, 94, 0.7)" : "none",
              flexShrink: 0,
            }} />
            <span style={{
              fontSize: 11,
              color: clockedIn ? "#15803d" : C.muted,
              fontWeight: 700,
              letterSpacing: "0.02em",
            }}>
              {clockedIn ? "Clocked In" : "Clocked Out"}
            </span>
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
              gap: 10,
              background: userHov ? C.bluePale : "transparent",
              border: `1px solid ${userHov ? C.blueBorder : "transparent"}`,
              borderRadius: 8,
              padding: "5px 10px 5px 6px",
              cursor: "pointer",
              transition: "all 0.14s ease",
              flexShrink: 0,
            }}
          >
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              background: C.bluePale,
              border: `1px solid ${C.blueBorder}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 700,
              color: C.blue,
              flexShrink: 0,
            }}>
              {initials}
            </div>
            <div style={{ textAlign: "left", lineHeight: 1.2 }}>
              <div style={{
                fontSize: 12,
                fontWeight: 600,
                color: C.navy,
              }}>
                {staff?.name ?? "Staff"}
              </div>
              <div style={{
                fontSize: 10,
                color: C.muted,
                marginTop: 2,
              }}>
                {staff?.role ?? "Staff"}
              </div>
            </div>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{
              color: C.muted,
              flexShrink: 0,
              transition: "transform 0.14s ease",
              transform: userHov ? "rotate(180deg)" : "rotate(0deg)",
            }}>
              <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
