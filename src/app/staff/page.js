'use client';
import { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ErrorNotification } from '@/app/components/ErrorNotification';
import { DataLoadingState } from '@/app/components/LoadingState';
import { parseAPIError, APIError } from '@/lib/api-error-handler';
import {
  Search, Bell, LogOut, X, ChevronRight, ChevronLeft, Plus, Check,
  Users, Scroll, CalendarDays, NotebookPen, Pill, FileText,
  AlertTriangle, Trash2, DoorOpen, Megaphone, Inbox, Calendar,
  UserCircle2, ArrowUpRight, CircleAlert, KeyRound,
} from 'lucide-react';
import { StaffNavigation, StaffMenuButton } from './StaffNavigation';
import FaceSheet from '@/app/components/FaceSheet';

// ─── THEME (back-compat shim mapping to --staff-* tokens) ────────────────────
// Older sections in this file reference `C.navy`, `C.blue`, etc. We keep the
// shape but route everything through staff CSS variables so the forest theme
// applies consistently without touching every section.
const C = {
  navy:       "var(--staff-ink)",
  navyMid:    "var(--staff-ink-soft)",
  blue:       "var(--staff-accent)",
  bluePale:   "var(--staff-accent-soft)",
  blueBorder: "rgba(194,65,12,0.25)",
  white:      "var(--staff-paper)",
  bg:         "var(--staff-canvas)",
  text:       "var(--staff-text)",
  muted:      "var(--staff-text-soft)",
  border:     "var(--staff-border)",
  green:      "var(--staff-success)",
  greenBg:    "var(--staff-success-bg)",
  amber:      "var(--staff-warning)",
  amberBg:    "var(--staff-warning-bg)",
  red:        "var(--staff-danger)",
  redBg:      "var(--staff-danger-bg)",
  teal:       "#0F766E",
  tealBg:     "#F0FDFA",
  gold:       "#B45309",
  purple:     "#6D28D9",
  purpleBg:   "#F5F3FF",
};

// ─── SHARED PRIMITIVES — staff theme (forest + sage + copper) ────────────────
const inp = {
  width: "100%",
  padding: "10px 12px",
  height: 40,
  border: "1px solid var(--staff-border)",
  borderRadius: 9,
  fontSize: 13,
  background: "var(--staff-paper)",
  color: "var(--staff-text)",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
  transition: "border-color 0.16s ease, box-shadow 0.16s ease",
};
const lbl = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: "var(--staff-text)",
  marginBottom: 6,
  letterSpacing: "0.02em",
};
const secHead = {
  fontFamily: "var(--font-fraunces), Georgia, serif",
  fontSize: 16,
  fontWeight: 500,
  color: "var(--staff-text)",
  letterSpacing: "-0.015em",
  paddingBottom: 8,
  marginBottom: 14,
  marginTop: 26,
  borderBottom: "1px solid var(--staff-border)",
};
const inputFocusHandlers = {
  onFocus: (e) => { e.target.style.borderColor = "var(--staff-accent)"; e.target.style.boxShadow = "var(--staff-focus)"; },
  onBlur:  (e) => { e.target.style.borderColor = "var(--staff-border)"; e.target.style.boxShadow = "none"; },
};

function F({ label, required, children, span = 1 }) {
  return (
    <div style={{ gridColumn: `span ${span}` }}>
      {label && (
        <label style={lbl}>
          {label}
          {required && <span aria-hidden="true" style={{ color: "var(--staff-danger)", marginLeft: 4 }}>●</span>}
        </label>
      )}
      {children}
    </div>
  );
}
function TI({ value, onChange, placeholder, type = "text", readOnly = false }) {
  return (
    <input
      readOnly={readOnly}
      type={type}
      value={value ?? ""}
      onChange={(e) => onChange && onChange(e.target.value)}
      placeholder={placeholder}
      {...inputFocusHandlers}
      style={{
        ...inp,
        background: readOnly ? "var(--staff-canvas)" : "var(--staff-paper)",
        color: readOnly ? "var(--staff-text-soft)" : "var(--staff-text)",
        fontWeight: readOnly ? 500 : 400,
      }}
    />
  );
}
function Sel({ value, onChange, options }) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      {...inputFocusHandlers}
      style={{
        ...inp,
        appearance: "none",
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238A9892' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 12px center",
        paddingRight: 34,
      }}
    >
      <option value="">— Select —</option>
      {options.map((o) => (
        <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>
      ))}
    </select>
  );
}
function TA({ value, onChange, placeholder, rows = 3 }) {
  return (
    <textarea
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      {...inputFocusHandlers}
      style={{ ...inp, height: "auto", resize: "vertical", lineHeight: 1.5, padding: "11px 12px" }}
    />
  );
}
function Grid({ cols = 2, children }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gap: "14px 18px",
      }}
    >
      {children}
    </div>
  );
}
function SH({ children }) { return <div style={secHead}>{children}</div>; }

function InfoBox({ tone = "info", children }) {
  const tones = {
    info:    { fg: "var(--staff-accent)",  bg: "var(--staff-accent-soft)",  bd: "rgba(194,65,12,0.18)" },
    warning: { fg: "var(--staff-warning)", bg: "var(--staff-warning-bg)",   bd: "rgba(180,83,9,0.22)" },
    danger:  { fg: "var(--staff-danger)",  bg: "var(--staff-danger-bg)",    bd: "rgba(185,28,28,0.22)" },
    success: { fg: "var(--staff-success)", bg: "var(--staff-success-bg)",   bd: "rgba(4,120,87,0.18)" },
  };
  const t = tones[tone] ?? tones.info;
  return (
    <div style={{
      background: t.bg,
      border: `1px solid ${t.bd}`,
      borderRadius: 10,
      padding: "11px 14px",
      fontSize: 13,
      color: t.fg,
      marginBottom: 14,
      lineHeight: 1.55,
      display: "flex",
      gap: 10,
    }}>
      <CircleAlert size={16} strokeWidth={1.8} style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1, color: "var(--staff-text)" }}>{children}</div>
    </div>
  );
}

// ─── BADGE — dot + label ─────────────────────────────────────────────────────
const BADGE_STATUS = {
  "Pending":              { dot: "#FBBF24", text: "var(--staff-warning)" },
  "Pending Review":       { dot: "#FBBF24", text: "var(--staff-warning)" },
  "Pending Witness":      { dot: "#FBBF24", text: "var(--staff-warning)" },
  "Pending Disposal":     { dot: "#F87171", text: "var(--staff-danger)"  },
  "Pending Confirmation": { dot: "#FBBF24", text: "var(--staff-warning)" },
  "Closed":               { dot: "#94A3B8", text: "var(--staff-text-soft)" },
  "Complete":             { dot: "#34D399", text: "var(--staff-success)" },
  "Completed":            { dot: "#34D399", text: "var(--staff-success)" },
  "Scheduled":            { dot: "#FB923C", text: "var(--staff-accent)" },
  "Sent":                 { dot: "#34D399", text: "var(--staff-success)" },
  "Draft":                { dot: "#CBD5E1", text: "var(--staff-text-soft)" },
  "High":                 { dot: "#F87171", text: "var(--staff-danger)"  },
  "Medium":               { dot: "#FBBF24", text: "var(--staff-warning)" },
  "Low":                  { dot: "#34D399", text: "var(--staff-success)" },
  "Normal":               { dot: "#FB923C", text: "var(--staff-accent)" },
  "active":               { dot: "#34D399", text: "var(--staff-success)" },
  "inactive":             { dot: "#CBD5E1", text: "var(--staff-text-soft)" },
  "voluntary":            { dot: "#FB923C", text: "var(--staff-accent)" },
  "civil_commitment":     { dot: "#FBBF24", text: "var(--staff-warning)" },
  "guardianship":         { dot: "#A78BFA", text: "#5B21B6" },
};
function Badge({ status, size = "md" }) {
  const s = BADGE_STATUS[status] || { dot: "#CBD5E1", text: "var(--staff-text-soft)" };
  const label = String(status ?? "—").replace(/_/g, " ");
  const dotSize = size === "sm" ? 6 : 7;
  const fontSize = size === "sm" ? 11 : 11.5;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        fontSize,
        fontWeight: 500,
        color: s.text,
        whiteSpace: "nowrap",
        textTransform: "capitalize",
        letterSpacing: "0.005em",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: dotSize, height: dotSize, borderRadius: "50%",
          background: s.dot, flexShrink: 0,
          boxShadow: "0 0 0 2px rgba(255,255,255,0.6)",
        }}
      />
      {label}
    </span>
  );
}

// ─── AVATAR — monogram with hash-tinted bg ───────────────────────────────────
function nameHue(name = "") {
  let h = 0;
  const s = String(name || "");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const buckets = [165, 145, 125, 90, 40, 25, 200, 175];
  return buckets[h % buckets.length];
}
function Avatar({ name, size = 38, role }) {
  const initials = (name || "?")
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const hue = nameHue(name);
  const sat = role ? 22 : 26;
  const light = role ? 76 : 80;
  const fontSize = Math.round(size * 0.36);
  return (
    <span
      aria-hidden="true"
      style={{
        width: size, height: size,
        borderRadius: "50%",
        background: `hsl(${hue}, ${sat}%, ${light}%)`,
        color: "var(--staff-ink)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize,
        fontWeight: 600,
        letterSpacing: "0.02em",
        flexShrink: 0,
        boxShadow: "inset 0 0 0 1px rgba(15,30,26,0.06)",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
      }}
    >
      {initials || "?"}
    </span>
  );
}

