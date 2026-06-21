'use client';

import { useState } from 'react';
import Image from 'next/image';

const BG_TOP     = "#2A1F3A";
const BG_BTM     = "#3D2E4D";
const ACCENT     = "#8B6FA3";
const ACCENT_DIM = "rgba(139,111,163,0.13)";

const NAV_ITEMS = [
  { id: "home",          label: "Home",          icon: "⌂" },
  { id: "health",        label: "My Health",     icon: "♥" },
  { id: "appointments",  label: "Appointments",  icon: "◷" },
  { id: "activities",    label: "Activities",    icon: "★" },
  { id: "team",          label: "My Care Team",  icon: "◉" },
  { id: "announcements", label: "Announcements", icon: "⚐" },
  { id: "requests",      label: "Requests",      icon: "◈" },
];

function NavItem({ item, active, onClick, hovered, onHover }) {
  const isActive  = active === item.id;
  const isHovered = hovered === item.id;

  return (
    <button
      onClick={() => onClick(item.id)}
      onMouseEnter={() => onHover(item.id)}
      onMouseLeave={() => onHover(null)}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 10px",
        background: isActive ? ACCENT_DIM : isHovered ? "rgba(255,255,255,0.05)" : "transparent",
        border: "none",
        borderLeft: isActive ? `3px solid ${ACCENT}` : "3px solid transparent",
        borderRadius: isActive ? "0 7px 7px 0" : 7,
        cursor: "pointer",
        marginBottom: 2,
        color: isActive ? "#C4A8D8" : isHovered ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.45)",
        fontSize: 12,
        fontWeight: isActive ? 600 : 400,
        letterSpacing: "0.01em",
        transition: "background 0.14s ease, color 0.14s ease, border-color 0.14s ease",
        textAlign: "left",
      }}
    >
      <span style={{
        fontSize: 14,
        width: 20,
        textAlign: "center",
        flexShrink: 0,
        opacity: isActive ? 1 : isHovered ? 0.75 : 0.5,
        filter: isActive ? `drop-shadow(0 0 4px rgba(139,111,163,0.5))` : "none",
        transition: "opacity 0.14s ease",
      }}>
        {item.icon}
      </span>
      <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {item.label}
      </span>
      {isActive && (
        <span style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: ACCENT,
          boxShadow: `0 0 6px ${ACCENT}`,
          flexShrink: 0,
        }} />
      )}
    </button>
  );
}

export default function ResidentSideNav({
  activeSection,
  resident,
  onNavigate,
  activeResidentId,
  residents,
  onResidentChange,
}) {
  const [hovered, setHovered] = useState(null);

  const hour  = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = resident?.name?.split(" ")[0] ?? "there";

  return (
    <div style={{
      width: 232,
      background: `linear-gradient(180deg, ${BG_TOP} 0%, ${BG_BTM} 100%)`,
      display: "flex",
      flexDirection: "column",
      flexShrink: 0,
      overflow: "hidden",
      borderRight: "1px solid rgba(255,255,255,0.055)",
      boxShadow: "4px 0 28px rgba(0,0,0,0.22)",
      position: "relative",
      zIndex: 20,
    }}>

      {/* Ambient glow blob */}
      <div style={{
        position: "absolute",
        top: -60,
        left: -60,
        width: 220,
        height: 220,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(139,111,163,0.08) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* ── Brand ─────────────────────────────────────────────── */}
      <div style={{
        padding: "18px 16px 14px",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        display: "flex",
        alignItems: "center",
        gap: 11,
        minHeight: 70,
        flexShrink: 0,
      }}>
        <Image
          src="/logo.png"
          alt="Dependable Care Wellness Centre"
          width={36}
          height={36}
          style={{ borderRadius: 10, flexShrink: 0 }}
        />
        <div style={{ overflow: "hidden", lineHeight: 1 }}>
          <div style={{ color: "#fff", fontSize: 13.5, fontWeight: 700, whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>
            Dependable Care
          </div>
          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 9.5, fontWeight: 600, whiteSpace: "nowrap", letterSpacing: "0.1em", marginTop: 3, textTransform: "uppercase" }}>
            Resident Portal
          </div>
        </div>
      </div>

      {/* ── Welcome card ──────────────────────────────────────── */}
      <div style={{
        padding: "14px 14px 12px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginBottom: 8, fontWeight: 500 }}>
          {greeting},
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
          <div style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${ACCENT} 0%, #A78EBA 100%)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 700,
            color: "#fff",
            flexShrink: 0,
            boxShadow: "0 2px 8px rgba(139,111,163,0.35)",
          }}>
            {resident?.name?.split(" ").map(w => w[0]).join("") ?? "?"}
          </div>
          <div style={{ overflow: "hidden" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {firstName}
            </div>
            <div style={{ fontSize: 10, color: "#C4A8D8", fontWeight: 500 }}>
              Room {resident?.room ?? "—"}
            </div>
          </div>
        </div>

      </div>

      {/* ── Navigation ─────────────────────────────────────────── */}
      <nav style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "10px 8px", scrollbarWidth: "none" }}>
        {NAV_ITEMS.map(item => (
          <NavItem
            key={item.id}
            item={item}
            active={activeSection}
            onClick={onNavigate}
            hovered={hovered}
            onHover={setHovered}
          />
        ))}
      </nav>

      {/* ── Wellness check-in strip ────────────────────────────── */}
      <div style={{
        borderTop: "1px solid rgba(255,255,255,0.07)",
        padding: "12px 14px",
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
          How are you feeling today?
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          {["😔","😐","🙂","😊","😄"].map((e, i) => (
            <button key={i} style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 6,
              padding: "4px 0",
              width: "18%",
              cursor: "pointer",
              fontSize: 14,
              transition: "background 0.13s ease",
            }}
              onMouseEnter={ev => ev.currentTarget.style.background = "rgba(139,111,163,0.15)"}
              onMouseLeave={ev => ev.currentTarget.style.background = "transparent"}
            >
              {e}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
