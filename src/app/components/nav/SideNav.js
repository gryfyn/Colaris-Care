'use client';

import { useState } from 'react';
import Image from 'next/image';
import { NAV_GROUPS } from './nav-config';

// ── palette ──────────────────────────────────────────────────────────────────
const BG_TOP    = "#0b1628";
const BG_BTM    = "#0e2040";
const ACCENT    = "#3b82f6";
const ACCENT_DIM = "rgba(59,130,246,0.14)";

// ── NavItem ───────────────────────────────────────────────────────────────────
function NavItem({ item, active, onClick, open, hovered, onHover }) {
  const isActive  = active === item.id;
  const isHovered = hovered === item.id;

  return (
    <button
      onClick={() => onClick(item.id)}
      onMouseEnter={() => onHover(item.id)}
      onMouseLeave={() => onHover(null)}
      title={!open ? item.label : undefined}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: open ? "9px 12px" : "9px 0",
        justifyContent: open ? "flex-start" : "center",
        background: isActive
          ? ACCENT_DIM
          : isHovered
            ? "rgba(255,255,255,0.05)"
            : "transparent",
        border: "none",
        borderLeft: isActive
          ? `3px solid ${ACCENT}`
          : "3px solid transparent",
        borderRadius: isActive ? "0 7px 7px 0" : 7,
        cursor: "pointer",
        marginBottom: 2,
        color: isActive
          ? "#bfdbfe"
          : isHovered
            ? "rgba(255,255,255,0.82)"
            : "rgba(255,255,255,0.45)",
        fontSize: 13,
        fontWeight: isActive ? 600 : 400,
        letterSpacing: "0.01em",
        transition: "background 0.14s ease, color 0.14s ease, border-color 0.14s ease",
        position: "relative",
        textAlign: "left",
      }}
    >
      {/* Icon */}
      <span style={{
        fontSize: 15,
        width: 22,
        textAlign: "center",
        flexShrink: 0,
        opacity: isActive ? 1 : isHovered ? 0.8 : 0.6,
        transition: "opacity 0.14s ease",
        filter: isActive ? `drop-shadow(0 0 5px rgba(59,130,246,0.5))` : "none",
      }}>
        {item.icon}
      </span>

      {/* Label */}
      {open && (
        <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {item.label}
        </span>
      )}

      {/* Active pip */}
      {open && isActive && (
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

// ── SideNav ───────────────────────────────────────────────────────────────────
export default function SideNav({ active, open, onNavigate, onToggle }) {
  const [hovered, setHovered]       = useState(null);
  const [btnHovered, setBtnHovered] = useState(false);

  return (
    <div style={{
      width: open ? 248 : 68,
      background: `linear-gradient(180deg, ${BG_TOP} 0%, ${BG_BTM} 100%)`,
      display: "flex",
      flexDirection: "column",
      transition: "width 0.24s cubic-bezier(0.4, 0, 0.2, 1)",
      flexShrink: 0,
      overflow: "hidden",
      borderRight: "1px solid rgba(255,255,255,0.055)",
      boxShadow: "4px 0 28px rgba(0,0,0,0.22)",
      position: "relative",
      zIndex: 20,
    }}>

      {/* Ambient glow blob — decorative only */}
      <div style={{
        position: "absolute",
        top: -60,
        left: -60,
        width: 220,
        height: 220,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(59,130,246,0.09) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* ── Brand ─────────────────────────────────────────────────── */}
      <div style={{
        padding: "18px 16px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        display: "flex",
        alignItems: "center",
        gap: 11,
        minHeight: 70,
        flexShrink: 0,
      }}>
        {/* Logomark */}
        <Image
          src="/logo.png"
          alt="Dependable Care Wellness Centre"
          width={36}
          height={36}
          style={{ borderRadius: 10, flexShrink: 0 }}
        />

        {/* Wordmark */}
        {open && (
          <div style={{ overflow: "hidden", lineHeight: 1 }}>
            <div style={{
              color: "#fff",
              fontSize: 13.5,
              fontWeight: 700,
              whiteSpace: "nowrap",
              letterSpacing: "-0.01em",
            }}>
              Dependable Care
            </div>
            <div style={{
              color: "rgba(255,255,255,0.3)",
              fontSize: 9.5,
              fontWeight: 600,
              whiteSpace: "nowrap",
              letterSpacing: "0.1em",
              marginTop: 3,
              textTransform: "uppercase",
            }}>
              Wellness Centre
            </div>
          </div>
        )}
      </div>

      {/* ── Navigation ────────────────────────────────────────────── */}
      <nav style={{
        flex: 1,
        overflowY: "auto",
        overflowX: "hidden",
        padding: "10px 8px",
        scrollbarWidth: "none",
      }}>
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label} style={{ marginBottom: gi < NAV_GROUPS.length - 1 ? 6 : 0 }}>

            {/* Group label */}
            {open ? (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px 5px",
              }}>
                <span style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.2)",
                  textTransform: "uppercase",
                  letterSpacing: "0.13em",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}>
                  {group.label}
                </span>
                <div style={{
                  flex: 1,
                  height: "1px",
                  background: "rgba(255,255,255,0.07)",
                }} />
              </div>
            ) : (
              gi > 0 && (
                <div style={{
                  margin: "6px 14px",
                  height: "1px",
                  background: "rgba(255,255,255,0.08)",
                }} />
              )
            )}

            {/* Items */}
            {group.items.map(item => (
              <NavItem
                key={item.id}
                item={item}
                active={active}
                onClick={onNavigate}
                open={open}
                hovered={hovered}
                onHover={setHovered}
              />
            ))}
          </div>
        ))}
      </nav>

      {/* ── User strip + collapse ─────────────────────────────────── */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>

        {/* User card — only when expanded */}
        {open && (
          <div style={{
            padding: "12px 14px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}>
            {/* Avatar */}
            <div style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #3b82f6 0%, #7c3aed 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 700,
              color: "#fff",
              flexShrink: 0,
              boxShadow: "0 2px 8px rgba(59,130,246,0.35)",
            }}>
              AD
            </div>

            <div style={{ overflow: "hidden", flex: 1 }}>
              <div style={{
                fontSize: 12,
                fontWeight: 600,
                color: "rgba(255,255,255,0.85)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}>
                Admin
              </div>
              <div style={{
                fontSize: 10,
                color: "rgba(255,255,255,0.3)",
                whiteSpace: "nowrap",
              }}>
                Clinical Director
              </div>
            </div>

            {/* Online dot */}
            <div style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "#22c55e",
              boxShadow: "0 0 7px rgba(34,197,94,0.65)",
              flexShrink: 0,
            }} />
          </div>
        )}

        {/* Collapse button */}
        <div style={{
          padding: open ? "10px 14px" : "12px 0",
          display: "flex",
          justifyContent: open ? "flex-end" : "center",
        }}>
          <button
            onClick={onToggle}
            onMouseEnter={() => setBtnHovered(true)}
            onMouseLeave={() => setBtnHovered(false)}
            title={open ? "Collapse sidebar" : "Expand sidebar"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              background: btnHovered ? "rgba(255,255,255,0.07)" : "transparent",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 6,
              color: btnHovered ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.28)",
              cursor: "pointer",
              fontSize: 10,
              padding: "5px 9px",
              transition: "all 0.15s ease",
              fontWeight: 600,
              letterSpacing: "0.02em",
            }}
          >
            {open ? (
              <>
                <span style={{ fontSize: 9 }}>◀◀</span>
                <span>Collapse</span>
              </>
            ) : (
              <span style={{ fontSize: 9 }}>▶▶</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
