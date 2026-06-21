'use client';

import { useState } from 'react';
import Image from 'next/image';

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
  green: "#0a7c4e",
};

function NavItem({ item, active, onClick, hovered, onHover }) {
  const isActive = active === item.id;
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
        padding: "10px 12px",
        background: isActive ? C.bluePale : isHovered ? "rgba(26, 86, 219, 0.08)" : "transparent",
        border: "none",
        borderLeft: isActive ? `3px solid ${C.blue}` : "3px solid transparent",
        borderRadius: isActive ? "0 8px 8px 0" : 8,
        cursor: "pointer",
        marginBottom: 3,
        color: isActive ? C.blue : isHovered ? C.text : C.muted,
        fontSize: 13,
        fontWeight: isActive ? 600 : 500,
        letterSpacing: "0.01em",
        transition: "all 0.14s ease",
        textAlign: "left",
      }}
    >
      <span style={{ fontSize: 14 }}>{item.icon}</span>
      <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {item.label}
      </span>
      {isActive && (
        <span style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: C.blue,
          flexShrink: 0,
        }} />
      )}
    </button>
  );
}

// ─── LOADING SPINNER ──────────────────────────────────────────────
function LoadingSpinner() {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      padding: "12px 14px",
    }}>
      <div style={{
        width: 20,
        height: 20,
        borderRadius: "50%",
        border: `2px solid ${C.blueBorder}`,
        borderTopColor: C.blue,
        animation: "spin 0.8s linear infinite",
      }} />
      <span style={{ fontSize: 12, color: C.muted }}>Loading...</span>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default function StaffSideNav({
  activeSection,
  visibleNav,
  staff,
  role,
  clockedIn,
  onNavigate,
  onToggleClock,
  activeStaffId,
  staffRoster,
  onStaffChange,
}) {
  const [hovered, setHovered] = useState(null);
  const [clockBtnHov, setClockBtnHov] = useState(false);
  const [staffSelectHov, setStaffSelectHov] = useState(false);

  const isLoading = !staff || !staff.name;

  return (
    <div style={{
      width: 260,
      background: `linear-gradient(180deg, ${C.navy} 0%, ${C.navyMid} 100%)`,
      display: "flex",
      flexDirection: "column",
      flexShrink: 0,
      overflow: "hidden",
      borderRight: `1px solid ${C.blueBorder}`,
      boxShadow: "2px 0 12px rgba(15, 45, 94, 0.15)",
      position: "relative",
      zIndex: 20,
    }}>

      {/* ── Brand Header ──────────────────────────────────────── */}
      <div style={{
        padding: "18px 16px 16px",
        borderBottom: `1px solid rgba(255, 255, 255, 0.08)`,
        display: "flex",
        alignItems: "center",
        gap: 12,
        minHeight: 75,
        flexShrink: 0,
      }}>
        <Image
          src="/logo.png"
          alt="Dependable Care Wellness Centre"
          width={36}
          height={36}
          style={{ borderRadius: 8, flexShrink: 0 }}
        />
        <div style={{ overflow: "hidden", lineHeight: 1.2 }}>
          <div style={{
            color: C.white,
            fontSize: 14,
            fontWeight: 700,
            whiteSpace: "nowrap",
            letterSpacing: "-0.01em",
          }}>
            Dependable Care
          </div>
          <div style={{
            color: "rgba(255, 255, 255, 0.5)",
            fontSize: 10,
            fontWeight: 600,
            whiteSpace: "nowrap",
            letterSpacing: "0.08em",
            marginTop: 4,
            textTransform: "uppercase",
          }}>
            Staff Portal
          </div>
        </div>
      </div>

      {/* ── Staff Card ────────────────────────────────────────── */}
      <div style={{
        padding: "12px 14px",
        borderBottom: `1px solid rgba(255, 255, 255, 0.08)`,
        flexShrink: 0,
        minHeight: 100,
        display: "flex",
        flexDirection: "column",
      }}>
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 8,
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
                {staff?.name ? staff.name.split(" ").map(w => w[0]).join("") : "—"}
              </div>
              <div style={{ overflow: "hidden", flex: 1 }}>
                <div style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: C.white,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}>
                  {staff?.name || "—"}
                </div>
                <div style={{
                  fontSize: 10,
                  color: "rgba(255, 255, 255, 0.5)",
                  marginTop: 2,
                }}>
                  {role || "Staff"}
                </div>
              </div>
              <div style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: clockedIn ? C.green : "#cbd5e1",
                flexShrink: 0,
                boxShadow: clockedIn ? `0 0 8px ${C.green}` : "none",
              }} />
            </div>

            {/* Role switcher */}
            <select
              value={activeStaffId}
              onChange={e => onStaffChange(Number(e.target.value))}
              onMouseEnter={() => setStaffSelectHov(true)}
              onMouseLeave={() => setStaffSelectHov(false)}
              style={{
                width: "100%",
                padding: "8px 10px",
                fontSize: 11,
                background: staffSelectHov ? "rgba(255, 255, 255, 0.1)" : "rgba(255, 255, 255, 0.06)",
                border: `1px solid ${staffSelectHov ? "rgba(255, 255, 255, 0.15)" : "rgba(255, 255, 255, 0.1)"}`,
                borderRadius: 6,
                color: "rgba(255, 255, 255, 0.7)",
                fontFamily: "inherit",
                outline: "none",
                cursor: "pointer",
                transition: "all 0.14s ease",
              }}
            >
              {staffRoster.map(s => (
                <option key={s.id} value={s.id} style={{ background: C.navy, color: C.white }}>
                  {s.name} ({s.role})
                </option>
              ))}
            </select>
            <div style={{
              fontSize: 9,
              color: "rgba(255, 255, 255, 0.3)",
              marginTop: 6,
              textAlign: "center",
              fontWeight: 500,
            }}>
              Switch role for demo
            </div>
          </>
        )}
      </div>

      {/* ── Navigation ────────────────────────────────────────── */}
      <nav style={{
        flex: 1,
        overflowY: "auto",
        overflowX: "hidden",
        padding: "12px 10px",
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(255,255,255,0.1) transparent",
      }}>
        {visibleNav.map(item => (
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

      {/* ── Clock in / out ────────────────────────────────────── */}
      <div style={{
        padding: "12px 10px",
        borderTop: `1px solid rgba(255, 255, 255, 0.08)`,
        flexShrink: 0,
      }}>
        <button
          onClick={onToggleClock}
          onMouseEnter={() => setClockBtnHov(true)}
          onMouseLeave={() => setClockBtnHov(false)}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 8,
            border: `1px solid ${clockedIn ? "rgba(220, 38, 38, 0.25)" : "rgba(10, 124, 78, 0.25)"}`,
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            background: clockedIn
              ? clockBtnHov ? "rgba(220, 38, 38, 0.18)" : "rgba(220, 38, 38, 0.1)"
              : clockBtnHov ? "rgba(10, 124, 78, 0.18)" : "rgba(10, 124, 78, 0.1)",
            color: clockedIn ? "#f87171" : "#4ade80",
            transition: "all 0.14s ease",
          }}
        >
          {clockedIn ? "⏹ Clock Out" : "▶ Clock In"}
        </button>
      </div>
    </div>
  );
}