// ─── PERSON ROW + LIST — same responsive pattern as admin ────────────────────
function PersonRow({ name, avatarName, secondary, meta = [], status, onClick, role }) {
  const rowRef = useRef(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    if (!rowRef.current) return;
    const el = rowRef.current;
    const ro = new ResizeObserver(([entry]) => setNarrow(entry.contentRect.width < 640));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const wideTemplate = `auto minmax(0, 1.4fr) ${meta.map(() => "minmax(0, 1fr)").join(" ")} auto 14px`;
  const narrowTemplate = "auto 1fr auto";

  return (
    <button
      ref={rowRef}
      type="button"
      onClick={onClick}
      data-clickable={onClick ? "true" : "false"}
      style={{
        display: "grid",
        gridTemplateColumns: narrow ? narrowTemplate : wideTemplate,
        gridTemplateAreas: narrow ? `"avatar primary status" "avatar meta meta"` : undefined,
        alignItems: "center",
        gap: narrow ? "4px 14px" : "0 16px",
        padding: narrow ? "14px 16px" : "14px 18px",
        borderBottom: "1px solid var(--staff-border-soft)",
        background: "transparent",
        border: "none",
        borderLeft: "none",
        borderRight: "none",
        cursor: onClick ? "pointer" : "default",
        textAlign: "left",
        width: "100%",
        fontFamily: "inherit",
        transition: "background 0.16s ease",
      }}
      onMouseEnter={(e) => onClick && (e.currentTarget.style.background = "rgba(14,42,34,0.03)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <span style={{ gridArea: narrow ? "avatar" : undefined }}>
        <Avatar name={avatarName || (typeof name === "string" ? name : "?")} size={narrow ? 38 : 40} role={role} />
      </span>

      <span style={{ minWidth: 0, gridArea: narrow ? "primary" : undefined }}>
        <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--staff-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {name}
        </span>
        {secondary && (
          <span style={{ display: "block", fontSize: 12, color: "var(--staff-text-soft)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {secondary}
          </span>
        )}
      </span>

      {narrow ? (
        <span style={{ gridArea: "meta", display: "flex", flexWrap: "wrap", gap: "4px 12px", paddingTop: 4 }}>
          {meta.map((m, i) => (
            <span key={i} style={{ fontSize: 11.5, color: "var(--staff-text-soft)", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span style={{ color: "var(--staff-text-muted)" }}>{m.label}:</span>
              {m.value || <span style={{ color: "var(--staff-text-muted)" }}>—</span>}
            </span>
          ))}
        </span>
      ) : (
        meta.map((m, i) => (
          <span key={i} style={{ fontSize: 12.5, color: "var(--staff-text-soft)", minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {m.value || <span style={{ color: "var(--staff-text-muted)" }}>—</span>}
          </span>
        ))
      )}

      <span style={{ gridArea: narrow ? "status" : undefined, justifySelf: narrow ? "end" : "start", display: "inline-flex", alignItems: "center" }}>
        {status && (typeof status === "string" ? <Badge status={status} /> : status)}
      </span>

      {!narrow && <ChevronRight size={16} strokeWidth={1.75} style={{ color: "var(--staff-text-muted)" }} />}
    </button>
  );
}

function PersonList({ children }) {
  return (
    <div
      style={{
        background: "var(--staff-paper)",
        border: "1px solid var(--staff-border)",
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

// ─── REFINED TABLE for non-person data ───────────────────────────────────────
function Table({ cols, rows, onRow }) {
  return (
    <div
      style={{
        background: "var(--staff-paper)",
        border: "1px solid var(--staff-border)",
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              {cols.map((c) => (
                <th
                  key={c}
                  style={{
                    textAlign: "left",
                    fontSize: 10.5,
                    fontWeight: 600,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "var(--staff-text-soft)",
                    background: "var(--staff-canvas)",
                    padding: "11px 16px",
                    borderBottom: "1px solid var(--staff-border)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                onClick={() => onRow && onRow(row)}
                style={{
                  cursor: onRow ? "pointer" : "default",
                  borderBottom: i < rows.length - 1 ? "1px solid var(--staff-border-soft)" : "none",
                }}
                onMouseEnter={(e) => onRow && (e.currentTarget.style.background = "rgba(14,42,34,0.025)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {row.map((cell, j) => (
                  <td
                    key={j}
                    style={{
                      padding: "13px 16px",
                      color: "var(--staff-text)",
                      verticalAlign: "middle",
                    }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── MODAL — sticky header/footer, bottom-sheet on mobile ────────────────────
function Modal({ title, onClose, children, wide = false, footer = null }) {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const check = () => setNarrow(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 500,
        background: "rgba(14, 42, 34, 0.55)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        display: "flex",
        alignItems: narrow ? "flex-end" : "center",
        justifyContent: "center",
        padding: narrow ? 0 : 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: narrow ? "100%" : (wide ? "min(960px, 100%)" : "min(720px, 100%)"),
          maxHeight: narrow ? "92vh" : "calc(100vh - 48px)",
          background: "var(--staff-paper)",
          borderRadius: narrow ? "18px 18px 0 0" : 14,
          boxShadow: "0 24px 60px rgba(14, 42, 34, 0.22)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          animation: narrow
            ? "admin-sheet-up 0.28s cubic-bezier(0.22, 1, 0.36, 1) both"
            : "admin-fade-up 0.22s ease both",
        }}
      >
        <div
          style={{
            position: "sticky",
            top: 0,
            background: "var(--staff-paper)",
            padding: "18px 22px",
            borderBottom: "1px solid var(--staff-border-soft)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-fraunces), Georgia, serif",
              fontSize: 18,
              fontWeight: 500,
              color: "var(--staff-text)",
              margin: 0,
              letterSpacing: "-0.012em",
            }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: "var(--staff-canvas)",
              border: "1px solid var(--staff-border)",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--staff-text-soft)",
            }}
          >
            <X size={15} strokeWidth={2} />
          </button>
        </div>
        <div style={{ padding: "20px 22px 24px", overflowY: "auto", flex: 1 }}>
          {children}
        </div>
        {footer && (
          <div
            style={{
              position: "sticky",
              bottom: 0,
              background: "var(--staff-paper)",
              padding: "14px 22px",
              borderTop: "1px solid var(--staff-border-soft)",
              display: "flex",
              gap: 10,
              justifyContent: "flex-end",
              flexShrink: 0,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

function AlertBadge() {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: 18,
      height: 18,
      borderRadius: "50%",
      background: "var(--staff-danger)",
      color: "var(--staff-paper)",
      fontSize: 10,
      fontWeight: 700,
      marginLeft: 6,
      verticalAlign: "middle",
      animation: "admin-pulse-dot 2.2s ease-in-out infinite",
      flexShrink: 0,
    }}>!</span>
  );
}

// ─── STAT CARD (single) — kept for back-compat with existing sections ────────
function StatCard({ label, value, color, sub }) {
  return (
    <div
      style={{
        background: "var(--staff-paper)",
        border: "1px solid var(--staff-border)",
        borderRadius: 12,
        padding: "14px 16px",
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 600,
          color: "var(--staff-text-soft)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-fraunces), Georgia, serif",
          fontSize: 28,
          fontWeight: 500,
          color: color || "var(--staff-text)",
          letterSpacing: "-0.025em",
          marginTop: 4,
          lineHeight: 1,
        }}
      >
        {value ?? "—"}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: "var(--staff-text-soft)", marginTop: 6 }}>{sub}</div>
      )}
    </div>
  );
}

// ─── STAT CARDS (plural) — auto-fit grid wrapper ─────────────────────────────
function StatCards({ stats }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: 12,
        marginBottom: 22,
      }}
    >
      {stats.map((s) => (
        <StatCard key={s.label} label={s.label} value={s.value} color={s.color} sub={s.sub} />
      ))}
    </div>
  );
}

function EmptyState({ title, Icon = Inbox, desc, action }) {
  return (
    <div
      style={{
        background: "var(--staff-paper)",
        border: "1px dashed var(--staff-border)",
        borderRadius: 14,
        padding: "48px 24px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 48, height: 48,
          margin: "0 auto 14px",
          borderRadius: 12,
          background: "var(--staff-canvas)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--staff-text-muted)",
        }}
      >
        <Icon size={22} strokeWidth={1.6} />
      </div>
      <div
        style={{
          fontFamily: "var(--font-fraunces), Georgia, serif",
          fontWeight: 500,
          color: "var(--staff-text)",
          marginBottom: 6,
          fontSize: 17,
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </div>
      {desc && <div style={{ fontSize: 13, color: "var(--staff-text-soft)", maxWidth: 380, margin: "0 auto", lineHeight: 1.5 }}>{desc}</div>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

function PageHeader({ title, sub, action }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
        marginBottom: 22,
      }}
    >
      <div>
        <h1
          style={{
            fontFamily: "var(--font-fraunces), Georgia, serif",
            fontSize: 28,
            fontWeight: 500,
            color: "var(--staff-text)",
            margin: 0,
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
          }}
        >
          {title}
        </h1>
        {sub && (
          <div style={{ fontSize: 13, color: "var(--staff-text-soft)", marginTop: 6 }}>{sub}</div>
        )}
      </div>
      {action && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{action}</div>}
    </div>
  );
}

function PrimaryButton({ Icon, children, onClick, tone = "ink", type = "button" }) {
  const tones = {
    ink:    { bg: "var(--staff-ink)",   fg: "var(--staff-paper)" },
    accent: { bg: "var(--staff-accent)", fg: "var(--staff-paper)" },
    ghost:  { bg: "var(--staff-paper)",  fg: "var(--staff-text)", border: "1px solid var(--staff-border)" },
  };
  const t = tones[tone];
  return (
    <button
      type={type}
      onClick={onClick}
      style={{
        padding: "9px 14px",
        background: t.bg,
        color: t.fg,
        border: t.border || "none",
        borderRadius: 9,
        fontSize: 12.5,
        fontWeight: 600,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        fontFamily: "inherit",
        transition: "transform 0.12s ease, opacity 0.12s ease",
      }}
      onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.98)")}
      onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
    >
      {Icon && <Icon size={14} strokeWidth={2} />}
      {children}
    </button>
  );
}

function DetailField({ label, value }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <span style={{ fontSize: 10.5, color: "var(--staff-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 13, color: "var(--staff-text)", fontWeight: 500, wordBreak: "break-word" }}>{value || <span style={{ color: "var(--staff-text-muted)" }}>—</span>}</span>
    </div>
  );
}

// ─── NAVIGATION ───────────────────────────────────────────────────────────────
// (Old inline StaffNavigation removed — now imported from ./StaffNavigation)

// ─── WELCOME SECTION COMPONENT ────────────────────────────────────────────────
function WelcomeSection({ staff, pendingProgressNotes = 0, setView }) {
  const now = new Date();
  const greeting =
    now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const firstName = staff?.first_name || staff?.firstName;
  const notes = Number(pendingProgressNotes ?? 0);

  return (
    <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, animation: 'admin-fade-up 0.4s ease both' }}>
      <div>
        <div style={{ fontSize: 12, color: 'var(--staff-text-soft)', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 600 }}>
          {dateStr}
        </div>
        <h1
          style={{
            fontFamily: 'var(--font-fraunces), Georgia, serif',
            fontSize: 36,
            fontWeight: 500,
            color: 'var(--staff-text)',
            margin: '6px 0 0',
            letterSpacing: '-0.025em',
            lineHeight: 1.1,
          }}
        >
          {greeting}{firstName ? `, ${firstName}` : ''}.
        </h1>
        <div style={{ fontSize: 13.5, color: 'var(--staff-text-soft)', marginTop: 6 }}>
          {notes > 0
            ? <>You have <strong style={{ color: 'var(--staff-text)' }}>{notes}</strong> progress note{notes === 1 ? '' : 's'} awaiting your review.</>
            : 'Your queue is clear. Nice work.'}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <PrimaryButton Icon={NotebookPen} onClick={() => setView?.('progress')}>
          Log Progress Note
        </PrimaryButton>
        <PrimaryButton Icon={Plus} tone="ghost" onClick={() => setView?.('incidents')}>
          File Incident
        </PrimaryButton>
      </div>
    </div>
  );
}


// ─── PENDING PROGRESS NOTES VIEW ──────────────────────────────────────────────
function PendingProgressNotesView({ isMobile }) {
  const { auth } = useAuth();
  const api = useApi(auth);
  const [notes, setNotes] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();

  const fetchNotes = useCallback(() => {
    if (!auth) return;
    setLoading(true);
    setError(null);
    api(`/api/v1/daily-progress-notes/pending?date=${date}`)
      .then(d => { setNotes(d.data || []); setLoading(false); })
      .catch(err => {
        const parsed = parseAPIError(err);
        setError(parsed);
        setLoading(false);
      });
  }, [auth, api, date]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: C.navy }}>Pending Progress Notes</div>
        {notes.length > 0 && (
          <span style={{ background: C.redBg, color: C.red, padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
            {notes.length} pending
          </span>
        )}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>Date:</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ padding: "6px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, color: C.text, background: C.white }}
          />
        </div>
      </div>

      {error && (
        <ErrorNotification
          title={error.title}
          message={error.message}
          onDismiss={() => setError(null)}
          onRetry={() => fetchNotes()}
          isDismissible
        />
      )}

      {loading ? (
        <EmptyState title="Loading..." desc="Fetching pending progress notes" />
      ) : notes.length === 0 ? (
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: 48, textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 12, color: C.green }}>✓</div>
          <div style={{ fontWeight: 700, color: C.green, marginBottom: 6, fontSize: 15 }}>All caught up!</div>
          <div style={{ fontSize: 13, color: C.muted }}>No pending progress notes for {date}</div>
        </div>
      ) : (
        <Table
          cols={["Resident Name", "Date", "Action"]}
          rows={notes.map(n => [
            `${n.first_name || ""} ${n.last_name || ""}`.trim() || "—",
            date,
            <button
              key={`action-${n.resident_id}`}
              onClick={() => router.push(`/reports/daily-progress-notes?resident_id=${n.resident_id}&date=${date}`)}
              style={{ background: C.blue, color: C.white, border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            >
              Fill Note
            </button>
          ])}
        />
      )}
    </div>
  );
}

// ─── GENERIC STAFF SUBMISSIONS LIST ──────────────────────────────────────────
function StaffSubmissionsList({ title, fetchUrl, formUrl, columns, mapRow, isMobile }) {
  const { auth } = useAuth();
  const api = useApi(auth);
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!auth) return;
    setLoading(true);
    setError(null);
    api(fetchUrl)
      .then(d => { setItems(d.data || []); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [auth, api, fetchUrl]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: C.navy }}>{title}</div>
        <button
          onClick={() => router.push(formUrl)}
          style={{ background: C.blue, color: C.white, border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          + Submit New
        </button>
      </div>

      {loading ? (
        <EmptyState title="Loading..." desc={`Fetching ${title.toLowerCase()}`} />
      ) : error ? (
        <EmptyState title="Error" desc={error} />
      ) : items.length === 0 ? (
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: 48, textAlign: "center" }}>
          <div style={{ fontWeight: 700, color: C.navy, marginBottom: 6, fontSize: 15 }}>No submissions yet</div>
          <div style={{ fontSize: 13, color: C.muted }}>Click "Submit New" to file your first {title.toLowerCase().slice(0, -1)}</div>
        </div>
      ) : (
        <Table cols={columns} rows={items.map(mapRow)} />
      )}
    </div>
  );
}

function IncidentReportsView({ isMobile }) {
  return (
    <StaffSubmissionsList
      title="Incident Reports"
      fetchUrl="/api/v1/incidents"
      formUrl="/reports/incident-form"
      columns={["Date", "Resident", "Type", "Status"]}
      mapRow={(n) => [
        n.incident_date ? new Date(n.incident_date).toLocaleDateString() : "—",
        `${n.first_name || ""} ${n.last_name || ""}`.trim() || "—",
        n.incident_type || "—",
        <Badge key={`s-${n.id}`} status={n.review_status || "pending"} />,
      ]}
      isMobile={isMobile}
    />
  );
}

function DrugDisposalView({ isMobile }) {
  return (
    <StaffSubmissionsList
      title="Drug Disposal Records"
      fetchUrl="/api/v1/drug-disposal"
      formUrl="/reports/drug-disposal"
      columns={["Date", "Resident", "Drug", "Status"]}
      mapRow={(n) => [
        n.disposal_date ? new Date(n.disposal_date).toLocaleDateString() : "—",
        `${n.first_name || ""} ${n.last_name || ""}`.trim() || "—",
        n.drug_name || "—",
        <Badge key={`s-${n.id}`} status={n.review_status || "pending"} />,
      ]}
      isMobile={isMobile}
    />
  );
}

// ─── MEDICATIONS VIEW (STAFF) ────────────────────────────────────────────────
// Staff sees medications for all residents (facility-wide), can search by name/drug,
// then click Administer or Mark Not Given (with reason).
function MedicationsView({ isMobile }) {
  const { auth } = useAuth();
  const api = useApi(auth);
  const [meds, setMeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [administering, setAdministering] = useState(null); // med being administered
  const [administerAction, setAdministerAction] = useState('given'); // 'given' | 'refused'
  const [administerForm, setAdministerForm] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null); // { kind: 'success'|'error', message }

  const fetchMeds = useCallback(() => {
    if (!auth) return;
    setLoading(true);
    setError(null);
    api('/api/v1/medications?active=true&limit=200')
      .then(d => { setMeds(d.data || []); setLoading(false); })
      .catch(err => {
        const parsed = parseAPIError(err);
        setError(parsed);
        setLoading(false);
      });
  }, [auth, api]);

  useEffect(() => { fetchMeds(); }, [fetchMeds]);

  const filteredMeds = meds.filter(m => {
    if (!search) return true;
    const q = search.toLowerCase();
    const name = `${m.first_name || ''} ${m.last_name || ''}`.toLowerCase();
    return m.drug_name.toLowerCase().includes(q) || name.includes(q);
  });

  const currentHour = new Date().getHours();
  const suggestedShift =
    currentHour >= 6 && currentHour < 14 ? 'morning' :
    currentHour >= 14 && currentHour < 22 ? 'afternoon' : 'night';

  const openAdminister = (med, action) => {
    setAdministering(med);
    setAdministerAction(action);
    setAdministerForm({
      shift: med.is_prn ? 'prn' : suggestedShift,
      dose_given: med.dosage,
      refusal_reason: '',
      prn_reason: '',
      notes: '',
      side_effects_noted: '',
    });
    setFeedback(null);
  };

  const closeAdminister = () => {
    setAdministering(null);
    setAdministerForm({});
  };

  const submitAdminister = async () => {
    if (!administering) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const body = {
        administered: administerAction === 'given',
        shift: administerForm.shift || null,
        dose_given: administerForm.dose_given || null,
        notes: administerForm.notes || null,
        side_effects_noted: administerForm.side_effects_noted || null,
      };
      if (administerAction === 'refused') {
        body.refusal_reason = administerForm.refusal_reason;
      }
      if (administering.is_prn && administerAction === 'given') {
        body.prn_reason = administerForm.prn_reason;
      }

      const res = await fetch(`/api/v1/medications/${administering.id}/administer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.accessToken}`,
        },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ kind: 'error', message: data.error || 'Failed to record' });
        return;
      }
      setFeedback({ kind: 'success', message: data.message });
      setTimeout(() => {
        closeAdminister();
        setFeedback(null);
      }, 1200);
    } catch (err) {
      setFeedback({ kind: 'error', message: 'Network error. Try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const SHIFT_OPTIONS = [
    { value: 'morning', label: 'Morning (6am – 2pm)' },
    { value: 'afternoon', label: 'Afternoon (2pm – 10pm)' },
    { value: 'night', label: 'Night (10pm – 6am)' },
    { value: 'prn', label: 'PRN (as needed)' },
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: C.navy }}>Medications</div>
        <div style={{ fontSize: 12, color: C.muted }}>Search a resident or drug, then administer or mark refusal.</div>
      </div>

      {error && (
        <ErrorNotification
          title={error.title}
          message={error.message}
          onDismiss={() => setError(null)}
          onRetry={() => fetchMeds()}
          isDismissible
        />
      )}

      {/* Search bar */}
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by resident name or drug name…"
          style={{ ...inp, width: '100%' }}
        />
      </div>

      {/* List */}
      {loading ? (
        <EmptyState title="Loading..." desc="Fetching medications" />
      ) : meds.length === 0 ? (
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: 48, textAlign: "center" }}>
          <div style={{ fontWeight: 700, color: C.navy, marginBottom: 6, fontSize: 15 }}>
            {search ? "No matches" : "No active medications"}
          </div>
          <div style={{ fontSize: 13, color: C.muted }}>
            {search ? "Try a different search term." : "No active prescriptions found."}
          </div>
        </div>
      ) : filteredMeds.length === 0 ? (
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: 48, textAlign: "center" }}>
          <div style={{ fontWeight: 700, color: C.navy, marginBottom: 6, fontSize: 15 }}>
            {meds.length === 0 ? "No active medications" : "No matches"}
          </div>
          <div style={{ fontSize: 13, color: C.muted }}>
            {meds.length === 0
              ? "No active prescriptions found."
              : "Try a different search term."}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(360px, 1fr))', gap: 14 }}>
          {filteredMeds.map(m => (
            <div key={m.id}
              style={{
                background: C.white,
                border: `1px solid ${C.border}`,
                borderLeft: m.is_controlled_substance ? `4px solid ${C.red}` : (m.is_prn ? `4px solid ${C.amber}` : `4px solid ${C.blue}`),
                borderRadius: 10,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Resident</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: C.navy }}>
                  {`${m.first_name || ''} ${m.last_name || ''}`.trim() || '—'}
                </div>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>
                  {m.drug_name}
                  {m.drug_strength && <span style={{ marginLeft: 6, color: C.muted, fontWeight: 400 }}>{m.drug_strength}</span>}
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                  {m.dosage} · {m.route} · {m.frequency}
                </div>
              </div>
              {(m.is_prn || m.is_controlled_substance) && (
                <div style={{ display: 'flex', gap: 6 }}>
                  {m.is_prn && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: C.amberBg, color: C.amber }}>PRN</span>}
                  {m.is_controlled_substance && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: C.redBg, color: C.red }}>CONTROLLED</span>}
                </div>
              )}
              {m.special_instructions && (
                <div style={{ fontSize: 12, color: C.text, padding: '8px 10px', background: '#fffbeb', borderRadius: 6, lineHeight: 1.4 }}>
                  {m.special_instructions}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                <button
                  onClick={() => openAdminister(m, 'given')}
                  style={{ flex: 1, background: C.green, color: C.white, border: 'none', borderRadius: 6, padding: '8px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  ✓ Administer
                </button>
                <button
                  onClick={() => openAdminister(m, 'refused')}
                  style={{ flex: 1, background: C.white, color: C.red, border: `1px solid ${C.red}`, borderRadius: 6, padding: '8px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  ✕ Not Given
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Administer modal */}
      {administering && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,45,94,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: C.bg, borderRadius: 12, width: 'min(560px, 95vw)', maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ background: administerAction === 'given' ? C.green : C.red, padding: '16px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '12px 12px 0 0' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--staff-paper)' }}>
                {administerAction === 'given' ? 'Administer Medication' : 'Mark Not Administered'}
              </div>
              <button onClick={closeAdminister} disabled={submitting}
                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, color: 'var(--staff-paper)', cursor: submitting ? 'default' : 'pointer', fontSize: 16, width: 30, height: 30 }}>✕</button>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, marginBottom: 18 }}>
                <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Resident & Drug</div>
                <div style={{ fontWeight: 700, color: C.navy, fontSize: 14, marginTop: 4 }}>
                  {`${administering.first_name || ''} ${administering.last_name || ''}`.trim()}
                </div>
                <div style={{ fontSize: 13, marginTop: 4 }}>
                  {administering.drug_name} {administering.drug_strength}
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                  {administering.dosage} · {administering.route} · {administering.frequency}
                </div>
              </div>

              {administerAction === 'given' ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.navy, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Dose given</label>
                      <input
                        type="text"
                        value={administerForm.dose_given || ''}
                        onChange={e => setAdministerForm(p => ({ ...p, dose_given: e.target.value }))}
                        style={{ ...inp, width: '100%' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.navy, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Shift</label>
                      <select
                        value={administerForm.shift || ''}
                        onChange={e => setAdministerForm(p => ({ ...p, shift: e.target.value }))}
                        style={{ ...inp, width: '100%' }}>
                        {SHIFT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                  </div>
                  {administering.is_prn && (
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.navy, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>PRN reason (required)</label>
                      <input
                        type="text"
                        value={administerForm.prn_reason || ''}
                        onChange={e => setAdministerForm(p => ({ ...p, prn_reason: e.target.value }))}
                        placeholder="e.g., Pain 7/10, anxiety…"
                        style={{ ...inp, width: '100%' }}
                      />
                    </div>
                  )}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.navy, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Side effects (optional)</label>
                    <input
                      type="text"
                      value={administerForm.side_effects_noted || ''}
                      onChange={e => setAdministerForm(p => ({ ...p, side_effects_noted: e.target.value }))}
                      placeholder="Any reactions observed"
                      style={{ ...inp, width: '100%' }}
                    />
                  </div>
                </>
              ) : (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.navy, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Reason (required)</label>
                  <select
                    value={administerForm.refusal_reason || ''}
                    onChange={e => setAdministerForm(p => ({ ...p, refusal_reason: e.target.value }))}
                    style={{ ...inp, width: '100%' }}>
                    <option value="">— Select reason —</option>
                    <option value="Refused by resident">Refused by resident</option>
                    <option value="Sleeping">Sleeping</option>
                    <option value="Out of facility">Out of facility</option>
                    <option value="Vomiting">Vomiting</option>
                    <option value="Held by order">Held by physician order</option>
                    <option value="Medication unavailable">Medication unavailable</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.navy, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Notes (optional)</label>
                <textarea
                  value={administerForm.notes || ''}
                  onChange={e => setAdministerForm(p => ({ ...p, notes: e.target.value }))}
                  rows={3}
                  placeholder="Any additional notes"
                  style={{ ...inp, width: '100%', resize: 'vertical' }}
                />
              </div>

              {feedback && (
                <div style={{ marginTop: 16, background: feedback.kind === 'success' ? C.greenBg : C.redBg, border: `1px solid ${feedback.kind === 'success' ? C.green : C.red}`, borderRadius: 7, padding: '10px 12px', color: feedback.kind === 'success' ? C.green : C.red, fontSize: 13 }}>
                  {feedback.message}
                </div>
              )}
            </div>
            <div style={{ background: C.white, padding: '14px 22px', display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: `1px solid ${C.border}`, borderRadius: '0 0 12px 12px' }}>
              <button onClick={closeAdminister} disabled={submitting}
                style={{ padding: '9px 18px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: submitting ? 'default' : 'pointer', color: C.muted }}>
                Cancel
              </button>
              <button onClick={submitAdminister} disabled={submitting || (administerAction === 'refused' && !administerForm.refusal_reason)}
                style={{ padding: '9px 18px', background: administerAction === 'given' ? C.green : C.red, border: 'none', borderRadius: 7, color: 'var(--staff-paper)', fontSize: 13, fontWeight: 700, cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.5 : 1 }}>
                {submitting ? 'Saving…' : (administerAction === 'given' ? 'Confirm Administration' : 'Record Refusal')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EvacuationDrillsView({ isMobile }) {
  return (
    <StaffSubmissionsList
      title="Evacuation Drills"
      fetchUrl="/api/v1/evacuation-drills"
      formUrl="/reports/evacuation-drills"
      columns={["Date", "Type", "Accounted", "Status"]}
      mapRow={(n) => [
        n.drill_date ? new Date(n.drill_date).toLocaleDateString() : "—",
        n.drill_type || "—",
        n.all_residents_accounted ? "✓ All" : "Partial",
        <Badge key={`s-${n.id}`} status={n.review_status || "pending"} />,
      ]}
      isMobile={isMobile}
    />
  );
}

// ─── CARE PLAN VIEW ───────────────────────────────────────────────────────────
function CarePlanView({ isMobile }) {
  const { auth } = useAuth();
  const api = useApi(auth);
  const router = useRouter();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!auth) return;
    setLoading(true);
    setError(null);
    api('/api/v1/care-plans?limit=100')
      .then(d => { setPlans(d.data || d.care_plans || []); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [auth, api]);

  const filtered = plans.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (p.resident_name || '').toLowerCase().includes(q) ||
      (p.plan_type || '').toLowerCase().includes(q);
  });

  const statusColor = (s) => ({
    active: C.green, draft: C.muted, expired: C.red, expiring: C.amber,
  }[s] || C.muted);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: C.navy }}>Care Plans</div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search resident or plan type..."
          style={{ ...inp, width: isMobile ? '100%' : 240 }}
        />
      </div>

      {loading ? (
        <EmptyState title="Loading..." desc="Fetching care plans" />
      ) : error ? (
        <EmptyState title="Error" desc={error} />
      ) : filtered.length === 0 ? (
        <EmptyState title="No Care Plans" desc={plans.length === 0 ? "No care plans found." : "No matches for that search."} />
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {filtered.map(p => (
            <div key={p.id} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 20px', borderLeft: `4px solid ${statusColor(p.status)}` }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: C.navy, marginBottom: 4 }}>{p.resident_name || '—'}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>
                    {p.plan_type || 'Care Plan'} · Effective: {p.effective_date ? new Date(p.effective_date).toLocaleDateString() : '—'}
                    {p.expiration_date && <> · Expires: {new Date(p.expiration_date).toLocaleDateString()}</>}
                  </div>
                  {p.primary_counselor_name && (
                    <div style={{ fontSize: 11, color: C.muted }}>Counselor: {p.primary_counselor_name}</div>
                  )}
                </div>
                <Badge status={p.status || 'draft'} />
              </div>
              {[p.goal1_statement, p.goal2_statement, p.goal3_statement].filter(Boolean).length > 0 && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Goals</div>
                  {[p.goal1_statement, p.goal2_statement, p.goal3_statement].filter(Boolean).map((g, i) => (
                    <div key={i} style={{ fontSize: 12, color: C.text, marginBottom: 4 }}>· {g}</div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── NOTIFICATIONS VIEW ────────────────────────────────────────────────────────
// ── Gmail-clean shared helpers ───────────────────────────────────────────────
function relTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60)     return "Just now";
  if (diff < 3600)   return `${Math.floor(diff / 60)}m`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
const rowIconBtn = {
  width: 30, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center",
  background: "transparent", border: "1px solid transparent", borderRadius: 7,
  color: "var(--staff-text-soft)", cursor: "pointer",
};
const inboxCard = {
  background: "var(--staff-paper)", border: "1px solid var(--staff-border)",
  borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 3px rgba(15,23,42,0.05)",
};

// Gmail-style notification row: bell avatar, unread rail + bold, hover mark-read.
function StaffNotifRow({ n, onMarkRead }) {
  const [hover, setHover] = useState(false);
  const unread = !n.is_read;
  const title  = n.title || n.subject || "—";
  const body   = n.message || n.body;
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => unread && onMarkRead(n.id)}
      style={{
        display: "flex", alignItems: "center", gap: 13, padding: "13px 16px 13px 17px",
        borderBottom: "1px solid var(--staff-border-soft)",
        background: hover ? "var(--staff-canvas)" : "var(--staff-paper)",
        boxShadow: hover ? "0 1px 3px rgba(15,23,42,0.08)" : "none",
        position: "relative", cursor: unread ? "pointer" : "default", transition: "background 0.12s ease",
      }}
    >
      {unread && <span aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: C.blue }} />}
      <div style={{ width: 38, height: 38, borderRadius: "50%", background: C.bluePale, color: C.blue, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Bell size={17} strokeWidth={1.9} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          {unread && <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", background: C.blue, flexShrink: 0 }} />}
          <span style={{ fontSize: 14, fontWeight: unread ? 700 : 500, color: C.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</span>
        </div>
        {body && <div style={{ fontSize: 12.5, color: unread ? C.text : C.muted, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{body}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>
        {hover && unread ? (
          <button
            onClick={(e) => { e.stopPropagation(); onMarkRead(n.id); }} title="Mark as read" aria-label="Mark as read" style={rowIconBtn}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--staff-paper)"; e.currentTarget.style.borderColor = "var(--staff-border)"; e.currentTarget.style.color = "var(--staff-accent)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.color = "var(--staff-text-soft)"; }}
          ><Check size={15} strokeWidth={2.2} /></button>
        ) : (
          <span style={{ fontSize: 11.5, color: C.muted, fontWeight: 600, whiteSpace: "nowrap", minWidth: 40, textAlign: "right", display: "inline-block" }}>{relTime(n.created_at)}</span>
        )}
      </div>
    </div>
  );
}

// Gmail-style announcement row (staff read-only): megaphone avatar, priority rail.
function StaffAnnouncementRow({ a }) {
  const [hover, setHover] = useState(false);
  const urgent = a.priority === "urgent", high = a.priority === "high", low = a.priority === "low";
  const tone = urgent || high
    ? { rail: C.red,  color: C.red,   tint: C.redBg }
    : low
      ? { rail: C.muted, color: C.muted, tint: "var(--staff-canvas)" }
      : { rail: C.blue, color: C.blue,  tint: C.bluePale };
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", gap: 13, padding: "14px 16px 14px 17px",
        borderBottom: "1px solid var(--staff-border-soft)",
        background: hover ? "var(--staff-canvas)" : "var(--staff-paper)",
        boxShadow: hover ? "0 1px 3px rgba(15,23,42,0.08)" : "none",
        position: "relative", transition: "background 0.12s ease",
      }}
    >
      <span aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: tone.rail }} />
      <div style={{ width: 38, height: 38, borderRadius: "50%", background: tone.tint, color: tone.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Megaphone size={17} strokeWidth={1.9} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 3, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, color: C.navy, fontSize: 14 }}>{a.title || "—"}</span>
          {(urgent || high) && <span style={{ background: tone.tint, color: tone.color, padding: "2px 9px", borderRadius: 999, fontSize: 10, fontWeight: 700, letterSpacing: "0.04em" }}>{a.priority.toUpperCase()}</span>}
        </div>
        {a.body && <div style={{ fontSize: 13, color: C.text, lineHeight: 1.55, marginBottom: 6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{a.body}</div>}
        <div style={{ fontSize: 11, color: C.muted }}>
          {a.published_at ? new Date(a.published_at).toLocaleDateString() : "—"}
          {a.author_first_name && <> · {a.author_first_name} {a.author_last_name}</>}
        </div>
      </div>
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
        <span style={{ fontSize: 11.5, color: C.muted, fontWeight: 600, whiteSpace: "nowrap" }}>{a.published_at ? relTime(a.published_at) : ""}</span>
      </div>
    </div>
  );
}

// Gmail-style appointment row: person avatar, status pill, hover Mark Complete.
function StaffApptRow({ a, onComplete }) {
  const [hover, setHover] = useState(false);
  const scheduledAt = a.scheduled_at ? new Date(a.scheduled_at) : null;
  const color = STAFF_APPT_TYPE_COLORS[a.appointment_type] || "#64748b";
  const isScheduled = a.status === "scheduled" || a.status === "confirmed";
  const done = a.status === "completed", cancelled = a.status === "cancelled";
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 13, padding: "13px 16px 13px 17px",
        borderBottom: "1px solid var(--staff-border-soft)",
        background: hover ? "var(--staff-canvas)" : "var(--staff-paper)",
        boxShadow: hover ? "0 1px 3px rgba(15,23,42,0.08)" : "none",
        position: "relative", transition: "background 0.12s ease",
      }}
    >
      <span aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: color }} />
      <Avatar name={`${a.first_name || ""} ${a.last_name || ""}`} size={38} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13.5, color: C.navy }}>{a.first_name} {a.last_name}</div>
        <div style={{ fontSize: 12.5, color: C.text, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.title || a.appointment_type || "—"}</div>
        <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>
          {scheduledAt ? scheduledAt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "—"}
          {scheduledAt ? ` · ${scheduledAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}` : ""}
          {a.location ? ` · ${a.location}` : ""}
        </div>
      </div>
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
        {hover && isScheduled && (
          <button
            onClick={() => onComplete(a.id)}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", background: C.greenBg, border: `1px solid ${C.green}`, borderRadius: 999, color: C.green, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
          ><Check size={13} strokeWidth={2.2} /> Complete</button>
        )}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 700, padding: "3px 10px 3px 8px", borderRadius: 999, background: done ? C.greenBg : cancelled ? "var(--staff-canvas)" : C.bluePale, color: done ? C.green : cancelled ? C.muted : C.blue, whiteSpace: "nowrap" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />
          {(a.status || "scheduled").replace(/_/g, " ").toUpperCase()}
        </span>
      </div>
    </div>
  );
}

function NotificationsView({ isMobile }) {
  const { auth } = useAuth();
  const api = useApi(auth);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });

  const fetchNotifications = useCallback(() => {
    if (!auth) return;
    setLoading(true);
    setError(null);
    api(`/api/v1/notifications?page=${page}&pageSize=20`)
      .then(d => {
        setNotifications(d.data || d.notifications || []);
        if (d.pagination) setPagination(d.pagination);
        setLoading(false);
      })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [auth, api, page]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const markRead = async (id) => {
    try {
      await fetch(`/api/v1/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${auth?.accessToken}` },
        credentials: 'same-origin',
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch { /* silent */ }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: C.navy }}>Notifications</div>
        {unreadCount > 0 && (
          <span style={{ background: C.bluePale, color: C.blue, padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
            {unreadCount} unread
          </span>
        )}
      </div>

      {loading ? (
        <EmptyState title="Loading..." desc="Fetching notifications" />
      ) : error ? (
        <EmptyState title="Error" desc={error} />
      ) : notifications.length === 0 ? (
        <EmptyState title="No Notifications" desc="You're all caught up — no new notifications." />
      ) : (
        <>
          <div style={inboxCard}>
            {notifications.map(n => (
              <StaffNotifRow key={n.id} n={n} onMarkRead={markRead} />
            ))}
          </div>

          {pagination.pages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 20 }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{ padding: '6px 14px', border: `1px solid ${C.border}`, borderRadius: 6, background: C.white, cursor: page === 1 ? 'default' : 'pointer', color: page === 1 ? C.muted : C.navy, fontSize: 12 }}
              >
                Prev
              </button>
              <span style={{ fontSize: 12, color: C.muted }}>Page {page} of {pagination.pages}</span>
              <button
                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                disabled={page === pagination.pages}
                style={{ padding: '6px 14px', border: `1px solid ${C.border}`, borderRadius: 6, background: C.white, cursor: page === pagination.pages ? 'default' : 'pointer', color: page === pagination.pages ? C.muted : C.navy, fontSize: 12 }}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── ANNOUNCEMENTS VIEW (STAFF READ-ONLY) ─────────────────────────────────────
function AnnouncementsView({ isMobile }) {
  const { auth } = useAuth();
  const api = useApi(auth);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!auth) return;
    setLoading(true);
    setError(null);
    api('/api/v1/announcements?limit=50')
      .then(d => { setAnnouncements(d.data || []); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [auth, api]);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: C.navy }}>Announcements</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>Notices from administration</div>
      </div>

      {loading ? (
        <EmptyState title="Loading..." desc="Fetching announcements" />
      ) : error ? (
        <EmptyState title="Error" desc={error} />
      ) : announcements.length === 0 ? (
        <EmptyState title="No Announcements" desc="No announcements have been posted yet." />
      ) : (
        <div style={inboxCard}>
          {announcements.map(a => (
            <StaffAnnouncementRow key={a.id} a={a} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── APPOINTMENTS VIEW (STAFF) ────────────────────────────────────────────────
// Staff see appointments for all residents (facility-wide policy).
const STAFF_APPT_TYPE_COLORS = {
  medical: C.blue, dental: "#0a7c4e", social: "#7c3aed", family: "#b45309", other: "#64748b",
};

function AppointmentsView({ isMobile }) {
  const { auth } = useAuth();
  const api = useApi(auth);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!auth) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ limit: '100' });
    if (filterStatus) params.set('status', filterStatus);
    api(`/api/v1/appointments?${params.toString()}`)
      .then(d => { setAppointments(d.data || []); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [auth, api, filterStatus]);

  const handleMarkComplete = async (id) => {
    try {
      await fetch(`/api/v1/appointments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth?.accessToken}` },
        credentials: 'same-origin',
        body: JSON.stringify({ status: 'completed' }),
      });
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'completed' } : a));
    } catch { /* silent */ }
  };

  const filtered = appointments.filter(a => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (a.first_name + ' ' + a.last_name).toLowerCase().includes(q) ||
      (a.title || '').toLowerCase().includes(q) ||
      (a.appointment_type || '').toLowerCase().includes(q);
  });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: C.navy }}>My Appointments</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search resident or title..."
            style={{ ...inp, width: isMobile ? '100%' : 200 }}
          />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inp, width: 140 }}>
            <option value="">All statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No Show</option>
          </select>
        </div>
      </div>

      {loading ? (
        <EmptyState title="Loading..." desc="Fetching appointments" />
      ) : error ? (
        <EmptyState title="Error" desc={error} />
      ) : filtered.length === 0 ? (
        <EmptyState title="No Appointments" desc={appointments.length === 0 ? "No appointments scheduled." : "No matches for that search."} />
      ) : (
        <div style={inboxCard}>
          {filtered.map(a => (
            <StaffApptRow key={a.id} a={a} onComplete={handleMarkComplete} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── CALENDAR VIEW (STAFF) ─────────────────────────────────────────────────────
function CalendarView({ isMobile }) {
  const { auth } = useAuth();
  const api = useApi(auth);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!auth) return;
    setLoading(true);
    api('/api/v1/appointments?limit=200')
      .then(d => { setAppointments(d.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [auth, api]);

  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel  = new Date(year, month, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
  const days        = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks      = Array.from({ length: firstDay });

  const isToday = d => d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const dayKey = (d) => `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const apptByDay = appointments.reduce((acc, a) => {
    if (!a.scheduled_at) return acc;
    const k = new Date(a.scheduled_at).toISOString().slice(0, 10);
    (acc[k] = acc[k] || []).push(a);
    return acc;
  }, {});

  function prev() { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); }
  function next() { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); }

  const selectedAppts = selected ? (apptByDay[dayKey(selected)] || []) : [];

  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: 15, color: C.navy, marginBottom: 16 }}>Calendar</div>
      {loading && <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>Loading appointments…</div>}

      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(15,23,42,0.05)' }}>
        <div style={{ padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 14, borderBottom: '1px solid var(--staff-border-soft)' }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.navy, minWidth: 178 }}>{monthLabel}</div>
          <button
            onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); setSelected(null); }}
            style={{ padding: '6px 15px', background: C.white, border: `1px solid ${C.border}`, borderRadius: 999, fontSize: 12.5, fontWeight: 600, color: C.text, cursor: 'pointer' }}
          >Today</button>
          <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
            <button onClick={prev} aria-label="Previous month" style={{ width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, cursor: 'pointer' }}><ChevronLeft size={17} strokeWidth={2} /></button>
            <button onClick={next} aria-label="Next month" style={{ width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, cursor: 'pointer' }}><ChevronRight size={17} strokeWidth={2} /></button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--staff-border-soft)' }}>
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
            <div key={d} style={{ padding: '9px 0 9px 10px', fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {blanks.map((_, i) => <div key={`b${i}`} style={{ minHeight: 100, borderRight: '1px solid var(--staff-border-soft)', borderBottom: '1px solid var(--staff-border-soft)', background: 'var(--staff-canvas)' }} />)}
          {days.map(d => {
            const sel = selected === d;
            const key = dayKey(d);
            const dayAppts = apptByDay[key] || [];
            const tdy = isToday(d);
            return (
              <div key={d} onClick={() => setSelected(sel ? null : d)}
                style={{ minHeight: 100, borderRight: '1px solid var(--staff-border-soft)', borderBottom: '1px solid var(--staff-border-soft)', padding: '6px 6px 8px', background: sel ? C.bluePale : C.white, cursor: 'pointer', transition: 'background 0.12s ease' }}
                onMouseEnter={e => { if (!sel) e.currentTarget.style.background = 'var(--staff-canvas)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = sel ? C.bluePale : C.white; }}
              >
                <div style={{ marginBottom: 5 }}>
                  <span style={{ width: 24, height: 24, borderRadius: '50%', background: tdy ? C.blue : 'transparent', color: tdy ? 'var(--staff-paper)' : C.text, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: tdy ? 700 : 500 }}>{d}</span>
                </div>
                {dayAppts.length > 0 && (
                  <div style={{ display: 'grid', gap: 3 }}>
                    {dayAppts.slice(0, 3).map((a, i) => {
                      const color = STAFF_APPT_TYPE_COLORS[a.appointment_type] || '#64748b';
                      const t = a.scheduled_at ? new Date(a.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
                      return (
                        <div key={i} title={`${a.first_name} ${a.last_name}`} style={{ display: 'flex', alignItems: 'center', gap: 5, background: color + '1A', borderRadius: 5, padding: '2px 6px', overflow: 'hidden' }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                          <span style={{ fontSize: 10.5, fontWeight: 600, color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t ? t + ' · ' : ''}{a.first_name} {a.last_name}</span>
                        </div>
                      );
                    })}
                    {dayAppts.length > 3 && <div style={{ fontSize: 10.5, fontWeight: 600, color: C.muted, paddingLeft: 4 }}>+{dayAppts.length - 3} more</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {selected && (
        <div style={{ marginTop: 14, background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 18px' }}>
          <div style={{ fontWeight: 700, color: C.navy, marginBottom: 10 }}>{monthLabel.split(' ')[0]} {selected}</div>
          {selectedAppts.length === 0 ? (
            <div style={{ fontSize: 13, color: C.muted }}>No appointments on this day.</div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {selectedAppts.map(a => {
                const scheduledAt = a.scheduled_at ? new Date(a.scheduled_at) : null;
                const color = STAFF_APPT_TYPE_COLORS[a.appointment_type] || '#64748b';
                return (
                  <div key={a.id} style={{ padding: '10px 14px', background: C.bg, borderRadius: 8, borderLeft: `3px solid ${color}` }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: C.navy }}>{a.first_name} {a.last_name}</div>
                    <div style={{ fontSize: 12, color: C.text }}>{a.title || a.appointment_type || '—'}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                      {scheduledAt ? scheduledAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''}
                      {a.location ? ` · ${a.location}` : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── FACE SHEET VIEW (STAFF, READ-ONLY) ───────────────────────────────────────
function FaceSheetView({ isMobile }) {
  const { auth } = useAuth();
  const api = useApi(auth);
  const [faceSheets, setFaceSheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!auth) return;
    setLoading(true);
    setError(null);
    api('/api/v1/face-sheets?limit=100')
      .then(d => { setFaceSheets(d.data || []); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [auth, api]);

  const sheet = faceSheets.find(f => f.id === selected);

  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: 15, color: C.navy, marginBottom: 16 }}>Face Sheets</div>
      {loading ? (
        <EmptyState title="Loading..." desc="Fetching face sheets" />
      ) : error ? (
        <EmptyState title="Error" desc={error} />
      ) : faceSheets.length === 0 ? (
        <EmptyState title="No Face Sheets" desc="No face sheets found." />
      ) : !sheet ? (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {faceSheets.map(f => (
            <div
              key={f.id}
              onClick={() => setSelected(f.id)}
              style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 18px', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = C.bluePale}
              onMouseLeave={e => e.currentTarget.style.background = C.white}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: C.blue, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--staff-paper)', flexShrink: 0 }}>
                  {(f.first_name?.[0] || '') + (f.last_name?.[0] || '')}
                </div>
                <div style={{ fontWeight: 700, color: C.navy, fontSize: 13 }}>{f.first_name} {f.last_name}</div>
              </div>
              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
                {f.form_data?.primary_name && <div>EC: {f.form_data.primary_name}</div>}
                {f.form_data?.pcp_name && <div>Dr: {f.form_data.pcp_name}</div>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div>
          <button
            onClick={() => setSelected(null)}
            style={{ marginBottom: 14, padding: '6px 14px', background: C.bluePale, border: `1px solid ${C.blueBorder}`, borderRadius: 6, color: C.blue, cursor: 'pointer', fontSize: 13 }}
          >
            All Residents
          </button>
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ background: C.navy, padding: '16px 22px' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--staff-paper)' }}>{sheet.first_name} {sheet.last_name}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 3 }}>Face Sheet — Read Only</div>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <FaceSheet
                residentId={sheet.resident_id}
                resident={{ first_name: sheet.first_name, last_name: sheet.last_name }}
                canEdit={false}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PROFILE VIEW ─────────────────────────────────────────────────────────────
function ProfileView({ staff, auth, isMobile }) {
  if (!staff && !auth?.user) return <EmptyState title="Loading..." desc="Fetching profile information" />;

  const user = staff || auth?.user || {};
  const displayName = [user.firstName || user.first_name, user.lastName || user.last_name].filter(Boolean).join(' ') || 'Staff Member';
  const email = user.email || auth?.user?.email || '—';
  const role = user.role || auth?.user?.role || 'staff';

  const fields = [
    { label: 'Full Name', value: displayName },
    { label: 'Email', value: email },
    { label: 'Role', value: role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) },
    { label: 'Status', value: 'Active' },
  ];

  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: 15, color: C.navy, marginBottom: 20 }}>My Profile</div>
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', maxWidth: 520 }}>
        <div style={{ background: C.navy, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: 'var(--staff-paper)' }}>
            {displayName.split(' ').map(word => word[0]).join('').toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--staff-paper)' }}>{displayName}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{role.replace(/_/g, ' ')}</div>
          </div>
        </div>
        <div style={{ padding: '20px 24px' }}>
          {fields.map(f => (
            <div key={f.label} style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, padding: '12px 0', gap: 16 }}>
              <div style={{ width: 140, fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>{f.label}</div>
              <div style={{ fontSize: 13, color: C.text }}>{f.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── DASHBOARD VIEW ───────────────────────────────────────────────────────────
function DashboardView({ staff, residents, pendingProgressNotes, isMobile, setView }) {
  if (!staff) return <EmptyState title="Loading..." desc="Fetching staff information" />;

  const residentCount = residents?.length || 0;
  const notesCount = pendingProgressNotes ?? 0;

  return (
    <div>
      <WelcomeSection
        staff={staff}
        pendingProgressNotes={pendingProgressNotes}
        setView={setView}
      />

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
        <StatCard label="Residents" value={residentCount} color={C.blue} />
        <StatCard label="Role" value={staff.role?.toUpperCase() || "STAFF"} color={C.green} />
        <StatCard label="Status" value="Active" color={C.teal} sub={new Date().toLocaleTimeString()} />
        <StatCard label="Pending Progress Notes" value={notesCount} color={notesCount > 0 ? C.red : C.green} />
      </div>

      <SH>Quick Access</SH>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 14 }}>
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20, cursor: "pointer", transition: "all 0.2s" }} onClick={() => setView('progress')} onMouseEnter={e => !isMobile && (e.currentTarget.style.boxShadow = "0 4px 12px rgba(15,45,94,0.1)")} onMouseLeave={e => !isMobile && (e.currentTarget.style.boxShadow = "none")}>
          <div style={{ fontSize: 16, marginBottom: 8 }}>Note</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>Progress Notes</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Log daily observations</div>
        </div>
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20, cursor: "pointer", transition: "all 0.2s" }} onClick={() => setView('incidents')} onMouseEnter={e => !isMobile && (e.currentTarget.style.boxShadow = "0 4px 12px rgba(15,45,94,0.1)")} onMouseLeave={e => !isMobile && (e.currentTarget.style.boxShadow = "none")}>
          <div style={{ fontSize: 16, marginBottom: 8 }}>Alert</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>Incident Report</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Document incidents</div>
        </div>
      </div>
    </div>
  );
}

// ─── RESIDENTS VIEW ────────────────────────────────────────────────────────────
function MyResidentsView({ residents, loading, isMobile }) {
  const [search, setSearch] = useState("");

  if (loading) return <EmptyState title="Loading..." desc="Fetching residents" />;
  if (!residents?.length) return <EmptyState title="No Residents" desc="No residents found" />;

  const filtered = residents.filter(r => {
    const full = `${r.first_name} ${r.last_name}`.toLowerCase();
    return full.includes(search.toLowerCase());
  });

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Search residents..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...inp, width: "100%", maxWidth: isMobile ? "100%" : "300px" }}
        />
      </div>
      <Table
        cols={["Name", "Primary Diagnosis", "Status"]}
        rows={filtered.map(r => [
          `${r.first_name} ${r.last_name}`,
          r.primary_diagnosis || "—",
          <Badge key={r.id} status={r.status || "active"} />
        ])}
      />
    </div>
  );
}

// ─── RESIDENT REQUESTS VIEW ───────────────────────────────────────────────────
function ResidentRequestsView({ isMobile }) {
  const { auth } = useAuth();
  const [list, setList]               = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [expanded, setExpanded]       = useState(null); // id of expanded row
  const [responseText, setResponseText] = useState('');
  const [newStatus, setNewStatus]     = useState('');
  const [saving, setSaving]           = useState(false);
  const [saveError, setSaveError]     = useState('');

  const fetchList = useCallback(async () => {
    if (!auth) return;
    setLoading(true);
    setError(null);
    try {
      const statusPart = statusFilter && statusFilter !== 'all' ? `&status=${statusFilter}` : '';
      const res = await fetch(`/api/v1/resident-requests?limit=100${statusPart}`, {
        headers: { Authorization: `Bearer ${auth.accessToken}` },
        credentials: 'same-origin',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      setList(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [auth, statusFilter]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const openExpand = (req) => {
    if (expanded === req.id) { setExpanded(null); return; }
    setExpanded(req.id);
    setResponseText(req.response || '');
    setNewStatus(req.status || 'pending');
    setSaveError('');
  };

  const handleSave = async (req) => {
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch(`/api/v1/resident-requests/${req.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.accessToken}` },
        credentials: 'same-origin',
        body: JSON.stringify({ status: newStatus, response: responseText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setExpanded(null);
      fetchList();
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const statusBadge = (s) => {
    const map = {
      pending:   { bg: C.amberBg, color: C.amber },
      approved:  { bg: C.greenBg, color: C.green },
      fulfilled: { bg: C.tealBg, color: C.teal },
      denied:    { bg: C.redBg, color: C.red },
    };
    const st = map[s] || { bg: '#f3f4f6', color: '#6b7280' };
    return <span style={{ background: st.bg, color: st.color, padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>{s || '—'}</span>;
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: C.navy, margin: 0 }}>Resident Requests</h2>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>Requests from residents</div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['pending', 'approved', 'fulfilled', 'all'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{
              padding: '5px 14px', border: `1px solid ${statusFilter === s ? C.blue : C.border}`,
              borderRadius: 20, fontSize: 12, fontWeight: statusFilter === s ? 700 : 400,
              background: statusFilter === s ? C.bluePale : C.white,
              color: statusFilter === s ? C.blue : C.muted, cursor: 'pointer', textTransform: 'capitalize',
            }}>{s}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <EmptyState title="Loading…" desc="Fetching resident requests" />
      ) : error ? (
        <div style={{ background: C.redBg, border: `1px solid ${C.red}`, borderRadius: 10, padding: '14px 18px', color: C.red, fontSize: 13 }}>Failed to load: {error}</div>
      ) : error ? (
        <ErrorNotification
          title="Failed to load requests"
          message={error}
          onDismiss={() => setError(null)}
          onRetry={() => fetchList()}
          isDismissible
        />
      ) : list.length === 0 ? (
        <EmptyState title="No resident requests" desc={`No ${statusFilter === 'all' ? '' : statusFilter + ' '}requests at this time.`} />
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {list.map(req => (
            <div key={req.id} style={{ background: C.white, border: `1px solid ${expanded === req.id ? C.blue : C.border}`, borderRadius: 10, overflow: 'hidden', transition: 'border-color 0.2s' }}>
              {/* Row header */}
              <div
                onClick={() => openExpand(req)}
                style={{ padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}
                onMouseEnter={e => { if (expanded !== req.id) e.currentTarget.style.background = C.bluePale; }}
                onMouseLeave={e => { e.currentTarget.style.background = ''; }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                    {statusBadge(req.status)}
                    {req.type && <span style={{ background: C.bluePale, color: C.blue, padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700 }}>{req.type}</span>}
                    {(req.priority === 'urgent' || req.priority === 'high') && (
                      <span style={{ background: C.redBg, color: C.red, padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700 }}>{req.priority?.toUpperCase()}</span>
                    )}
                  </div>
                  <div style={{ fontWeight: 700, color: C.navy, fontSize: 14, marginBottom: 2 }}>
                    {req.resident_name || `Resident #${req.resident_id}`}
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>
                    {req.details || req.description || '—'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, color: C.muted }}>{req.created_at ? new Date(req.created_at).toLocaleDateString() : '—'}</span>
                  <span style={{ fontSize: 14, color: C.muted, transform: expanded === req.id ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▾</span>
                </div>
              </div>

              {/* Expanded panel */}
              {expanded === req.id && (
                <div style={{ borderTop: `1px solid ${C.border}`, padding: '16px', background: C.bg }}>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Full Request</div>
                    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.text, lineHeight: 1.6 }}>
                      {req.details || req.description || '—'}
                    </div>
                  </div>

                  {req.responded_by && (
                    <div style={{ marginBottom: 12, padding: '8px 12px', background: C.greenBg, border: `1px solid ${C.green}40`, borderRadius: 8, fontSize: 12, color: C.green }}>
                      Responded by {req.responded_by_name || req.responded_by}
                      {req.responded_at && ` on ${new Date(req.responded_at).toLocaleDateString()}`}
                    </div>
                  )}

                  <div style={{ marginBottom: 12 }}>
                    <label style={lbl}>Status</label>
                    <select
                      value={newStatus}
                      onChange={e => setNewStatus(e.target.value)}
                      style={{ ...inp, appearance: 'none' }}
                    >
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="fulfilled">Fulfilled</option>
                      {/* denied is admin-only */}
                    </select>
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <label style={lbl}>Response / Notes</label>
                    <textarea
                      value={responseText}
                      onChange={e => setResponseText(e.target.value)}
                      placeholder="Enter your response or notes…"
                      rows={3}
                      style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }}
                    />
                  </div>

                  {saveError && <div style={{ marginBottom: 10, color: C.red, fontSize: 13 }}>{saveError}</div>}

                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={() => setExpanded(null)} style={{ padding: '7px 16px', background: C.white, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 12, cursor: 'pointer', color: C.muted }}>Cancel</button>
                    <button onClick={() => handleSave(req)} disabled={saving} style={{ padding: '7px 18px', background: C.navy, border: 'none', borderRadius: 7, color: 'var(--staff-paper)', fontWeight: 700, fontSize: 12, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                      {saving ? 'Saving…' : 'Save Response'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── HOOK ─────────────────────────────────────────────────────────────────────
function useApi(auth) {
  return useCallback(async (path, opts = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(auth?.accessToken && { 'Authorization': `Bearer ${auth.accessToken}` })
    };
    try {
      const response = await fetch(path, { ...opts, headers, credentials: 'same-origin' });
      const data = await response.json();
      if (!response.ok) {
        throw new APIError(data.error || `Request failed (${response.status})`, response.status);
      }
      return data;
    } catch (err) {
      if (err instanceof APIError) throw err;
      throw new APIError(err.message || 'Network request failed', 0, err);
    }
  }, [auth?.accessToken]);
}

function useViewFetch() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async (fetchFn) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn();
      setData(result);
    } catch (err) {
      const parsed = parseAPIError(err);
      setError(parsed);
    } finally {
      setLoading(false);
    }
  }, []);

  const retry = useCallback((fetchFn) => fetch(fetchFn), [fetch]);
  const dismiss = useCallback(() => setError(null), []);

  return { data, loading, error, fetch, retry, dismiss, setData };
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function StaffPage() {
  const { auth, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const api = useApi(auth);
  const [view, setView] = useState("dashboard");
  const [staff, setStaff] = useState(null);
  const [residents, setResidents] = useState([]);
  const [pendingProgressNotes, setPendingProgressNotes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (!auth) {
        router.replace("/");
      } else if (!["staff", "manager", "admin", "superadmin"].includes(auth.user?.role)) {
        router.replace("/");
      }
    }
  }, [auth, authLoading, router]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (auth) {
      setLoading(true);
      api("/api/v1/auth/me").then(d => {
        setStaff(d.user);
        Promise.all([
          // Facility-wide policy: every staff member is responsible for all
          // residents, so load the full roster rather than personal assignments.
          api("/api/v1/residents?limit=100").catch(() => ({ data: [] })),
          api("/api/v1/daily-progress-notes/pending").catch(() => ({ data: [], total_pending: 0 })),
        ]).then(([residentsRes, pendingRes]) => {
          setResidents(residentsRes.data || []);
          setPendingProgressNotes(pendingRes.total_pending ?? (pendingRes.data?.length || 0));
          setLoading(false);
        }).catch(() => setLoading(false));
      }).catch(() => setLoading(false));
    }
  }, [auth, api]);

  if (authLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "var(--staff-text-soft)", background: "var(--staff-canvas)" }}>
        Loading…
      </div>
    );
  }
  if (!auth) return null;

  const displayName = auth.user?.firstName
    ? `${auth.user.firstName} ${auth.user.lastName || ""}`.trim()
    : "Staff";
  const initials = [auth.user?.firstName?.[0], auth.user?.lastName?.[0]].filter(Boolean).join("").toUpperCase() || "S";

  const sidebarBadges = {
    progress: Number(pendingProgressNotes ?? 0),
  };
  const totalAlerts = Number(pendingProgressNotes ?? 0);

  const pages = {
    dashboard: <DashboardView staff={staff} residents={residents} pendingProgressNotes={pendingProgressNotes} isMobile={isMobile} setView={setView} />,
    residents: <MyResidentsView residents={residents} loading={loading} isMobile={isMobile} />,
    "care-plan": <CarePlanView isMobile={isMobile} />,
    progress: <PendingProgressNotesView isMobile={isMobile} />,
    medications: <MedicationsView isMobile={isMobile} />,
    incidents: <IncidentReportsView isMobile={isMobile} />,
    disposal: <DrugDisposalView isMobile={isMobile} />,
    evacuation: <EvacuationDrillsView isMobile={isMobile} />,
    announcements: <AnnouncementsView isMobile={isMobile} />,
    appointments: <AppointmentsView isMobile={isMobile} />,
    notifications: <NotificationsView isMobile={isMobile} />,
    calendar: <CalendarView isMobile={isMobile} />,
    "face-sheet": <FaceSheetView isMobile={isMobile} />,
    "resident-requests": <ResidentRequestsView isMobile={isMobile} />,
    profile: <ProfileView staff={staff} auth={auth} isMobile={isMobile} />,
  };

  return (
    <StaffShell
      view={view}
      setView={setView}
      displayName={displayName}
      initials={initials}
      role={auth.user?.role}
      logout={logout}
      residents={residents}
      sidebarBadges={sidebarBadges}
      totalAlerts={totalAlerts}
      isMobile={isMobile}
    >
      {pages[view]}
    </StaffShell>
  );
}

// ─── STAFF SHELL — topbar + sidebar + main column (mirrors AdminShell) ───────
function StaffShell({ view, setView, displayName, initials, role, logout, residents, sidebarBadges, totalAlerts, isMobile, children }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const searchRef = useRef(null);
  const profileRef = useRef(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('staff:sidebarCollapsed');
      if (saved === '1') setSidebarCollapsed(true);
    } catch {}
  }, []);
  const handleCollapsedChange = useCallback((next) => {
    setSidebarCollapsed(next);
    try { localStorage.setItem('staff:sidebarCollapsed', next ? '1' : '0'); } catch {}
  }, []);

  useEffect(() => {
    function onClick(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => document.getElementById('staff-resident-search')?.focus(), 0);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setProfileOpen(false);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const filteredResidents = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return residents
      .filter((r) => `${r.first_name} ${r.last_name}`.toLowerCase().includes(q) || (r.primary_diagnosis || '').toLowerCase().includes(q))
      .slice(0, 6);
  }, [residents, searchQuery]);

  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: 'var(--staff-canvas)',
        color: 'var(--staff-text)',
        fontFamily: 'var(--font-geist-sans), -apple-system, system-ui, sans-serif',
      }}
    >
      <StaffNavigation
        currentView={view}
        onViewChange={setView}
        badges={sidebarBadges}
        mobileOpen={mobileNavOpen}
        onMobileOpenChange={setMobileNavOpen}
        collapsed={sidebarCollapsed}
        onCollapsedChange={handleCollapsedChange}
      />

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header
          data-testid="staff-topnav"
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 60,
            background: 'rgba(242, 245, 240, 0.88)',
            backdropFilter: 'saturate(180%) blur(14px)',
            WebkitBackdropFilter: 'saturate(180%) blur(14px)',
            borderBottom: '1px solid var(--staff-border-soft)',
            padding: isMobile ? '10px 12px' : '14px 28px',
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? 8 : 16,
          }}
        >
          {isMobile && (
            <StaffMenuButton open={mobileNavOpen} onClick={() => setMobileNavOpen((v) => !v)} />
          )}

          <div ref={searchRef} style={{ position: 'relative', flex: 1, minWidth: 0, maxWidth: isMobile ? '100%' : 460 }}>
            <div
              onClick={() => {
                setSearchOpen(true);
                setTimeout(() => document.getElementById('staff-resident-search')?.focus(), 0);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: 'var(--staff-paper)',
                border: '1px solid var(--staff-border)',
                borderRadius: 10,
                padding: isMobile ? '8px 12px' : '9px 14px',
                cursor: 'text',
                transition: 'border-color 0.18s ease, box-shadow 0.18s ease',
                ...(searchOpen ? { borderColor: 'var(--staff-accent)', boxShadow: 'var(--staff-focus)' } : null),
              }}
            >
              <Search size={15} strokeWidth={1.85} style={{ color: 'var(--staff-text-muted)', flexShrink: 0 }} />
              <input
                id="staff-resident-search"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                onFocus={() => setSearchOpen(true)}
                placeholder={isMobile ? 'Search residents…' : 'Search residents or jump to a page…'}
                aria-label="Search residents"
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontSize: 13.5,
                  color: 'var(--staff-text)',
                  fontFamily: 'inherit',
                  minWidth: 0,
                }}
              />
              {!isMobile && (
                <kbd
                  aria-hidden="true"
                  style={{
                    fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
                    fontSize: 10.5,
                    color: 'var(--staff-text-muted)',
                    background: 'var(--staff-canvas)',
                    border: '1px solid var(--staff-border)',
                    borderRadius: 5,
                    padding: '1px 6px',
                    flexShrink: 0,
                  }}
                >
                  ⌘K
                </kbd>
              )}
            </div>

            {searchOpen && searchQuery.trim() && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  right: 0,
                  background: 'var(--staff-paper)',
                  border: '1px solid var(--staff-border)',
                  borderRadius: 12,
                  boxShadow: '0 18px 48px rgba(14,42,34,0.12)',
                  overflow: 'hidden',
                  zIndex: 70,
                  animation: 'admin-fade-up 0.18s ease both',
                }}
              >
                {filteredResidents.length === 0 ? (
                  <div style={{ padding: '14px 16px', fontSize: 13, color: 'var(--staff-text-soft)' }}>
                    No residents match “{searchQuery}”.
                  </div>
                ) : (
                  <div style={{ padding: 6 }}>
                    <div style={{ fontSize: 10, color: 'var(--staff-text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600, padding: '8px 10px 4px' }}>
                      Residents
                    </div>
                    {filteredResidents.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => { setView('residents'); setSearchOpen(false); setSearchQuery(''); }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          width: '100%',
                          padding: '9px 10px',
                          background: 'transparent',
                          border: 'none',
                          borderRadius: 8,
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontFamily: 'inherit',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--staff-canvas)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <Avatar name={`${r.first_name || ''} ${r.last_name || ''}`} size={30} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--staff-text)' }}>{r.first_name} {r.last_name}</div>
                          {r.primary_diagnosis && (
                            <div style={{ fontSize: 11, color: 'var(--staff-text-soft)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {r.primary_diagnosis}
                            </div>
                          )}
                        </div>
                        <ChevronRight size={14} strokeWidth={1.75} style={{ color: 'var(--staff-text-muted)' }} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
            {!isMobile && (
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--staff-text-soft)',
                  fontWeight: 500,
                  padding: '7px 12px',
                  background: 'var(--staff-paper)',
                  border: '1px solid var(--staff-border)',
                  borderRadius: 9,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                }}
              >
                <Calendar size={13} strokeWidth={1.85} style={{ color: 'var(--staff-text-muted)' }} />
                {dateStr}
              </div>
            )}

            <button
              onClick={() => setView('notifications')}
              aria-label={totalAlerts > 0 ? `Notifications, ${totalAlerts} pending` : 'Notifications'}
              style={{
                position: 'relative',
                width: 38,
                height: 38,
                background: view === 'notifications' ? 'var(--staff-ink)' : 'var(--staff-paper)',
                color: view === 'notifications' ? 'var(--staff-paper)' : 'var(--staff-text)',
                border: '1px solid var(--staff-border)',
                borderRadius: 9,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Bell size={16} strokeWidth={1.85} />
              {totalAlerts > 0 && (
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    top: 7,
                    right: 7,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: 'var(--staff-accent)',
                    animation: 'admin-pulse-dot 1.8s ease-in-out infinite',
                  }}
                />
              )}
            </button>

            <div ref={profileRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setProfileOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: isMobile ? 4 : '4px 10px 4px 4px',
                  background: 'var(--staff-paper)',
                  border: '1px solid var(--staff-border)',
                  borderRadius: 999,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <span
                  style={{
                    width: 30, height: 30, borderRadius: '50%',
                    background: 'var(--staff-ink)',
                    color: 'var(--staff-paper)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                  }}
                >
                  {initials}
                </span>
                {!isMobile && (
                  <span style={{ lineHeight: 1.15, textAlign: 'left' }}>
                    <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--staff-text)' }}>{displayName}</span>
                    <span style={{ display: 'block', fontSize: 10.5, color: 'var(--staff-text-soft)', textTransform: 'capitalize', marginTop: 1 }}>{role?.replace(/_/g, ' ') || 'Staff'}</span>
                  </span>
                )}
              </button>

              {profileOpen && (
                <div
                  role="menu"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    background: 'var(--staff-paper)',
                    border: '1px solid var(--staff-border)',
                    borderRadius: 12,
                    boxShadow: '0 18px 48px rgba(14,42,34,0.12)',
                    padding: 6,
                    minWidth: 200,
                    zIndex: 70,
                    animation: 'admin-fade-up 0.18s ease both',
                  }}
                >
                  <div style={{ padding: '8px 10px 6px' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--staff-text)' }}>{displayName}</div>
                    <div style={{ fontSize: 11, color: 'var(--staff-text-soft)', marginTop: 2 }}>Signed in</div>
                  </div>
                  <div style={{ borderTop: '1px solid var(--staff-border-soft)', margin: '4px 2px' }} />
                  <button
                    onClick={() => { setView('profile'); setProfileOpen(false); }}
                    style={shellMenuItemStyle}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--staff-canvas)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <UserCircle2 size={14} strokeWidth={1.85} />
                    My Profile
                  </button>
                  <button
                    onClick={logout}
                    style={{ ...shellMenuItemStyle, color: 'var(--staff-danger)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--staff-danger-bg)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <LogOut size={14} strokeWidth={1.85} />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main
          style={{
            flex: 1,
            padding: isMobile ? '20px 16px 40px' : '32px 36px 56px',
            minWidth: 0,
            maxWidth: 1320,
            margin: '0 auto',
            width: '100%',
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

const shellMenuItemStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 9,
  width: '100%',
  padding: '8px 10px',
  background: 'transparent',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  color: 'var(--staff-text)',
  fontSize: 12.5,
  fontWeight: 500,
  textAlign: 'left',
  fontFamily: 'inherit',
};
