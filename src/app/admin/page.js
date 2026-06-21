'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { downloadProgressNotesPDF } from '@/lib/progress-notes-pdf';
import {
  Search, Bell, LogOut, X, ChevronRight, Plus,
  Users, UserCog, ClipboardList, FileText, CalendarDays,
  Pill, NotebookPen, AlertTriangle, Trash2, DoorOpen,
  Megaphone, Inbox, Sparkles, Calendar, KeyRound,
  ArrowUpRight, CircleAlert, ShieldCheck, Scroll, ScrollText, Download,
  Check, Archive, ChevronLeft, Pencil, Mail,
} from 'lucide-react';
import { PendingAdmissionsSection } from './PendingAdmissionsSection';
import { AdminNavigation, MobileMenuButton } from './AdminNavigation';
import FaceSheet from '@/app/components/FaceSheet';

// ─── THEME (shim mapping to --admin-* tokens) ────────────────────────────────
// Sections in this file reference `C.navy`, `C.green`, etc. We keep the shape
// but route everything through admin CSS variables so the editorial-clinical
// theme stays consistent. Keys without a matching token keep their hex value.
const C = {
  navy:          "var(--admin-text)",
  navyMid:       "#2d3e52",
  emerald:       "var(--admin-accent)",
  emeraldPale:   "var(--admin-accent-soft)",
  emeraldBorder: "var(--admin-approved-bg)",
  white:         "var(--admin-paper)",
  bg:            "var(--admin-canvas)",
  text:          "var(--admin-text)",
  muted:         "var(--admin-text-soft)",
  border:        "var(--admin-border)",

  // State colors
  green:      "var(--admin-success)",   greenBg:     "var(--admin-success-bg)",
  approved:   "var(--admin-approved)",  approvedBg:  "var(--admin-approved-bg)",
  rejected:   "var(--admin-rejected)",  rejectedBg:  "var(--admin-rejected-bg)",
  amber:      "var(--admin-warning)",   amberBg:     "var(--admin-warning-bg)",
  pink:       "var(--admin-pending)",   pinkBg:      "var(--admin-pending-bg)",
  teal:       "#0d9488",                tealBg:      "#ccfbf1",
  cyan:       "var(--admin-info)",      cyanBg:      "var(--admin-info-bg)",
  blue:       "#2563EB",  bluePale:    "#EFF4FF",  blueBorder:  "#BFD4FE",
  gold:       "#b45309",                purple:      "#6d28d9", purpleBg: "#f5f3ff",
  red:        "var(--admin-danger)",    redBg:       "var(--admin-danger-bg)",
  draft:      "var(--admin-draft)",     draftBg:     "var(--admin-draft-bg)",
  cancelled:  "var(--admin-cancelled)", cancelledBg: "var(--admin-cancelled-bg)",
};

// ─── LIFE DOMAINS ────────────────────────────────────────────────────────────
const LIFE_DOMAINS = [
  { id: 1, label: "Peer Support" },
  { id: 2, label: "Personal Goals" },
  { id: 3, label: "Mental Health" },
  { id: 4, label: "Safety" },
  { id: 5, label: "Medical" },
  { id: 6, label: "Living Situation" },
  { id: 7, label: "Healthy Living" },
  { id: 8, label: "Financial/Legal Status" },
  { id: 9, label: "Social, Cultural, Spiritual" },
  { id: 10, label: "Natural/Family Support" },
  { id: 11, label: "Community Participation" },
  { id: 12, label: "Employment/Education" },
];

// ─── SHARED UI — Professional typography & spacing ──────────────────────────
const inp = {
  width: "100%",
  padding: "12px 14px",
  height: 40,
  border: "1px solid var(--admin-border)",
  borderRadius: 8,
  fontSize: 14,
  background: "var(--admin-paper)",
  color: "var(--admin-text)",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
  fontWeight: 500,
  transition: "all 0.2s ease",
  boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
};
const lbl = {
  display: "block",
  fontSize: 12,
  fontWeight: 700,
  color: "var(--admin-text)",
  marginBottom: 8,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};
const secHead = {
  fontFamily: "var(--font-fraunces), Georgia, serif",
  fontSize: 17,
  fontWeight: 500,
  color: "var(--admin-text)",
  letterSpacing: "-0.015em",
  paddingBottom: 12,
  marginBottom: 18,
  marginTop: 32,
  borderBottom: "2px solid var(--admin-border-soft)",
};
const inputFocusHandlers = {
  onFocus: (e) => {
    e.target.style.borderColor = "var(--admin-accent)";
    e.target.style.boxShadow = "0 1px 3px rgba(15,23,42,0.08), var(--admin-focus)";
  },
  onBlur:  (e) => {
    e.target.style.borderColor = "var(--admin-border)";
    e.target.style.boxShadow = "0 1px 2px rgba(15,23,42,0.04)";
  },
};

function F({ label, required, children, span = 1 }) {
  return (
    <div style={{ gridColumn: `span ${span}` }}>
      {label && (
        <label style={lbl}>
          {label}
          {required && <span aria-hidden="true" style={{ color: "var(--admin-danger)", marginLeft: 4 }}>●</span>}
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
        background: readOnly ? "var(--admin-canvas)" : "var(--admin-paper)",
        color: readOnly ? "var(--admin-text-soft)" : "var(--admin-text)",
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
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 12px center",
        paddingRight: 34,
      }}
    >
      <option value="">— Select —</option>
      {options.map((o) => (
        <option key={o.value ?? o} value={o.value ?? o}>
          {o.label ?? o}
        </option>
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
function RG({ label, options, value, onChange }) {
  return (
    <div>
      {label && <div style={{ ...lbl, marginBottom: 8 }}>{label}</div>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 18px" }}>
        {options.map((o) => {
          const v = o.value ?? o, l = o.label ?? o, ch = value === v;
          return (
            <label
              key={String(v)}
              onClick={() => onChange(v)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                color: "var(--admin-text)",
                cursor: "pointer",
                padding: "6px 12px",
                borderRadius: 999,
                border: `1px solid ${ch ? "var(--admin-text)" : "var(--admin-border)"}`,
                background: ch ? "var(--admin-text)" : "var(--admin-paper)",
                color: ch ? "var(--admin-paper)" : "var(--admin-text)",
                transition: "all 0.14s ease",
              }}
            >
              <span
                style={{
                  width: 12, height: 12, borderRadius: "50%",
                  border: `1.5px solid ${ch ? "rgba(255,255,255,0.8)" : "var(--admin-border)"}`,
                  background: ch ? "var(--admin-paper)" : "transparent",
                  display: "inline-block",
                  flexShrink: 0,
                }}
                aria-hidden="true"
              />
              {l}
            </label>
          );
        })}
      </div>
    </div>
  );
}
function Grid({ cols = 2, children }) {
  return (
    <div className="admin-form-grid" style={{ "--cols": cols }}>
      {children}
    </div>
  );
}
function SH({ children }) { return <div style={secHead}>{children}</div>; }
function InfoBox({ tone = "info", children }) {
  const t = STATE_TONES[tone] ?? STATE_TONES.info;
  return (
    <div style={{
      background: t.bg,
      border: `1px solid ${t.bd}`,
      borderRadius: 12,
      padding: "12px 16px",
      fontSize: 13,
      color: t.fg,
      marginBottom: 16,
      lineHeight: 1.55,
      display: "flex",
      gap: 10,
      boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
      transition: "all 0.18s ease",
    }}>
      <CircleAlert size={16} strokeWidth={1.8} style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, color: "var(--admin-text)" }}>{children}</div>
    </div>
  );
}
function AutoField({ label, value }) {
  return (
    <div>
      {label && <div style={{ ...lbl, marginBottom: 6 }}>{label}</div>}
      <div style={{
        ...inp,
        background: "var(--admin-canvas)",
        color: "var(--admin-text)",
        fontWeight: 500,
        display: "flex", alignItems: "center", gap: 8,
        cursor: "default",
      }}>
        <span style={{
          fontSize: 9,
          background: "var(--admin-ink)",
          color: "var(--admin-paper)",
          padding: "2px 6px",
          borderRadius: 4,
          fontWeight: 700,
          letterSpacing: "0.08em",
        }}>
          AUTO
        </span>
        <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value || "—"}</span>
      </div>
    </div>
  );
}

// ─── STATUS BADGE — comprehensive state colors ───────────────────────────────
const BADGE_STATUS = {
  // Approval/Decision states
  "Approved":          { dot: "#047857", text: "var(--admin-approved)" },
  "Approved by":       { dot: "#047857", text: "var(--admin-approved)" },
  "Rejected":          { dot: "#DC2626", text: "var(--admin-rejected)" },
  "Denied":            { dot: "#DC2626", text: "var(--admin-rejected)" },
  "Cancelled":         { dot: "#78716C", text: "var(--admin-cancelled)" },

  // Review states
  "Pending Review":       { dot: "#F29339", text: "var(--admin-warning)" },
  "Pending Witness":      { dot: "#F29339", text: "var(--admin-warning)" },
  "Pending Disposal":     { dot: "#EC407A", text: "var(--admin-pending)"  },
  "Pending Confirmation": { dot: "#F29339", text: "var(--admin-warning)" },
  "Pending":              { dot: "#EC407A", text: "var(--admin-pending)" },

  // Completion states
  "Closed":               { dot: "#9CA8B4", text: "var(--admin-text-muted)" },
  "Complete":             { dot: "#059669", text: "var(--admin-success)" },
  "Completed":            { dot: "#059669", text: "var(--admin-success)" },
  "Finished":             { dot: "#059669", text: "var(--admin-success)" },
  "Sent":                 { dot: "#059669", text: "var(--admin-success)" },
  "Submitted":            { dot: "#0891B2", text: "var(--admin-info)" },

  // Work status
  "In Progress":          { dot: "#F29339", text: "var(--admin-warning)" },
  "In Review":            { dot: "#F29339", text: "var(--admin-warning)" },
  "Draft":                { dot: "#6B7280", text: "var(--admin-draft)" },
  "Scheduled":            { dot: "#0891B2", text: "var(--admin-info)" },

  // Priority
  "High":   { dot: "#DC2626", text: "var(--admin-danger)"  },
  "Medium": { dot: "#F29339", text: "var(--admin-warning)" },
  "Low":    { dot: "#059669", text: "var(--admin-success)" },
  "Normal": { dot: "#059669", text: "var(--admin-accent)" },
  "Critical": { dot: "#DC2626", text: "var(--admin-danger)" },

  // Activation
  "active":      { dot: "#059669", text: "var(--admin-success)" },
  "inactive":    { dot: "#EC407A", text: "var(--admin-pending)" },
  "enabled":     { dot: "#059669", text: "var(--admin-success)" },
  "disabled":    { dot: "#6B7280", text: "var(--admin-draft)" },
  "deactivated": { dot: "#EC407A", text: "var(--admin-pending)" },

  // Legal status
  "voluntary":         { dot: "#0891B2", text: "var(--admin-info)" },
  "civil_commitment":  { dot: "#F29339", text: "var(--admin-warning)" },
  "guardianship":      { dot: "#7C3AED", text: "#5B21B6" },

  // Form states
  "no_show": { dot: "#6B7280", text: "var(--admin-draft)" },
  "arrived": { dot: "#059669", text: "var(--admin-success)" },
};

// ─── STATE TONE MAPPING — For alert boxes and styled components ─────────────
const STATE_TONES = {
  approved:  { fg: "var(--admin-approved)",  bg: "var(--admin-approved-bg)",  bd: "rgba(4,120,87,0.18)" },
  rejected:  { fg: "var(--admin-rejected)",  bg: "var(--admin-rejected-bg)",  bd: "rgba(220,38,38,0.18)" },
  success:   { fg: "var(--admin-success)",   bg: "var(--admin-success-bg)",   bd: "rgba(5,150,105,0.18)" },
  warning:   { fg: "var(--admin-warning)",   bg: "var(--admin-warning-bg)",   bd: "rgba(242,147,57,0.18)" },
  pending:   { fg: "var(--admin-pending)",   bg: "var(--admin-pending-bg)",   bd: "rgba(236,64,122,0.18)" },
  danger:    { fg: "var(--admin-danger)",    bg: "var(--admin-danger-bg)",    bd: "rgba(220,38,38,0.18)" },
  info:      { fg: "var(--admin-info)",      bg: "var(--admin-info-bg)",      bd: "rgba(8,145,178,0.18)" },
  draft:     { fg: "var(--admin-draft)",     bg: "var(--admin-draft-bg)",     bd: "rgba(107,114,128,0.18)" },
  cancelled: { fg: "var(--admin-cancelled)", bg: "var(--admin-cancelled-bg)", bd: "rgba(120,113,108,0.18)" },
};
function Badge({ status, size = "md" }) {
  const s = BADGE_STATUS[status] || { dot: "#CBD5E1", text: "var(--admin-text-soft)" };
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

// ─── AVATAR — monogram with hash-tinted background ───────────────────────────
function nameHue(name = "") {
  let h = 0;
  const s = String(name || "");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  // 8 evenly spaced clinical hues (skips harsh red/pure yellow)
  const buckets = [200, 175, 150, 105, 40, 25, 280, 220];
  return buckets[h % buckets.length];
}
function Avatar({ name, size = 36, role }) {
  const initials = (name || "?")
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const hue = nameHue(name);
  // Resident vs staff — keep both subtle, staff slightly cooler
  const sat = role ? 22 : 28;
  const light = role ? 78 : 82;
  const fontSize = Math.round(size * 0.36);
  return (
    <span
      aria-hidden="true"
      style={{
        width: size, height: size,
        borderRadius: "50%",
        background: `hsl(${hue}, ${sat}%, ${light}%)`,
        color: "var(--admin-ink)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize,
        fontWeight: 600,
        letterSpacing: "0.02em",
        flexShrink: 0,
        boxShadow: "inset 0 0 0 1px rgba(15,23,42,0.06)",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
      }}
    >
      {initials || "?"}
    </span>
  );
}

// ─── CREDENTIAL FIELD — copyable mono value (used after creating staff) ─────
function CredentialField({ label, value, copied, onCopy }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10.5, color: "var(--admin-text-muted)", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <code
          style={{
            fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
            fontSize: 12.5,
            fontWeight: 600,
            color: "var(--admin-text)",
            background: "var(--admin-paper)",
            border: "1px solid var(--admin-border)",
            borderRadius: 7,
            padding: "7px 10px",
            flex: 1,
            wordBreak: "break-all",
            minWidth: 0,
          }}
        >
          {value}
        </code>
        <button
          onClick={onCopy}
          style={{
            background: copied ? "var(--admin-ink)" : "var(--admin-paper)",
            color: copied ? "var(--admin-paper)" : "var(--admin-text)",
            border: `1px solid ${copied ? "var(--admin-ink)" : "var(--admin-border)"}`,
            borderRadius: 7,
            padding: "7px 11px",
            fontSize: 11.5,
            fontWeight: 600,
            cursor: "pointer",
            whiteSpace: "nowrap",
            fontFamily: "inherit",
            transition: "background 0.14s ease",
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

// ─── DETAIL FIELD — small inline label/value pair for detail panels ─────────
function DetailField({ label, value }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <span style={{ fontSize: 10.5, color: "var(--admin-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 13, color: "var(--admin-text)", fontWeight: 500, wordBreak: "break-word" }}>{value || <span style={{ color: "var(--admin-text-muted)" }}>—</span>}</span>
    </div>
  );
}

// ─── PERSON ROW — used by Residents & Staff lists ────────────────────────────
function PersonRow({ name, avatarName, secondary, meta = [], status, onClick, role, onChevronClick, chevronLabel }) {
  // Track narrow container via a resize observer on the row's parent
  const rowRef = useRef(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    if (!rowRef.current) return;
    const el = rowRef.current;
    const ro = new ResizeObserver(([entry]) => {
      setNarrow(entry.contentRect.width < 640);
    });
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
        gridTemplateAreas: narrow
          ? `"avatar primary status" "avatar meta meta"`
          : undefined,
        alignItems: "center",
        gap: narrow ? "4px 14px" : "0 16px",
        padding: narrow ? "14px 16px" : "14px 18px",
        borderBottom: "1px solid var(--admin-border-soft)",
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
      onMouseEnter={(e) => onClick && (e.currentTarget.style.background = "rgba(15,23,42,0.025)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <span style={{ gridArea: narrow ? "avatar" : undefined }}>
        <Avatar name={avatarName || (typeof name === "string" ? name : "?")} size={narrow ? 38 : 40} role={role} />
      </span>

      <span style={{ minWidth: 0, gridArea: narrow ? "primary" : undefined }}>
        <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--admin-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {name}
        </span>
        {secondary && (
          <span style={{ display: "block", fontSize: 12, color: "var(--admin-text-soft)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {secondary}
          </span>
        )}
      </span>

      {narrow ? (
        <span style={{ gridArea: "meta", display: "flex", flexWrap: "wrap", gap: "4px 12px", paddingTop: 4 }}>
          {meta.map((m, i) => (
            <span key={i} style={{ fontSize: 11.5, color: "var(--admin-text-soft)", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span style={{ color: "var(--admin-text-muted)" }}>{m.label}:</span>
              {m.value || <span style={{ color: "var(--admin-text-muted)" }}>—</span>}
            </span>
          ))}
        </span>
      ) : (
        meta.map((m, i) => (
          <span key={i} style={{ fontSize: 12.5, color: "var(--admin-text-soft)", minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {m.value || <span style={{ color: "var(--admin-text-muted)" }}>—</span>}
          </span>
        ))
      )}

      <span style={{ gridArea: narrow ? "status" : undefined, justifySelf: narrow ? "end" : "start", display: "inline-flex", alignItems: "center" }}>
        {status && (typeof status === "string" ? <Badge status={status} /> : status)}
      </span>

      {!narrow && (
        onChevronClick ? (
          // Distinct click target: opens the resident's Forms Hub while the rest
          // of the row keeps its own onClick. role=button (not a real <button>)
          // so it can legally live inside the row button; stopPropagation keeps
          // the two actions separate.
          <span
            role="button"
            tabIndex={0}
            aria-label={chevronLabel || "Open"}
            onClick={(e) => { e.stopPropagation(); onChevronClick(); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onChevronClick(); }
            }}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              padding: 4, margin: -4, borderRadius: 6, cursor: "pointer", color: "var(--admin-text-muted)",
              transition: "background 0.15s ease, color 0.15s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--admin-text)"; e.currentTarget.style.background = "rgba(15,23,42,0.06)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--admin-text-muted)"; e.currentTarget.style.background = "transparent"; }}
          >
            <ChevronRight size={16} strokeWidth={1.75} />
          </span>
        ) : (
          <ChevronRight size={16} strokeWidth={1.75} style={{ color: "var(--admin-text-muted)" }} />
        )
      )}
    </button>
  );
}

function PersonList({ children }) {
  return (
    <div
      style={{
        background: "var(--admin-paper)",
        border: "1px solid var(--admin-border)",
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
        transition: "all 0.2s ease",
      }}
    >
      {children}
    </div>
  );
}

// ─── GENERIC TABLE — refined, responsive, container-scoped ───────────────────
function Table({ cols, rows, onRow }) {
  return (
    <div className="admin-inline-container">
      <div
        className="admin-table-wrap"
        style={{
          boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
          borderRadius: 12,
        }}
      >
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={i}
                  data-clickable={onRow ? "true" : "false"}
                  onClick={() => onRow && onRow(row)}
                  style={{
                    transition: "all 0.16s ease",
                  }}
                  onMouseEnter={(e) => onRow && (e.currentTarget.style.background = "rgba(15,23,42,0.035)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  {row.map((cell, j) => <td key={j}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL — sticky header/footer, bottom-sheet on mobile ────────────────────
function Modal({ title, onClose, children, wide = false, footer = null }) {
  return (
    <div className="admin-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className={`admin-modal ${wide ? "admin-modal--wide" : ""}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow: "0 20px 40px rgba(15,23,42,0.16), 0 8px 16px rgba(15,23,42,0.08)",
        }}
      >
        <div className="admin-modal__header">
          <h2
            style={{
              fontFamily: "var(--font-fraunces), Georgia, serif",
              fontSize: 18,
              fontWeight: 500,
              color: "var(--admin-text)",
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
              width: 32, height: 32,
              borderRadius: 8,
              background: "var(--admin-canvas)",
              border: "1px solid var(--admin-border)",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--admin-text-soft)",
            }}
          >
            <X size={15} strokeWidth={2} />
          </button>
        </div>
        <div className="admin-modal__body admin-inline-container">{children}</div>
        {footer && <div className="admin-modal__footer">{footer}</div>}
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
      background: "var(--admin-danger)",
      color: "var(--admin-paper)",
      fontSize: 10,
      fontWeight: 700,
      marginLeft: 6,
      verticalAlign: "middle",
      animation: "admin-pulse-dot 2.2s ease-in-out infinite",
      flexShrink: 0,
    }}>!</span>
  );
}

// ─── STAT CARDS — section-level KPI grid (auto-fit, Fraunces numerals) ───────
function StatCards({ stats }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: 16,
        marginBottom: 28,
      }}
    >
      {stats.map((s) => {
        const isAlertActive = s.hasAlert && Number(s.value) > 0;
        return (
          <div
            key={s.label}
            style={{
              background: "var(--admin-paper)",
              border: `1px solid ${isAlertActive ? "rgba(236,64,122,0.2)" : "var(--admin-border)"}`,
              borderRadius: 12,
              padding: "18px 20px",
              position: "relative",
              boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
              transition: "all 0.22s ease",
              cursor: s.onViewAll ? "pointer" : "default",
            }}
            onMouseEnter={(e) => {
              if (s.onViewAll) {
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(15,23,42,0.1)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }
            }}
            onMouseLeave={(e) => {
              if (s.onViewAll) {
                e.currentTarget.style.boxShadow = "0 1px 3px rgba(15,23,42,0.06)";
                e.currentTarget.style.transform = "translateY(0)";
              }
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                color: "var(--admin-text-soft)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span style={{ flex: 1 }}>{s.label}</span>
              {isAlertActive && <AlertBadge />}
            </div>
            <div
              style={{
                fontFamily: "var(--font-fraunces), Georgia, serif",
                fontSize: 28,
                fontWeight: 500,
                color: s.color || "var(--admin-text)",
                letterSpacing: "-0.025em",
                marginTop: 4,
                lineHeight: 1,
              }}
            >
              {s.value ?? "—"}
            </div>
            {s.sub && (
              <div style={{ fontSize: 11, color: "var(--admin-text-soft)", marginTop: 6 }}>
                {s.sub}
              </div>
            )}
            {s.onViewAll && (
              <button
                onClick={s.onViewAll}
                style={{
                  marginTop: 8,
                  fontSize: 11,
                  fontWeight: 600,
                  color: s.color || "var(--admin-accent)",
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontFamily: "inherit",
                }}
              >
                {s.viewAllLabel || "Review"}
                <ChevronRight size={12} strokeWidth={2} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function EmptyState({ title, Icon = Inbox, desc, action }) {
  return (
    <div
      style={{
        background: "var(--admin-paper)",
        border: "2px dashed var(--admin-border-soft)",
        borderRadius: 12,
        padding: "56px 32px",
        textAlign: "center",
        boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
      }}
    >
      <div
        style={{
          width: 48, height: 48,
          margin: "0 auto 14px",
          borderRadius: 12,
          background: "var(--admin-canvas)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--admin-text-muted)",
        }}
      >
        <Icon size={22} strokeWidth={1.6} />
      </div>
      <div
        style={{
          fontFamily: "var(--font-fraunces), Georgia, serif",
          fontWeight: 500,
          color: "var(--admin-text)",
          marginBottom: 6,
          fontSize: 17,
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </div>
      {desc && <div style={{ fontSize: 13, color: "var(--admin-text-soft)", maxWidth: 380, margin: "0 auto", lineHeight: 1.5 }}>{desc}</div>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

// ─── PAGE HEADER — used by every admin section ───────────────────────────────
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
            color: "var(--admin-text)",
            margin: 0,
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
          }}
        >
          {title}
        </h1>
        {sub && (
          <div style={{ fontSize: 13, color: "var(--admin-text-soft)", marginTop: 6 }}>
            {sub}
          </div>
        )}
      </div>
      {action && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{action}</div>}
    </div>
  );
}

// ─── PRIMARY ACTION BUTTON ───────────────────────────────────────────────────
function PrimaryButton({ Icon, children, onClick, tone = "ink", type = "button" }) {
  const tones = {
    ink:    { bg: "var(--admin-ink)",   fg: "var(--admin-paper)", shadow: "0 2px 4px rgba(11,17,23,0.15)" },
    accent: { bg: "var(--admin-accent)", fg: "var(--admin-paper)", shadow: "0 2px 4px rgba(5,150,105,0.2)" },
    ghost:  { bg: "var(--admin-paper)",  fg: "var(--admin-text)", border: "1px solid var(--admin-border)", shadow: "0 1px 2px rgba(15,23,42,0.04)" },
  };
  const t = tones[tone];
  return (
    <button
      type={type}
      onClick={onClick}
      style={{
        padding: "10px 16px",
        background: t.bg,
        color: t.fg,
        border: t.border || "none",
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontFamily: "inherit",
        transition: "all 0.16s ease",
        boxShadow: t.shadow,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = `0 4px 8px ${tone === 'ink' ? 'rgba(11,17,23,0.2)' : tone === 'accent' ? 'rgba(5,150,105,0.25)' : 'rgba(15,23,42,0.08)'}`;
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = t.shadow;
        e.currentTarget.style.transform = "translateY(0)";
      }}
      onMouseDown={(e) => (e.currentTarget.style.transform = "translateY(0)")}
    >
      {Icon && <Icon size={15} strokeWidth={2} />}
      {children}
    </button>
  );
}

function BellIcon({ size = 18, color = "#1e2d40" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

// Resident search dropdown (backed by real residents list)
function ResidentDropdown({ residents = [], value, onChange, placeholder = "Select resident..." }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const sel = residents.find(r => r.id === value);
  const filtered = residents.filter(r => {
    const full = `${r.first_name} ${r.last_name}`.toLowerCase();
    return !q || full.includes(q.toLowerCase());
  });
  useEffect(() => {
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);
  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={sel ? `${sel.first_name} ${sel.last_name}` : q} onChange={e => { setQ(e.target.value); setOpen(true); if (sel) onChange(null); }} onFocus={() => setOpen(true)} placeholder={placeholder} style={{ ...inp, flex: 1 }} />
        {sel && <button onClick={() => { onChange(null); setQ(""); setOpen(false); }} style={{ padding: "0 10px", background: C.redBg, border: `1px solid #fca5a5`, borderRadius: 7, color: C.red, cursor: "pointer", fontSize: 12 }}>✕</button>}
      </div>
      {open && !sel && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: C.white, border: `1px solid ${C.blueBorder}`, borderRadius: 8, zIndex: 100, maxHeight: 240, overflowY: "auto", boxShadow: "0 8px 24px rgba(15,45,94,0.15)", marginTop: 4 }}>
          {filtered.length === 0 && <div style={{ padding: "12px 14px", color: C.muted, fontSize: 13 }}>No residents found</div>}
          {filtered.map(r => (
            <div key={r.id} onClick={() => { onChange(r.id); setOpen(false); setQ(""); }} style={{ padding: "10px 14px", cursor: "pointer", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10 }} onMouseEnter={e => e.currentTarget.style.background = C.bluePale} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: C.bluePale, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: C.blue, flexShrink: 0 }}>{(r.first_name?.[0] || "") + (r.last_name?.[0] || "")}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{r.first_name} {r.last_name}</div>
                {r.primary_diagnosis && <div style={{ fontSize: 11, color: C.muted }}>{r.primary_diagnosis}</div>}
              </div>
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
    const res = await fetch(path, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        ...(auth?.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {}),
        ...(opts.headers || {}),
      },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Request failed with status ${res.status}`);
    return data;
  }, [auth]);
}

// ─── SECTION: DASHBOARD ───────────────────────────────────────────────────────
function ReviewQueueRow({ Icon, label, count, sublabel, tone = 'neutral', onClick }) {
  const tones = {
    danger:  { fg: 'var(--admin-danger)',  bg: 'var(--admin-danger-bg)',  ring: 'rgba(185,28,28,0.2)' },
    warning: { fg: 'var(--admin-warning)', bg: 'var(--admin-warning-bg)', ring: 'rgba(180,83,9,0.18)' },
    success: { fg: 'var(--admin-success)', bg: 'var(--admin-success-bg)', ring: 'rgba(4,120,87,0.15)' },
    neutral: { fg: 'var(--admin-text-soft)', bg: '#F3F4F6', ring: 'rgba(15,23,42,0.08)' },
  };
  const t = tones[tone] ?? tones.neutral;
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        width: '100%',
        background: 'transparent',
        border: 'none',
        borderBottom: '1px solid var(--admin-border-soft)',
        padding: '14px 4px',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
        transition: 'background 0.18s ease',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(15,23,42,0.025)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <div
        aria-hidden="true"
        style={{
          width: 36, height: 36, borderRadius: 10,
          background: t.bg, color: t.fg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `inset 0 0 0 1px ${t.ring}`,
          flexShrink: 0,
        }}
      >
        <Icon size={17} strokeWidth={2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--admin-text)' }}>{label}</div>
        <div style={{ fontSize: 11.5, color: 'var(--admin-text-soft)', marginTop: 2 }}>{sublabel}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{
            fontFamily: 'var(--font-fraunces), Georgia, serif',
            fontSize: 22,
            fontWeight: 500,
            color: count > 0 ? t.fg : 'var(--admin-text-muted)',
            letterSpacing: '-0.02em',
            minWidth: 28,
            textAlign: 'right',
          }}
        >
          {count}
        </span>
        <ChevronRight size={16} strokeWidth={1.75} style={{ color: 'var(--admin-text-muted)' }} />
      </div>
    </button>
  );
}

function KpiTile({ label, value, sub, accent = 'var(--admin-text)' }) {
  return (
    <div
      style={{
        background: 'var(--admin-paper)',
        border: '1px solid var(--admin-border)',
        borderRadius: 14,
        padding: '18px 20px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--admin-text-soft)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-fraunces), Georgia, serif',
          fontSize: 36,
          fontWeight: 500,
          color: accent,
          letterSpacing: '-0.025em',
          marginTop: 6,
          lineHeight: 1,
        }}
      >
        {value ?? '—'}
      </div>
      {sub && (
        <div style={{ fontSize: 11.5, color: 'var(--admin-text-soft)', marginTop: 8 }}>{sub}</div>
      )}
    </div>
  );
}

function QuickActionCard({ Icon, label, desc, onClick, accent }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'var(--admin-paper)',
        border: '1px solid var(--admin-border)',
        borderRadius: 12,
        padding: '16px 18px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 14,
        textAlign: 'left',
        fontFamily: 'inherit',
        transition: 'transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.borderColor = '#CFCBBE';
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(15,23,42,0.06)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.borderColor = 'var(--admin-border)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'var(--admin-canvas)',
          border: '1px solid var(--admin-border)',
          color: accent || 'var(--admin-text)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={17} strokeWidth={1.85} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--admin-text)' }}>{label}</div>
        <div style={{ fontSize: 11.5, color: 'var(--admin-text-soft)', marginTop: 3, lineHeight: 1.45 }}>{desc}</div>
      </div>
      <ArrowUpRight size={15} strokeWidth={1.75} style={{ color: 'var(--admin-text-muted)', flexShrink: 0 }} />
    </button>
  );
}

function DashboardSection({ setView, stats, residents, staff }) {
  const now = new Date();
  const greeting =
    now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const reviewQueue = [
    {
      Icon: NotebookPen,
      label: 'Progress Notes awaiting review',
      sublabel: 'Daily caregiver entries to approve',
      count: Number(stats?.pending_daily_progress_notes ?? 0),
      view: 'daily_progress_notes',
    },
    {
      Icon: AlertTriangle,
      label: 'Incident Reports',
      sublabel: 'Filed by staff, pending admin sign-off',
      count: Number(stats?.pending_incident_reports ?? 0),
      view: 'incident_reports',
    },
    {
      Icon: Trash2,
      label: 'Drug Disposal records',
      sublabel: 'Witness signature & verification needed',
      count: Number(stats?.pending_drug_disposals ?? 0),
      view: 'drug_disposal',
    },
    {
      Icon: DoorOpen,
      label: 'Evacuation Drill logs',
      sublabel: 'OAR 411-050-0725(3) compliance check',
      count: Number(stats?.pending_evacuation_drills ?? 0),
      view: 'evacuation_drills',
    },
  ];

  const toneFor = (n) => (n > 5 ? 'danger' : n > 0 ? 'warning' : 'success');
  const totalPending = reviewQueue.reduce((s, r) => s + r.count, 0);

  const census = stats?.active_residents ?? residents.length;
  const activePlans = stats?.active_plans ?? '—';
  const highRisk = stats?.high_risk_residents ?? 0;
  const planExpiring = stats?.plans_expiring_soon ?? 0;
  const roiExpiring = stats?.roi_expiring_soon ?? 0;

  return (
    <div style={{ animation: 'admin-fade-up 0.4s ease both' }}>
      {/* Header */}
      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--admin-text-soft)', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 600 }}>
            {dateStr}
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-fraunces), Georgia, serif',
              fontSize: 36,
              fontWeight: 500,
              color: 'var(--admin-text)',
              margin: '6px 0 0',
              letterSpacing: '-0.025em',
              lineHeight: 1.1,
            }}
          >
            {greeting}.
          </h1>
          <div style={{ fontSize: 13.5, color: 'var(--admin-text-soft)', marginTop: 6 }}>
            {totalPending > 0
              ? <>You have <strong style={{ color: 'var(--admin-text)' }}>{totalPending}</strong> {totalPending === 1 ? 'item' : 'items'} awaiting your review.</>
              : 'Your queue is clear. Nice work.'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setView('pending_admissions')}
            style={{
              padding: '9px 14px',
              background: 'var(--admin-ink)',
              color: '#fff',
              border: 'none',
              borderRadius: 9,
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              fontFamily: 'inherit',
            }}
          >
            <ClipboardList size={14} strokeWidth={2} />
            Review Admissions
          </button>
          <button
            onClick={() => setView('residents')}
            style={{
              padding: '9px 14px',
              background: 'var(--admin-paper)',
              color: 'var(--admin-text)',
              border: '1px solid var(--admin-border)',
              borderRadius: 9,
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              fontFamily: 'inherit',
            }}
          >
            <Plus size={14} strokeWidth={2} />
            Quick add
          </button>
        </div>
      </div>

      {/* KPI tiles */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 14,
          marginBottom: 28,
        }}
      >
        <KpiTile label="Active Residents" value={census} sub="Current census" />
        <KpiTile label="Active Care Plans" value={activePlans} sub="Person-centered" accent="var(--admin-accent)" />
        <KpiTile label="High-Risk" value={highRisk} sub="Require closer monitoring" accent={highRisk > 0 ? 'var(--admin-danger)' : 'var(--admin-text)'} />
        <KpiTile label="Plans Expiring" value={planExpiring} sub="In the next 30 days" accent={planExpiring > 0 ? 'var(--admin-warning)' : 'var(--admin-text)'} />
        <KpiTile label="Total Staff" value={staff.length} sub="All roles · active" />
        <KpiTile label="ROI Expiring" value={roiExpiring} sub="Release-of-information review" accent={roiExpiring > 0 ? 'var(--admin-warning)' : 'var(--admin-text)'} />
      </div>

      {/* Today queue + quick actions */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
          gap: 18,
          alignItems: 'start',
        }}
      >
        {/* Review queue */}
        <section
          style={{
            background: 'var(--admin-paper)',
            border: '1px solid var(--admin-border)',
            borderRadius: 16,
            padding: '20px 22px 8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
            <h2
              style={{
                fontFamily: 'var(--font-fraunces), Georgia, serif',
                fontSize: 19,
                fontWeight: 500,
                color: 'var(--admin-text)',
                margin: 0,
                letterSpacing: '-0.015em',
              }}
            >
              Today
            </h2>
            <span style={{ fontSize: 11, color: 'var(--admin-text-soft)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600 }}>
              Review queue
            </span>
          </div>
          <div>
            {reviewQueue.map((r) => (
              <ReviewQueueRow
                key={r.view}
                Icon={r.Icon}
                label={r.label}
                sublabel={r.sublabel}
                count={r.count}
                tone={toneFor(r.count)}
                onClick={() => setView(r.view)}
              />
            ))}
          </div>
        </section>

        {/* Quick actions */}
        <section>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10, padding: '0 4px' }}>
            <h2
              style={{
                fontFamily: 'var(--font-fraunces), Georgia, serif',
                fontSize: 19,
                fontWeight: 500,
                color: 'var(--admin-text)',
                margin: 0,
                letterSpacing: '-0.015em',
              }}
            >
              Jump to
            </h2>
            <span style={{ fontSize: 11, color: 'var(--admin-text-soft)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600 }}>
              Quick actions
            </span>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            <QuickActionCard Icon={Users}        label="Residents"      desc="Manage the active resident roster"            onClick={() => setView('residents')} />
            <QuickActionCard Icon={FileText}     label="Face Sheets"    desc="Demographic & clinical snapshots per resident" onClick={() => setView('face_sheets')} />
            <QuickActionCard Icon={CalendarDays} label="Appointments"   desc="Medical, therapy, and community visits"        onClick={() => setView('appointments')} />
            <QuickActionCard Icon={Megaphone}    label="Announcements"  desc="Send notices to staff or residents"            onClick={() => setView('announcements')} />
            <QuickActionCard Icon={Sparkles}     label="Activities"     desc="Plan the weekly activity schedule"             onClick={() => setView('activities')} />
            <QuickActionCard Icon={Inbox}        label="Resident Requests" desc="Triage incoming resident requests"          onClick={() => setView('resident_requests')} />
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── SECTION: PRE-SCREENING REDIRECT ──────────────────────────────────────────
function PreScreeningRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.push('/admission/pre-screening');
  }, [router]);
  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--admin-text-soft)' }}>Redirecting to pre-screening form...</div>;
}

// ─── SECTION: RESIDENTS ───────────────────────────────────────────────────────
function ResidentsSection({ residents }) {
  const router = useRouter();
  // useAuth() returns { auth: { accessToken }, ... } — the token is nested under
  // `auth`, not top-level. Destructure it (see project_useauth_context_shape).
  const { auth } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [approvedPreScreenings, setApprovedPreScreenings] = useState([]);
  const [psLoading, setPsLoading] = useState(true);
  const [psError, setPsError] = useState(null);
  const [psOpen, setPsOpen] = useState(false);
  const psDropdownRef = useRef(null);

  useEffect(() => {
    const loadApprovedPreScreenings = async () => {
      try {
        const res = await fetch('/api/v1/admission/approved', {
          headers: {
            ...(auth?.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {}),
          },
          credentials: 'same-origin',
        });
        if (res.ok) {
          const result = await res.json();
          setApprovedPreScreenings(result.data || []);
        }
      } catch (err) {
        setPsError(err.message);
      } finally {
        setPsLoading(false);
      }
    };
    if (auth?.accessToken) loadApprovedPreScreenings();
  }, [auth?.accessToken]);

  const filteredResidents = residents.filter((r) => {
    const fullName = `${r.first_name || ""} ${r.last_name || ""}`.toLowerCase();
    const term = searchTerm.toLowerCase();
    return fullName.includes(term) || (r.medicaid_id && r.medicaid_id.includes(term));
  });

  const handleSelectApprovedPreScreening = (id) => {
    setPsOpen(false);
    router.push(`/admission/nursing-assessment?screening_id=${id}`);
  };

  return (
    <div>
      <PageHeader
        title="Residents"
        sub="Active resident roster · click a resident to open their record"
        action={
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setPsOpen(!psOpen)}
              style={{
                padding: '10px 16px',
                background: 'var(--admin-ink)',
                color: 'var(--admin-paper)',
                border: 'none',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontFamily: 'inherit',
                transition: 'all 0.16s ease',
                boxShadow: '0 2px 4px rgba(11,17,23,0.15)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(11,17,23,0.2)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(11,17,23,0.15)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <Plus size={15} strokeWidth={2} />
              Admit Resident
            </button>
            {psOpen && (
              <div
                ref={psDropdownRef}
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 6,
                  background: 'var(--admin-paper)',
                  border: '1px solid var(--admin-border)',
                  borderRadius: 12,
                  boxShadow: '0 12px 32px rgba(15,23,42,0.12)',
                  minWidth: 260,
                  maxHeight: 320,
                  overflowY: 'auto',
                  zIndex: 100,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {psLoading ? (
                  <div style={{ padding: '16px 14px', color: 'var(--admin-text-soft)', fontSize: 13, textAlign: 'center' }}>Loading...</div>
                ) : approvedPreScreenings.length === 0 ? (
                  <div style={{ padding: '16px 14px', color: 'var(--admin-text-soft)', fontSize: 13 }}>No completed pre-screenings yet.</div>
                ) : (
                  approvedPreScreenings.map((ps) => {
                    const dob = ps.date_of_birth ? new Date(ps.date_of_birth).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;
                    return (
                      <button
                        key={ps.id}
                        onClick={() => handleSelectApprovedPreScreening(ps.id)}
                        style={{
                          width: '100%',
                          padding: '12px 14px',
                          borderBottom: '1px solid var(--admin-border-soft)',
                          background: 'transparent',
                          border: 'none',
                          borderLeft: 'none',
                          borderRight: 'none',
                          borderTop: 'none',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          transition: 'background 0.12s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(15,23,42,0.035)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--admin-text)' }}>{ps.full_name}</div>
                        {dob && <div style={{ fontSize: 11, color: 'var(--admin-text-soft)', marginTop: 2 }}>DOB: {dob}</div>}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        }
      />

      <div style={{ marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Search residents by name or ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 12px",
            fontSize: 14,
            border: "1px solid var(--admin-border)",
            borderRadius: 8,
            background: "var(--admin-paper)",
            color: "var(--admin-text)",
            fontFamily: "var(--font-geist)",
          }}
        />
      </div>

      <StatCards
        stats={[
          { label: "Total",            value: residents.length, sub: "On register" },
          { label: "Active",           value: residents.filter((r) => (r.status || "active") === "active").length, sub: "Currently admitted", color: "var(--admin-success)" },
          { label: "Voluntary",        value: residents.filter((r) => r.legal_status === "voluntary").length, sub: "Self-admitted",  color: "var(--admin-accent)" },
          { label: "Civil Commitment", value: residents.filter((r) => r.legal_status === "civil_commitment").length, sub: "Court-ordered", color: "var(--admin-warning)" },
        ]}
      />

      {filteredResidents.length === 0 ? (
        <EmptyState
          title={searchTerm ? "No residents found" : "No residents admitted yet"}
          Icon={Users}
          desc={searchTerm ? `No residents match "${searchTerm}". Try a different search.` : "Start an admission to add the first resident to the register."}
          action={!searchTerm && <PrimaryButton Icon={Plus} onClick={() => router.push("/admission")}>Admit Resident</PrimaryButton>}
        />
      ) : (
        <PersonList>
          {filteredResidents.map((r) => {
            const fullName = `${r.first_name || ""} ${r.last_name || ""}`.trim() || "Resident";
            const intake = r.intake_date ? new Date(r.intake_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;
            return (
              <PersonRow
                key={r.id}
                name={fullName}
                secondary={r.primary_diagnosis || "Diagnosis on file"}
                meta={[
                  { label: "Gender",  value: r.gender ? r.gender.charAt(0).toUpperCase() + r.gender.slice(1) : null },
                  { label: "Intake",  value: intake },
                  { label: "Legal",   value: <Badge status={r.legal_status || "voluntary"} size="sm" /> },
                ]}
                status={r.status || "active"}
                onClick={() => router.push(`/care-plan?residentId=${r.id}`)}
                onChevronClick={() => router.push(`/admin/residents/${r.id}/forms`)}
                chevronLabel={`Open ${fullName}'s forms`}
              />
            );
          })}
        </PersonList>
      )}
    </div>
  );
}

// ─── SECTION: STAFF ───────────────────────────────────────────────────────────
function StaffSection({ staff, onRefresh }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [newStaffId, setNewStaffId] = useState(null);
  const [copied, setCopied] = useState({});
  const [expandedStaffId, setExpandedStaffId] = useState(null);

  useEffect(() => {
    const notifs = JSON.parse(sessionStorage.getItem('admin_notifications') || '[]');
    if (notifs.length > 0) {
      setNotifications([notifs[0]]);
      if (notifs[0].staff && notifs[0].staff.id) {
        setNewStaffId(notifs[0].staff.id);
        if (onRefresh) onRefresh();
      }
    }
  }, [onRefresh]);

  const dismissNotification = (index) => {
    const notifs = JSON.parse(sessionStorage.getItem('admin_notifications') || '[]');
    notifs.splice(index, 1);
    sessionStorage.setItem('admin_notifications', JSON.stringify(notifs));
    setNotifications(notifs);
    setNewStaffId(null);
  };

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopied(prev => ({ ...prev, [field]: true }));
    setTimeout(() => setCopied(prev => ({ ...prev, [field]: false })), 2000);
  };

  return (
    <div>
      {/* Credentials Notification */}
      {notifications.map((notif, idx) => (
        <div
          key={idx}
          style={{
            background: "var(--admin-paper)",
            border: "1px solid var(--admin-border)",
            borderRadius: 14,
            padding: 18,
            marginBottom: 18,
            animation: "admin-fade-up 0.24s ease both",
          }}
          className="admin-inline-container"
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
            <div
              aria-hidden="true"
              style={{
                width: 36, height: 36, borderRadius: 10,
                background: "var(--admin-success-bg)",
                color: "var(--admin-success)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <ShieldCheck size={18} strokeWidth={1.85} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "var(--font-fraunces), Georgia, serif", fontSize: 16, fontWeight: 500, color: "var(--admin-text)", letterSpacing: "-0.012em" }}>
                Staff member created
              </div>
              <div style={{ fontSize: 13, color: "var(--admin-text-soft)", marginTop: 2 }}>
                <strong style={{ color: "var(--admin-text)" }}>{notif.staff.first_name} {notif.staff.last_name}</strong> · {notif.staff.role?.replace(/_/g, " ")}
              </div>
            </div>
            <button
              onClick={() => dismissNotification(idx)}
              aria-label="Dismiss"
              style={{
                width: 30, height: 30, borderRadius: 8,
                background: "var(--admin-canvas)",
                border: "1px solid var(--admin-border)",
                cursor: "pointer",
                color: "var(--admin-text-soft)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>

          <div
            style={{
              background: "var(--admin-canvas)",
              border: "1px solid var(--admin-border)",
              borderRadius: 10,
              padding: 14,
              marginBottom: 12,
            }}
          >
            <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--admin-text-soft)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <KeyRound size={12} strokeWidth={2} />
              Login Credentials
            </div>
            <div className="admin-form-grid" style={{ "--cols": 2, gap: "10px 14px" }}>
              <CredentialField label="Username" value={notif.credentials.username} copied={copied.username} onCopy={() => copyToClipboard(notif.credentials.username, "username")} />
              <CredentialField label="Password" value={notif.credentials.password} copied={copied.password} onCopy={() => copyToClipboard(notif.credentials.password, "password")} />
            </div>
          </div>

          <InfoBox tone="warning">
            <strong>Temporary password</strong> — staff member must change it on first sign-in. Share securely.
          </InfoBox>
        </div>
      ))}

      <PageHeader
        title="Staff Directory"
        sub="All staff members and their roles"
        action={
          <PrimaryButton Icon={Plus} onClick={() => router.push("/add-staff")}>
            Add Staff Member
          </PrimaryButton>
        }
      />

      {staff.length === 0 ? (
        <EmptyState
          title="No staff added yet"
          Icon={UserCog}
          desc='Add the first staff account to start tracking shifts, roles, and credentials.'
          action={<PrimaryButton Icon={Plus} onClick={() => router.push("/add-staff")}>Add Staff Member</PrimaryButton>}
        />
      ) : (
        <div>
          <PersonList>
            {staff.map((s) => {
              const fullName = `${s.first_name || ""} ${s.last_name || ""}`.trim() || "Staff Member";
              const isNew = newStaffId === s.id;
              const isExpanded = expandedStaffId === s.id;
              return (
                <PersonRow
                  key={s.id}
                  avatarName={fullName}
                  name={
                    <>
                      {fullName}
                      {isNew && (
                        <span style={{
                          marginLeft: 8,
                          fontSize: 10,
                          fontWeight: 700,
                          background: "var(--admin-success)",
                          color: "var(--admin-paper)",
                          padding: "1px 6px",
                          borderRadius: 4,
                          letterSpacing: "0.06em",
                        }}>NEW</span>
                      )}
                    </>
                  }
                  secondary={s.role?.replace(/_/g, " ") || "Staff"}
                  role={s.role || "staff"}
                  meta={[
                    { label: "Email", value: s.email },
                    { label: "Phone", value: s.phone },
                  ]}
                  status={s.is_active ? "active" : "inactive"}
                  onClick={() => setExpandedStaffId(isExpanded ? null : s.id)}
                />
              );
            })}
          </PersonList>

          {/* Detailed View */}
          {expandedStaffId && staff.find((s) => s.id === expandedStaffId) && (() => {
            const s = staff.find((s) => s.id === expandedStaffId);
            const fullName = `${s.first_name || ""} ${s.last_name || ""}`.trim();
            return (
              <div
                style={{
                  marginTop: 18,
                  background: "var(--admin-paper)",
                  border: "1px solid var(--admin-border)",
                  borderRadius: 14,
                  padding: 22,
                  animation: "admin-fade-up 0.22s ease both",
                }}
                className="admin-inline-container"
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14, paddingBottom: 16, borderBottom: "1px solid var(--admin-border-soft)" }}>
                  <Avatar name={fullName} size={56} role={s.role} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: "var(--font-fraunces), Georgia, serif",
                      fontSize: 20,
                      fontWeight: 500,
                      color: "var(--admin-text)",
                      letterSpacing: "-0.012em",
                    }}>
                      {fullName}
                      {s.preferred_name && <span style={{ fontSize: 13, color: "var(--admin-text-soft)", marginLeft: 8, fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>({s.preferred_name})</span>}
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--admin-text-soft)", marginTop: 4, display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <span style={{ textTransform: "capitalize" }}>{s.role?.replace(/_/g, " ")}</span>
                      <span aria-hidden="true">·</span>
                      <Badge status={s.is_active ? "active" : "inactive"} size="sm" />
                    </div>
                  </div>
                  <button
                    onClick={() => setExpandedStaffId(null)}
                    aria-label="Close details"
                    style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: "var(--admin-canvas)",
                      border: "1px solid var(--admin-border)",
                      cursor: "pointer",
                      color: "var(--admin-text-soft)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <X size={15} strokeWidth={2} />
                  </button>
                </div>

                <div className="admin-form-grid" style={{ "--cols": 2, marginTop: 18 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--admin-text-soft)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Contact</div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {s.email    && <DetailField label="Email"    value={s.email} />}
                      {s.phone    && <DetailField label="Phone"    value={s.phone} />}
                      {s.pronouns && <DetailField label="Pronouns" value={s.pronouns.replace(/_/g, " ")} />}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--admin-text-soft)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Employment</div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {s.hire_date   && <DetailField label="Hire Date"   value={new Date(s.hire_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} />}
                      {s.shift       && <DetailField label="Shift"       value={s.shift.charAt(0).toUpperCase() + s.shift.slice(1)} />}
                      {s.employee_id && <DetailField label="Employee ID" value={s.employee_id} />}
                    </div>
                  </div>
                </div>

                {(s.emergency_contact_name || s.emergency_contact_phone || s.emergency_contact_relation) && (
                  <div style={{
                    marginTop: 18,
                    padding: "14px 16px",
                    background: "var(--admin-warning-bg)",
                    borderRadius: 10,
                    borderLeft: "3px solid var(--admin-warning)",
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--admin-warning)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Emergency Contact</div>
                    <div style={{ fontSize: 13, color: "var(--admin-text)" }}>
                      {s.emergency_contact_name && (
                        <div>
                          <strong>{s.emergency_contact_name}</strong>
                          {s.emergency_contact_relation && <span style={{ color: "var(--admin-text-soft)" }}> ({s.emergency_contact_relation})</span>}
                        </div>
                      )}
                      {s.emergency_contact_phone && <div style={{ color: "var(--admin-text-soft)", marginTop: 2 }}>{s.emergency_contact_phone}</div>}
                    </div>
                  </div>
                )}

                {s.notes && (
                  <div style={{
                    marginTop: 14,
                    padding: "14px 16px",
                    background: "var(--admin-accent-soft)",
                    borderRadius: 10,
                    borderLeft: "3px solid var(--admin-accent)",
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--admin-accent)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Notes</div>
                    <div style={{ fontSize: 13, color: "var(--admin-text)", lineHeight: 1.6 }}>{s.notes}</div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

    </div>
  );
}

// ─── SECTION: FACE SHEETS ─────────────────────────────────────────────────────
function FaceSheetsSection({ residents }) {
  const [selectedId, setSelectedId] = useState(null);
  const r = residents.find(x => x.id === selectedId);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.navy, margin: 0 }}>Face Sheets</h2>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>Demographic and clinical snapshot per resident</div>
      </div>
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 18px", marginBottom: 20 }}>
        <label style={lbl}>Search or Select Resident</label>
        <ResidentDropdown residents={residents} value={selectedId} onChange={setSelectedId} />
      </div>

      {!r && (
        residents.length === 0
          ? <EmptyState title="No residents on record" icon="▦" desc="Admit a resident first to view face sheets." />
          : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {residents.map(res => (
                <div key={res.id} onClick={() => setSelectedId(res.id)} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, cursor: "pointer" }} onMouseEnter={e => e.currentTarget.style.background = C.bluePale} onMouseLeave={e => e.currentTarget.style.background = C.white}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: C.blue, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "var(--admin-paper)", flexShrink: 0 }}>{(res.first_name?.[0] || "") + (res.last_name?.[0] || "")}</div>
                    <div>
                      <div style={{ fontWeight: 700, color: C.navy, fontSize: 13 }}>{res.first_name} {res.last_name}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>Intake: {res.intake_date ? new Date(res.intake_date).toLocaleDateString("en-US") : "—"}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: C.text, lineHeight: 1.7 }}>
                    <div><strong>Dx:</strong> {res.primary_diagnosis || "—"}</div>
                    <div><strong>Gender:</strong> {res.gender || "—"}</div>
                    <div><strong>Status:</strong> {(res.status || "active").replace(/_/g, " ")}</div>
                  </div>
                </div>
              ))}
            </div>
          )
      )}

      {r && (
        <div>
          <button onClick={() => setSelectedId(null)} style={{ marginBottom: 16, padding: "6px 14px", background: C.bluePale, border: `1px solid ${C.blueBorder}`, borderRadius: 6, color: C.blue, cursor: "pointer", fontSize: 13 }}>← All Residents</button>
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ background: C.navy, padding: "20px 24px", display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: "var(--admin-paper)" }}>{(r.first_name?.[0] || "") + (r.last_name?.[0] || "")}</div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--admin-paper)" }}>{r.first_name} {r.last_name}{r.preferred_name ? ` (${r.preferred_name})` : ""}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", marginTop: 3 }}>
                  Admitted {r.intake_date ? new Date(r.intake_date).toLocaleDateString("en-US") : "—"} · {(r.legal_status || "voluntary").replace(/_/g, " ").toUpperCase()} · {(r.status || "active").toUpperCase()}
                </div>
              </div>
            </div>
            <div style={{ padding: "20px 24px" }}>
              <FaceSheet residentId={r.id} resident={r} canEdit={true} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SECTION: CALENDAR ────────────────────────────────────────────────────────
// Event types shown in the Add-Event dropdown.
// Resident appointments use the appointment-type subset; facility events
// post a notification to all staff in addition to the calendar entry.
const CALENDAR_EVENT_TYPES = [
  { value: 'medical',         label: 'Medical appointment',     facility: false, mappedType: 'medical'   },
  { value: 'psychiatric',     label: 'Psychiatric appointment', facility: false, mappedType: 'medical'   },
  { value: 'therapy',         label: 'Therapy session',         facility: false, mappedType: 'medical'   },
  { value: 'dental',          label: 'Dental',                  facility: false, mappedType: 'dental'   },
  { value: 'lab',             label: 'Lab work',                facility: false, mappedType: 'medical'   },
  { value: 'community',       label: 'Community visit',         facility: false, mappedType: 'social'    },
  { value: 'vocational',      label: 'Vocational',              facility: false, mappedType: 'other'    },
  { value: 'court',           label: 'Court',                   facility: false, mappedType: 'other'    },
  { value: 'other',           label: 'Other appointment',       facility: false, mappedType: 'other'    },
  // Facility-level events — broadcast to all staff
  { value: 'drug_disposal',   label: 'Drug Disposal',           facility: true,  mappedType: 'facility_event' },
  { value: 'evacuation_drill',label: 'Evacuation Drill',        facility: true,  mappedType: 'facility_event' },
  { value: 'fire_inspection', label: 'Fire Inspection',         facility: true,  mappedType: 'facility_event' },
  { value: 'staff_meeting',   label: 'Staff Meeting',           facility: true,  mappedType: 'facility_event' },
  { value: 'training',        label: 'Staff Training',          facility: true,  mappedType: 'facility_event' },
  { value: 'inspection',      label: 'Facility Inspection',     facility: true,  mappedType: 'facility_event' },
];

function CalendarSection({ appointments = [], residents = [], api, onEventCreated }) {
  const today = new Date();
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [overlayDate, setOverlayDate] = useState(null); // YYYY-MM-DD or null
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const firstDay     = new Date(year, month, 1).getDay();
  const daysInMonth  = new Date(year, month + 1, 0).getDate();
  const monthLabel   = new Date(year, month, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
  const days         = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks       = Array.from({ length: firstDay });

  const isToday = d => d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  // Build a map: "YYYY-MM-DD" -> appointment[]
  const apptByDay = appointments.reduce((acc, a) => {
    if (!a.date) return acc;
    (acc[a.date] = acc[a.date] || []).push(a);
    return acc;
  }, {});

  const dayKey = (d) => `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  function prev() { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); }
  function next() { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); }

  const overlayAppts = overlayDate ? (apptByDay[overlayDate] || []) : [];

  function fmtTime(t) {
    if (!t) return "";
    const [h, m] = t.split(":").map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
  }

  function openDay(date) {
    setOverlayDate(date);
    setAdding(false);
    setForm({});
    setFormError('');
  }

  function openAddEvent(prefillDate) {
    const d = prefillDate || overlayDate || dayKey(today.getDate());
    setOverlayDate(d);
    setAdding(true);
    setForm({ date: d, time: '09:00', type: 'medical', duration: 60, status: 'scheduled' });
    setFormError('');
  }

  function closeOverlay() {
    setOverlayDate(null);
    setAdding(false);
    setForm({});
    setFormError('');
  }

  const selectedTypeMeta = CALENDAR_EVENT_TYPES.find(t => t.value === form.type) || CALENDAR_EVENT_TYPES[0];
  const isFacility = !!selectedTypeMeta?.facility;

  const calNavBtn = { width: 32, height: 32, display: "inline-flex", alignItems: "center", justifyContent: "center", background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, cursor: "pointer" };

  async function handleSubmit() {
    setFormError('');
    if (!form.type || !form.date || !form.time || !form.title) {
      setFormError('Type, date, time, and title are required');
      return;
    }
    if (!isFacility && !form.residentId) {
      setFormError('Select a resident for this appointment');
      return;
    }
    setSubmitting(true);
    try {
      const scheduledAt = new Date(`${form.date}T${form.time}:00`).toISOString();
      const payload = {
        appointment_type: selectedTypeMeta.mappedType,
        title: form.title,
        description: form.description || null,
        location: form.location || null,
        scheduled_at: scheduledAt,
        duration_minutes: parseInt(form.duration) || 60,
        status: form.status || 'scheduled',
        is_facility_event: isFacility,
      };
      if (!isFacility) payload.resident_id = form.residentId;
      await api('/api/v1/appointments', { method: 'POST', body: JSON.stringify(payload) });

      // Facility events: broadcast to all staff via notifications
      if (isFacility) {
        const friendly = selectedTypeMeta.label;
        try {
          await api('/api/v1/notifications', {
            method: 'POST',
            body: JSON.stringify({
              type: 'facility_event',
              title: `${friendly} scheduled`,
              body: `${form.title} on ${form.date} at ${fmtTime(form.time)}${form.location ? ` · ${form.location}` : ''}`,
              action_url: '/staff',
            }),
          });
        } catch { /* non-fatal — calendar entry already saved */ }
      }

      closeOverlay();
      onEventCreated?.();
    } catch (err) {
      setFormError(err?.message || 'Failed to save event');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontFamily: "var(--font-fraunces), Georgia, serif", fontSize: 22, fontWeight: 500, color: C.navy, margin: 0, letterSpacing: "-0.01em" }}>Calendar</h2>
          <div style={{ fontSize: 12.5, color: C.muted, marginTop: 3 }}>Appointments, visits, and facility events</div>
        </div>
        <button
          onClick={() => openAddEvent()}
          style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 18px 10px 15px", background: "var(--admin-accent)", border: "none", borderRadius: 999, color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer", boxShadow: "0 1px 2px rgba(5,150,105,0.28)" }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 3px 8px rgba(5,150,105,0.3)"; }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 1px 2px rgba(5,150,105,0.28)"; }}
        >
          <Plus size={15} strokeWidth={2.3} /> Add Event
        </button>
      </div>

      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 3px rgba(15,23,42,0.05)" }}>
        {/* Toolbar — Google Calendar style */}
        <div style={{ padding: "13px 16px", display: "flex", alignItems: "center", gap: 14, borderBottom: `1px solid var(--admin-border-soft)` }}>
          <div style={{ fontFamily: "var(--font-fraunces), Georgia, serif", fontSize: 19, fontWeight: 500, color: C.navy, letterSpacing: "-0.01em", minWidth: 188 }}>{monthLabel}</div>
          <button
            onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }}
            style={{ padding: "6px 15px", background: C.white, border: `1px solid ${C.border}`, borderRadius: 999, fontSize: 12.5, fontWeight: 600, color: C.text, cursor: "pointer" }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--admin-canvas)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = C.white; }}
          >Today</button>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
            <button onClick={prev} aria-label="Previous month" style={calNavBtn}><ChevronLeft size={17} strokeWidth={2} /></button>
            <button onClick={next} aria-label="Next month" style={calNavBtn}><ChevronRight size={17} strokeWidth={2} /></button>
          </div>
        </div>
        {/* Weekday header */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: `1px solid var(--admin-border-soft)` }}>
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
            <div key={d} style={{ padding: "9px 0 9px 10px", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{d}</div>
          ))}
        </div>
        {/* Day grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
          {blanks.map((_, i) => <div key={`b${i}`} style={{ minHeight: 106, borderRight: `1px solid var(--admin-border-soft)`, borderBottom: `1px solid var(--admin-border-soft)`, background: "var(--admin-canvas)" }} />)}
          {days.map(d => {
            const key = dayKey(d);
            const dayAppts = apptByDay[key] || [];
            const tdy = isToday(d);
            return (
              <div key={d} onClick={() => openDay(key)} style={{ minHeight: 106, borderRight: `1px solid var(--admin-border-soft)`, borderBottom: `1px solid var(--admin-border-soft)`, padding: "6px 6px 8px", background: C.white, cursor: "pointer", transition: "background 0.12s ease" }} onMouseEnter={e => { e.currentTarget.style.background = "var(--admin-accent-soft)"; }} onMouseLeave={e => { e.currentTarget.style.background = C.white; }}>
                <div style={{ marginBottom: 5 }}>
                  <span style={{ width: 24, height: 24, borderRadius: "50%", background: tdy ? "var(--admin-accent)" : "transparent", color: tdy ? "#fff" : C.text, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: tdy ? 700 : 500 }}>{d}</span>
                </div>
                {dayAppts.length > 0 && (
                  <div style={{ display: "grid", gap: 3 }}>
                    {dayAppts.slice(0, 3).map((a, i) => {
                      const ts = APPT_TYPES[a.type] || APPT_TYPES.other;
                      return (
                        <div key={i} title={`${a.residentName} — ${ts.label}`} style={{ display: "flex", alignItems: "center", gap: 5, background: ts.bg, borderRadius: 5, padding: "2px 6px", overflow: "hidden" }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: ts.color, flexShrink: 0 }} />
                          <span style={{ fontSize: 10.5, fontWeight: 600, color: ts.color, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {a.time ? fmtTime(a.time) + " · " : ""}{a.residentName}
                          </span>
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

      {/* ─── Overlay modal ──────────────────────────────────────── */}
      {overlayDate && (
        <div onClick={closeOverlay} style={{
          position: 'fixed', inset: 0, background: 'rgba(10,14,26,0.55)',
          backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24, zIndex: 500,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: C.white, borderRadius: 14, width: 'min(620px, 100%)',
            maxHeight: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column',
            boxShadow: '0 24px 60px rgba(15,23,42,0.22)', overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {adding ? 'New Event' : 'Calendar'}
                </div>
                <div style={{ fontFamily: 'var(--font-fraunces), Georgia, serif', fontSize: 20, fontWeight: 500, color: C.navy, marginTop: 2 }}>
                  {new Date(overlayDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
              <button onClick={closeOverlay} aria-label="Close" style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 22, color: C.muted, padding: '4px 8px', borderRadius: 6 }}>×</button>
            </div>

            {/* Body */}
            <div style={{ padding: '18px 22px', overflowY: 'auto', flex: 1 }}>
              {!adding && (
                <>
                  {overlayAppts.length === 0 ? (
                    <div style={{ padding: '20px 0', textAlign: 'center', color: C.muted, fontSize: 13 }}>
                      Nothing scheduled on this day.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                      {overlayAppts.map(a => {
                        const ts = APPT_TYPES[a.type] || APPT_TYPES.other;
                        const ss = APPT_STATUS_MAP[a.status] || APPT_STATUS_MAP.scheduled;
                        return (
                          <div key={a.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 14px', background: '#F8FAFD', borderRadius: 8, borderLeft: `3px solid ${ts.color}` }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 700, fontSize: 14, color: C.navy }}>{a.residentName || a.title || ts.label}</div>
                              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                                {ts.label}{a.provider && a.provider !== '—' ? ` · ${a.provider}` : ''}{a.time ? ` · ${fmtTime(a.time)}` : ''}
                              </div>
                            </div>
                            <span style={{ background: ss.bg, color: ss.color, padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>{ss.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {adding && (
                <div style={{ display: 'grid', gap: 14 }}>
                  <div>
                    <label style={lbl}>Event Type</label>
                    <select value={form.type || 'medical'} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={{ ...inp, appearance: 'none' }}>
                      <optgroup label="Resident appointments">
                        {CALENDAR_EVENT_TYPES.filter(t => !t.facility).map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </optgroup>
                      <optgroup label="Facility events (notifies all staff)">
                        {CALENDAR_EVENT_TYPES.filter(t => t.facility).map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </optgroup>
                    </select>
                  </div>

                  {!isFacility && (
                    <div>
                      <label style={lbl}>Resident</label>
                      <select value={form.residentId || ''} onChange={e => setForm(f => ({ ...f, residentId: e.target.value }))} style={{ ...inp, appearance: 'none' }}>
                        <option value="">— Select resident —</option>
                        {residents.map(r => (
                          <option key={r.id} value={r.id}>{r.first_name} {r.last_name}{r.medicaid_id ? ` · ${r.medicaid_id}` : ''}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label style={lbl}>Title</label>
                    <input value={form.title || ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder={isFacility ? 'e.g., Quarterly drug disposal' : 'e.g., Dr. Smith — follow-up'} style={inp} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={lbl}>Date</label>
                      <input type="date" value={form.date || ''} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inp} />
                    </div>
                    <div>
                      <label style={lbl}>Time</label>
                      <input type="time" value={form.time || ''} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} style={inp} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={lbl}>Duration (min)</label>
                      <input type="number" value={form.duration || 60} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} style={inp} />
                    </div>
                    <div>
                      <label style={lbl}>Location</label>
                      <input value={form.location || ''} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Optional" style={inp} />
                    </div>
                  </div>

                  <div>
                    <label style={lbl}>Notes</label>
                    <textarea rows={3} value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional context" style={{ ...inp, resize: 'vertical' }} />
                  </div>

                  {formError && (
                    <div style={{ padding: '10px 12px', background: C.redBg, color: C.red, borderRadius: 6, fontSize: 13, borderLeft: `3px solid ${C.red}` }}>{formError}</div>
                  )}

                  {isFacility && (
                    <div style={{ padding: '10px 12px', background: 'var(--admin-accent-soft)', color: 'var(--admin-accent)', borderRadius: 6, fontSize: 12, borderLeft: `3px solid var(--admin-accent)` }}>
                      All staff will be notified when this event is saved.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 22px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <button onClick={closeOverlay} style={{ padding: '9px 16px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, fontWeight: 600, color: C.muted, cursor: 'pointer' }}>
                Close
              </button>
              {!adding ? (
                <button onClick={() => openAddEvent(overlayDate)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: 'var(--admin-accent)', border: 'none', borderRadius: 999, fontSize: 13, fontWeight: 600, color: 'var(--admin-paper)', cursor: 'pointer' }}>
                  <Plus size={14} strokeWidth={2.3} /> Add Event on this day
                </button>
              ) : (
                <button onClick={handleSubmit} disabled={submitting} style={{ padding: '9px 20px', background: submitting ? C.muted : 'var(--admin-accent)', border: 'none', borderRadius: 999, fontSize: 13, fontWeight: 600, color: 'var(--admin-paper)', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
                  {submitting ? 'Saving…' : 'Save Event'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SECTION: ADMIN CALENDAR ─────────────────────────────────────────────────
// Fetches appointments and renders CalendarSection with real data.
function AdminCalendarSection({ api, residents }) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!api) return;
    setLoading(true);
    api("/api/v1/appointments?limit=200").catch(() => ({ data: [] }))
      .then(result => {
        const data = result.data || result.appointments || [];
        const transformed = data.map(a => {
          const scheduledAt = a.scheduled_at ? new Date(a.scheduled_at) : null;
          const isFacility = !!a.is_facility_event;
          const residentName = isFacility
            ? (a.title || 'Facility event')
            : (a.first_name ? `${a.first_name} ${a.last_name}` : '—');
          return {
            id: a.id,
            residentName,
            isFacility,
            type: isFacility ? 'other' : (a.appointment_type || "other"),
            provider: a.title || "—",
            date: scheduledAt ? scheduledAt.toISOString().slice(0, 10) : null,
            time: scheduledAt ? scheduledAt.toTimeString().slice(0, 5) : null,
            status: a.status || "scheduled",
          };
        });
        setAppointments(transformed);
        setLoading(false);
      });
  }, [api, residents, reloadKey]);

  return (
    <div>
      {loading && <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>Loading appointments…</div>}
      <CalendarSection
        appointments={appointments}
        residents={residents}
        api={api}
        onEventCreated={() => setReloadKey(k => k + 1)}
      />
    </div>
  );
}

// ─── SECTION: NOTIFICATIONS ───────────────────────────────────────────────────
// Gmail-style inbox: list rows with category icons, unread bolding, a left accent
// rail, and actions that reveal on hover (timestamp swaps out for the buttons).
const NOTIF_META = {
  care_plan_needed: { Icon: ClipboardList, color: "var(--admin-accent)",    tint: "var(--admin-accent-soft)" },
  facility_event:   { Icon: Megaphone,     color: "var(--admin-info)",       tint: "var(--admin-info-bg)" },
  admission:        { Icon: Inbox,         color: "var(--admin-info)",       tint: "var(--admin-info-bg)" },
  default:          { Icon: Bell,          color: "var(--admin-text-soft)",  tint: "var(--admin-canvas)" },
};

const notifIconBtn = {
  width: 30, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center",
  background: "transparent", border: "1px solid transparent", borderRadius: 7,
  color: "var(--admin-text-soft)", cursor: "pointer",
};

function relTime(iso) {
  if (!iso) return "Just now";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60)      return "Just now";
  if (diff < 3600)    return `${Math.floor(diff / 60)}m`;
  if (diff < 86400)   return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800)  return `${Math.floor(diff / 86400)}d`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function NotificationRow({ n, onMarkRead, onDismiss, primaryAction }) {
  const [hover, setHover] = useState(false);
  const meta   = NOTIF_META[n.type] || NOTIF_META.default;
  const Icon   = meta.Icon;
  const unread = !n.is_read;
  const title  = n.title || n.subject || "Notification";
  const body   = n.body || n.message || "";
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 13, padding: "13px 16px 13px 17px",
        borderBottom: "1px solid var(--admin-border-soft)",
        background: hover ? "var(--admin-canvas)" : "var(--admin-paper)",
        boxShadow: hover ? "var(--admin-shadow-sm)" : "none",
        position: "relative", transition: "background 0.12s ease",
      }}
    >
      {unread && <span aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: meta.color }} />}
      <div style={{ width: 38, height: 38, borderRadius: "50%", background: meta.tint, color: meta.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={17} strokeWidth={1.9} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          {unread && <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", background: meta.color, flexShrink: 0 }} />}
          <span style={{ fontSize: 14, fontWeight: unread ? 700 : 500, color: C.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</span>
        </div>
        {body && <div style={{ fontSize: 12.5, color: unread ? C.text : C.muted, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{body}</div>}
      </div>
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
        {primaryAction}
        {hover ? (
          <div style={{ display: "flex", gap: 4 }}>
            {unread && onMarkRead && (
              <button
                onClick={onMarkRead} title="Mark as read" aria-label="Mark as read" style={notifIconBtn}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--admin-paper)"; e.currentTarget.style.borderColor = "var(--admin-border)"; e.currentTarget.style.color = "var(--admin-accent)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.color = "var(--admin-text-soft)"; }}
              ><Check size={15} strokeWidth={2.2} /></button>
            )}
            {onDismiss && (
              <button
                onClick={onDismiss} title="Dismiss" aria-label="Dismiss" style={notifIconBtn}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--admin-paper)"; e.currentTarget.style.borderColor = "var(--admin-border)"; e.currentTarget.style.color = "var(--admin-text)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.color = "var(--admin-text-soft)"; }}
              ><Archive size={15} strokeWidth={1.9} /></button>
            )}
          </div>
        ) : (
          <span style={{ fontSize: 11.5, color: C.muted, fontWeight: 600, whiteSpace: "nowrap", minWidth: 40, textAlign: "right" }}>{relTime(n.created_at)}</span>
        )}
      </div>
    </div>
  );
}

function NotificationsSection({ api }) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    api("/api/v1/notifications")
      .then(d => setItems(d.notifications || d.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [api]);

  const handleMarkAsRead = async (notificationId) => {
    try {
      await api("/api/v1/notifications", {
        method: "PUT",
        body: JSON.stringify({ notificationId, action: "read" }),
      });
      setItems(prev => prev.map(n => n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n));
    } catch (err) {
    }
  };

  const handleDismiss = async (notificationId) => {
    try {
      await api("/api/v1/notifications", {
        method: "PUT",
        body: JSON.stringify({ notificationId, action: "dismiss" }),
      });
      setItems(prev => prev.filter(n => n.id !== notificationId));
    } catch (err) {
    }
  };

  const carePlanNotifications = items.filter(n => n.type === 'care_plan_needed');
  const otherNotifications = items.filter(n => n.type !== 'care_plan_needed');

  const unreadCount = otherNotifications.filter(n => !n.is_read).length + carePlanNotifications.length;
  const groupLabel = {
    padding: "9px 16px", background: "var(--admin-canvas)",
    borderBottom: "1px solid var(--admin-border-soft)",
    fontSize: 11, fontWeight: 700, color: C.muted,
    textTransform: "uppercase", letterSpacing: "0.07em",
  };

  return (
    <div>
      <div style={{ marginBottom: 20, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: "var(--font-fraunces), Georgia, serif", fontSize: 22, fontWeight: 500, color: C.navy, margin: 0, letterSpacing: "-0.01em" }}>Notifications</h2>
          <div style={{ fontSize: 12.5, color: C.muted, marginTop: 3 }}>System alerts and staff notifications</div>
        </div>
        {!loading && unreadCount > 0 && (
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--admin-accent)", background: "var(--admin-accent-soft)", padding: "5px 12px", borderRadius: 999, whiteSpace: "nowrap" }}>
            {unreadCount} unread
          </span>
        )}
      </div>
      {loading
        ? <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: 32, textAlign: "center", color: C.muted, boxShadow: "0 1px 3px rgba(15,23,42,0.05)" }}>Loading…</div>
        : items.length === 0
          ? <EmptyState title="No notifications" Icon={Bell} desc="System notifications will appear here." />
          : (
            <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 3px rgba(15,23,42,0.05)" }}>
              {carePlanNotifications.length > 0 && (
                <>
                  <div style={groupLabel}>Care Plans Needed · {carePlanNotifications.length}</div>
                  {carePlanNotifications.map((n) => (
                    <NotificationRow
                      key={n.id}
                      n={n}
                      onDismiss={() => handleDismiss(n.id)}
                      primaryAction={
                        <button
                          onClick={() => n.relatedResidentId && router.push(`/care-plan?residentId=${n.relatedResidentId}`)}
                          disabled={!n.relatedResidentId}
                          style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 13px", background: "var(--admin-accent)", border: "none", borderRadius: 999, color: "#fff", fontSize: 12, fontWeight: 600, cursor: n.relatedResidentId ? "pointer" : "default", opacity: n.relatedResidentId ? 1 : 0.5, whiteSpace: "nowrap" }}
                        >
                          Create Plan
                        </button>
                      }
                    />
                  ))}
                </>
              )}

              {otherNotifications.length > 0 && (
                <>
                  <div style={groupLabel}>{carePlanNotifications.length > 0 ? "Other" : "All Notifications"}</div>
                  {otherNotifications.map((n) => (
                    <NotificationRow
                      key={n.id}
                      n={n}
                      onMarkRead={() => handleMarkAsRead(n.id)}
                      onDismiss={() => handleDismiss(n.id)}
                    />
                  ))}
                </>
              )}
            </div>
          )
      }
    </div>
  );
}

// ─── SECTION: REPORTS HUB ─────────────────────────────────────────────────────

// Form schemas defining which fields to show for each form type
const FORM_SCHEMAS = {
  incidents: {
    label: "Incident Report",
    fields: [
      { key: 'incident_date', label: 'Date', type: 'text' },
      { key: 'incident_types', label: 'Incident Types', type: 'text' },
      { key: 'body_areas_injured', label: 'Body Areas Injured', type: 'text' },
      { key: 'witnessed_by', label: 'Witnesses', type: 'text' },
      { key: 'follow_up_plan', label: 'Follow-up Plan', type: 'text' },
    ]
  },
  drug: {
    label: "Drug Disposal Record",
    fields: [
      { key: 'disposal_date', label: 'Date', type: 'text' },
      { key: 'medication_name', label: 'Medication Name', type: 'text' },
      { key: 'disposal_method', label: 'Disposal Method', type: 'text' },
      { key: 'controlled_substance', label: 'Controlled Substance', type: 'text' },
    ]
  },
  evacuation: {
    label: "Evacuation Drill",
    fields: [
      { key: 'drill_date', label: 'Drill Date', type: 'text' },
      { key: 'drill_time', label: 'Time', type: 'text' },
      { key: 'time_taken', label: 'Time Taken (minutes)', type: 'text' },
      { key: 'residents_present', label: 'Residents Present', type: 'text' },
      { key: 'issues_encountered', label: 'Issues Encountered', type: 'text' },
    ]
  },
  progress: {
    label: "Progress Note",
    fields: [
      { key: 'note_date', label: 'Date', type: 'text' },
      { key: 'shift', label: 'Shift', type: 'text' },
      { key: 'resident_name', label: 'Resident Name', type: 'text' },
      { key: 'note_body', label: 'Note', type: 'text' },
    ]
  }
};

function FormReviewModal({ form, formType, onApprove, onReject, onClose, isLoading = false, error = '' }) {
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!form) return null;

  const schema = FORM_SCHEMAS[formType];
  const formTitle = schema?.label || 'Form Review';

  const handleApprove = async () => {
    setSubmitting(true);
    try {
      await onApprove(form.id, formType, notes);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    setSubmitting(true);
    try {
      await onReject(form.id, formType, notes);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 45, 94, 0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ background: C.bg, borderRadius: 12, width: 'min(680px, 95vw)', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: C.navy, padding: '16px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '12px 12px 0 0', flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Review {formTitle}</div>
          <button onClick={onClose} disabled={submitting} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, color: '#fff', cursor: submitting ? 'default' : 'pointer', fontSize: 16, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: submitting ? 0.5 : 1 }}>✕</button>
        </div>

        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          {/* Form-specific fields display */}
          <div style={{ background: C.white, border: `1px solid ${C.blueBorder}`, borderRadius: 8, padding: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Form Details</div>
            <Grid cols={schema?.fields?.length > 2 ? 2 : 1}>
              {schema?.fields?.map(field => {
                const value = form[field.key];
                const displayValue = Array.isArray(value) ? value.join(', ') : (typeof value === 'object' ? JSON.stringify(value) : value);
                return (
                  <F key={field.key} label={field.label}>
                    <TI value={displayValue || '—'} readOnly={true} />
                  </F>
                );
              })}
              <F label="Submitted By">
                <TI value={`${form.staff_first_name || ''} ${form.staff_last_name || ''}`.trim() || '—'} readOnly={true} />
              </F>
              <F label="Resident">
                <TI value={`${form.first_name || ''} ${form.last_name || ''}`.trim() || '—'} readOnly={true} />
              </F>
            </Grid>
          </div>

          {/* Review notes textarea */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ ...lbl, marginBottom: 8 }}>Review Notes (Optional)</label>
            <TA value={notes} onChange={setNotes} placeholder={`Add approval or rejection notes for this ${formTitle.toLowerCase()}...`} rows={4} />
          </div>

          {/* Error message if present */}
          {error && (
            <div style={{ background: C.redBg, border: `1px solid ${C.red}`, borderRadius: 6, padding: '10px 12px', marginBottom: 16, color: C.red, fontSize: 13 }}>
              {error}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ borderTop: `1px solid ${C.border}`, padding: '16px 24px', display: 'flex', gap: 12, justifyContent: 'flex-end', background: C.white, flexShrink: 0 }}>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{ padding: '9px 18px', border: `1px solid ${C.border}`, borderRadius: 7, background: C.white, cursor: submitting ? 'default' : 'pointer', fontSize: 13, fontWeight: 600, color: C.text, opacity: submitting ? 0.5 : 1 }}
          >
            Cancel
          </button>
          <button
            onClick={handleReject}
            disabled={submitting}
            style={{ padding: '9px 18px', border: 'none', borderRadius: 7, background: C.red, color: '#fff', cursor: submitting ? 'default' : 'pointer', fontSize: 13, fontWeight: 600, opacity: submitting ? 0.7 : 1 }}
          >
            {submitting ? 'Processing...' : 'Reject'}
          </button>
          <button
            onClick={handleApprove}
            disabled={submitting}
            style={{ padding: '9px 18px', border: 'none', borderRadius: 7, background: C.green, color: '#fff', cursor: submitting ? 'default' : 'pointer', fontSize: 13, fontWeight: 600, opacity: submitting ? 0.7 : 1 }}
          >
            {submitting ? 'Processing...' : 'Approve'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReportsSection() {
  const router = useRouter();
  const { auth } = useAuth();
  const [tab, setTab] = useState('incidents');
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedForm, setSelectedForm] = useState(null);
  const [modalError, setModalError] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [formCounts, setFormCounts] = useState({});
  const [loadingCounts, setLoadingCounts] = useState(true);

  useEffect(() => {
    if (!auth) return;
    setLoadingCounts(true);
    const formTypes = ['nursing-assessment', 'pre-screening', 'advance-directive', 'care-plans', 'face-sheets', 'daily-progress-notes', 'incidents', 'drug-disposal', 'evacuation-drills'];
    Promise.all(formTypes.map(type =>
      fetch(`/api/v1/admin/forms-history/${type}?limit=1`, { headers: { Authorization: `Bearer ${auth.accessToken}` } })
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then(d => ({ type, count: d.total || 0 }))
        .catch(() => ({ type, count: 0 }))
    )).then(results => {
      const counts = {};
      results.forEach(({ type, count }) => { counts[type] = count; });
      setFormCounts(counts);
      setLoadingCounts(false);
    });
  }, [auth]);

  useEffect(() => {
    if (!auth) return;

    const fetchForms = async () => {
      setLoading(true);
      try {
        const endpoints = {
          incidents: '/api/v1/incidents',
          drug: '/api/v1/drug-disposal',
          evacuation: '/api/v1/evacuation-drills',
          progress: '/api/v1/daily-progress-notes',
        };

        const endpoint = endpoints[tab];
        const response = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${auth.accessToken}` },
        });

        if (response.ok) {
          const data = await response.json();
          const key = tab === 'incidents' ? 'incidents' : tab === 'drug' ? 'records' : tab === 'evacuation' ? 'drills' : 'notes';
          setForms(data[key] || []);
        }
      } catch (err) {
      } finally {
        setLoading(false);
      }
    };

    fetchForms();
  }, [tab, auth]);

  const endpoints = {
    incidents: '/api/v1/incidents',
    drug: '/api/v1/drug-disposal',
    evacuation: '/api/v1/evacuation-drills',
    progress: '/api/v1/daily-progress-notes',
  };

  const handleApprove = async (formId, formType, reviewNotes) => {
    setModalError('');
    setIsSubmittingReview(true);
    try {
      const endpoint = endpoints[formType];
      const response = await fetch(`${endpoint}/${formId}/review`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.accessToken}`,
        },
        body: JSON.stringify({ status: 'approved', notes: reviewNotes || null }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to approve form');
      }

      setForms(forms.map(f => f.id === formId ? { ...f, review_status: 'approved' } : f));
      setSelectedForm(null);
    } catch (err) {
      setModalError(err.message || 'Error approving form. Please try again.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleReject = async (formId, formType, reviewNotes) => {
    setModalError('');
    setIsSubmittingReview(true);
    try {
      const endpoint = endpoints[formType];
      const response = await fetch(`${endpoint}/${formId}/review`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.accessToken}`,
        },
        body: JSON.stringify({ status: 'rejected', notes: reviewNotes || null }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reject form');
      }

      setForms(forms.map(f => f.id === formId ? { ...f, review_status: 'rejected' } : f));
      setSelectedForm(null);
    } catch (err) {
      setModalError(err.message || 'Error rejecting form. Please try again.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const getBadgeColor = (status) => {
    return status === 'pending' ? '#fffbeb' : status === 'approved' ? '#e6f4ea' : '#fce8e8';
  };

  const getBadgeTextColor = (status) => {
    return status === 'pending' ? '#b45309' : status === 'approved' ? C.green : '#dc2626';
  };

  const tabs = [
    { key: 'incidents', label: 'Incident Reports' },
    { key: 'drug', label: 'Drug Disposal' },
    { key: 'evacuation', label: 'Evacuation Drills' },
    { key: 'progress', label: 'Progress Notes' },
  ];

  const reportCategories = [
    { id: 'admissions', label: 'Admission Forms' },
    { id: 'care', label: 'Care Planning' },
    { id: 'staff_reports', label: 'Staff Reports' },
    { id: 'facility', label: 'Facility Records' },
  ];

  const formTypesHub = [
    { id: 'nursing-assessment', category: 'admissions', label: 'Nursing Assessment', Icon: ClipboardList },
    { id: 'pre-screening', category: 'admissions', label: 'Pre-Screening', Icon: FileText },
    { id: 'advance-directive', category: 'admissions', label: 'Advance Directive', Icon: Scroll },
    { id: 'care-plans', category: 'care', label: 'Care Plans', Icon: Scroll },
    { id: 'face-sheets', category: 'care', label: 'Face Sheets', Icon: FileText },
    { id: 'daily-progress-notes', category: 'staff_reports', label: 'Progress Notes', Icon: NotebookPen },
    { id: 'incidents', category: 'staff_reports', label: 'Incidents', Icon: AlertTriangle },
    { id: 'drug-disposal', category: 'staff_reports', label: 'Drug Disposal', Icon: Pill },
    { id: 'evacuation-drills', category: 'facility', label: 'Evacuation Drills', Icon: DoorOpen },
  ];

  return (
    <div>
      {selectedForm && (
        <FormReviewModal
          form={selectedForm}
          formType={tab}
          onApprove={handleApprove}
          onReject={handleReject}
          onClose={() => { setSelectedForm(null); setModalError(''); }}
          isLoading={isSubmittingReview}
          error={modalError}
        />
      )}

      {/* Forms History Hub */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--admin-text)', margin: 0 }}>Forms History</h2>
          <div style={{ fontSize: 12, color: 'var(--admin-text-soft)', marginTop: 3 }}>View all submitted forms, download as PDF, and manage submissions</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {formTypesHub.map(ft => {
            const Icon = ft.Icon;
            return (
              <Link
                key={ft.id}
                href={`/admin/reports/${ft.id}`}
                style={{
                  background: 'var(--admin-paper)',
                  border: '1px solid var(--admin-border)',
                  borderRadius: 12,
                  padding: '24px 20px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textAlign: 'center',
                  textDecoration: 'none',
                  display: 'block',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--admin-accent)';
                  e.currentTarget.style.boxShadow = '0 8px 16px rgba(26,56,219,0.12)';
                  e.currentTarget.style.transform = 'translateY(-4px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--admin-border)';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
                  <Icon size={32} strokeWidth={1.5} color="var(--admin-text-soft)" />
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--admin-text)', marginBottom: 8 }}>{ft.label}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--admin-accent)', letterSpacing: '-0.01em' }}>
                  {loadingCounts ? '—' : (formCounts[ft.id] || 0)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--admin-text-soft)', marginTop: 8 }}>
                  {loadingCounts ? 'Loading...' : `${formCounts[ft.id] || 0} form${(formCounts[ft.id] || 0) !== 1 ? 's' : ''}`}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--admin-border)', margin: '32px 0' }} />

      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.navy, margin: 0 }}>Form Review & Approvals</h2>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>Review and approve submitted forms from staff</div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: `1px solid ${C.border}` }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '12px 16px',
              border: 'none',
              background: tab === t.key ? '#fff' : 'transparent',
              borderBottom: tab === t.key ? `3px solid ${C.blue}` : 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: tab === t.key ? 700 : 400,
              color: tab === t.key ? C.navy : C.muted,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Forms table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '24px', color: C.muted }}>Loading...</div>
      ) : forms.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px', color: C.muted }}>No submissions yet</div>
      ) : (
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f5f5f5', borderBottom: `1px solid ${C.border}` }}>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: C.muted }}>Date</th>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: C.muted }}>Resident / Details</th>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: C.muted }}>Submitted By</th>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: C.muted }}>Status</th>
                <th style={{ padding: '12px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: C.muted }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {forms.map((form, i) => (
                <tr
                  key={form.id}
                  style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? '#fff' : '#f9f9f9' }}
                >
                  <td style={{ padding: '12px', fontSize: 13 }}>
                    {form.incident_date || form.disposal_date || form.drill_date || form.note_date}
                  </td>
                  <td style={{ padding: '12px', fontSize: 13 }}>
                    {form.first_name} {form.last_name || '—'}
                  </td>
                  <td style={{ padding: '12px', fontSize: 13, color: C.muted }}>
                    {form.staff_first_name || '—'} {form.staff_last_name || ''}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 8px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      background: getBadgeColor(form.review_status),
                      color: getBadgeTextColor(form.review_status),
                      textTransform: 'uppercase',
                    }}>
                      {form.review_status}
                    </span>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    {form.review_status === 'pending' && (
                      <button
                        onClick={() => setSelectedForm(form)}
                        style={{ padding: '4px 12px', border: `1px solid ${C.blue}`, background: C.bluePale, color: C.blue, borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                      >
                        Review
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── SECTION: ANNOUNCEMENTS ───────────────────────────────────────────────────
// Gmail-style announcement row: megaphone avatar, priority rail, badges, and
// Edit/Delete actions that reveal on hover (swapping out the timestamp).
function AnnouncementRow({ ann, onEdit, onDelete }) {
  const [hover, setHover] = useState(false);
  const pr = ann.priority;
  const urgent = pr === 'urgent', high = pr === 'high', low = pr === 'low';
  const tone = urgent || high
    ? { rail: C.red,  color: C.red,   tint: C.redBg }
    : low
      ? { rail: C.muted, color: C.muted, tint: "var(--admin-canvas)" }
      : { rail: C.blue, color: C.blue,  tint: C.bluePale };
  const badge = urgent ? "URGENT" : high ? "HIGH PRIORITY" : null;
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", gap: 13, padding: "14px 16px 14px 17px",
        borderBottom: "1px solid var(--admin-border-soft)",
        background: hover ? "var(--admin-canvas)" : "var(--admin-paper)",
        boxShadow: hover ? "var(--admin-shadow-sm)" : "none",
        position: "relative", transition: "background 0.12s ease",
      }}
    >
      <span aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: tone.rail }} />
      <div style={{ width: 38, height: 38, borderRadius: "50%", background: tone.tint, color: tone.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Megaphone size={17} strokeWidth={1.9} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 5, flexWrap: "wrap", alignItems: "center" }}>
          {badge && <span style={{ background: tone.tint, color: tone.color, padding: "2px 9px", borderRadius: 999, fontSize: 10, fontWeight: 700, letterSpacing: "0.04em" }}>{badge}</span>}
          {ann.audience && <span style={{ background: C.bluePale, color: C.blue, padding: "2px 9px", borderRadius: 999, fontSize: 10, fontWeight: 700 }}>→ {ann.audience.charAt(0).toUpperCase() + ann.audience.slice(1)}</span>}
          {!ann.active && <span style={{ background: C.draftBg, color: C.draft, padding: "2px 9px", borderRadius: 999, fontSize: 10, fontWeight: 700 }}>INACTIVE</span>}
        </div>
        <div style={{ fontWeight: 700, color: C.navy, fontSize: 14, marginBottom: 3 }}>{ann.title}</div>
        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.55, marginBottom: 7, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{ann.body}</div>
        <div style={{ fontSize: 11, color: C.muted }}>
          {ann.published_at ? new Date(ann.published_at).toLocaleDateString("en-US") : "—"}
          {ann.author_first_name && <> · {ann.author_first_name} {ann.author_last_name}</>}
          {ann.expires_at && <> · Expires {new Date(ann.expires_at).toLocaleDateString("en-US")}</>}
        </div>
      </div>
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
        {hover ? (
          <div style={{ display: "flex", gap: 4 }}>
            <button
              onClick={() => onEdit(ann)} title="Edit" aria-label="Edit" style={notifIconBtn}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--admin-paper)"; e.currentTarget.style.borderColor = "var(--admin-border)"; e.currentTarget.style.color = "var(--admin-accent)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.color = "var(--admin-text-soft)"; }}
            ><Pencil size={15} strokeWidth={1.9} /></button>
            <button
              onClick={() => onDelete(ann.id)} title="Delete" aria-label="Delete" style={notifIconBtn}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--admin-danger-bg)"; e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.color = "var(--admin-danger)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.color = "var(--admin-text-soft)"; }}
            ><Trash2 size={15} strokeWidth={1.9} /></button>
          </div>
        ) : (
          <span style={{ fontSize: 11.5, color: C.muted, fontWeight: 600, whiteSpace: "nowrap", minWidth: 56, textAlign: "right" }}>
            {ann.published_at ? relTime(ann.published_at) : "Draft"}
          </span>
        )}
      </div>
    </div>
  );
}

function AnnouncementsSection() {
  const { auth } = useAuth();
  const [list, setList]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [showNew, setShowNew]   = useState(false);
  const [editing, setEditing]   = useState(null); // announcement being edited
  const [form, setForm]         = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState('');
  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const fetchList = useCallback(async () => {
    if (!auth) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/announcements?limit=100', {
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
  }, [auth]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const openNew = () => {
    setEditing(null);
    setForm({ title: '', body: '', audience: 'staff', priority: 'normal' });
    setFormError('');
    setShowNew(true);
  };

  const openEdit = (ann) => {
    setEditing(ann);
    setForm({ title: ann.title, body: ann.body, audience: ann.audience, priority: ann.priority });
    setFormError('');
    setShowNew(true);
  };

  const handleSubmit = async () => {
    if (!form.title || !form.body) { setFormError('Title and message are required.'); return; }
    setSubmitting(true);
    setFormError('');
    try {
      const url = editing ? `/api/v1/announcements/${editing.id}` : '/api/v1/announcements';
      const method = editing ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.accessToken}` },
        credentials: 'same-origin',
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save announcement');
      setShowNew(false);
      setEditing(null);
      setForm({});
      fetchList();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this announcement?')) return;
    try {
      await fetch(`/api/v1/announcements/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${auth.accessToken}` },
        credentials: 'same-origin',
      });
      setList(prev => prev.filter(a => a.id !== id));
    } catch { /* silent */ }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20, gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: "var(--font-fraunces), Georgia, serif", fontSize: 22, fontWeight: 500, color: C.navy, margin: 0, letterSpacing: "-0.01em" }}>Announcements</h2>
          <div style={{ fontSize: 12.5, color: C.muted, marginTop: 3 }}>Notices to staff and/or residents</div>
        </div>
        <button
          onClick={openNew}
          style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 18px 10px 15px", background: "var(--admin-accent)", border: "none", borderRadius: 999, color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer", boxShadow: "0 1px 2px rgba(5,150,105,0.28)" }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 3px 8px rgba(5,150,105,0.3)"; }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 1px 2px rgba(5,150,105,0.28)"; }}
        >
          <Plus size={15} strokeWidth={2.3} /> New Announcement
        </button>
      </div>

      {loading ? (
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: 32, textAlign: "center", color: C.muted, boxShadow: "0 1px 3px rgba(15,23,42,0.05)" }}>Loading announcements…</div>
      ) : error ? (
        <div style={{ background: C.redBg, border: `1px solid ${C.red}`, borderRadius: 10, padding: "14px 18px", color: C.red, fontSize: 13 }}>Failed to load: {error}</div>
      ) : list.length === 0 ? (
        <EmptyState title='No announcements yet' Icon={Megaphone} desc='Click "New Announcement" to send a notice to staff or residents.' />
      ) : (
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 3px rgba(15,23,42,0.05)" }}>
          {list.map(ann => (
            <AnnouncementRow key={ann.id} ann={ann} onEdit={openEdit} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {showNew && (
        <Modal title={editing ? "Edit Announcement" : "New Announcement"} onClose={() => { setShowNew(false); setEditing(null); setForm({}); }}>
          <Grid cols={2}>
            <F label="Send To">
              <Sel value={form.audience || 'staff'} onChange={v => setF("audience", v)} options={[{value:"staff",label:"Staff"},{value:"residents",label:"Residents"},{value:"family",label:"Family"},{value:"all",label:"All"}]} />
            </F>
            <F label="Priority">
              <Sel value={form.priority || 'normal'} onChange={v => setF("priority", v)} options={[{value:"low",label:"Low"},{value:"normal",label:"Normal"},{value:"high",label:"High"},{value:"urgent",label:"Urgent"}]} />
            </F>
            <F label="Title" span={2}><TI value={form.title} onChange={v => setF("title", v)} placeholder="Announcement title" /></F>
            <F label="Message" span={2}><TA value={form.body} onChange={v => setF("body", v)} placeholder="Write your announcement..." rows={5} /></F>
            <F label="Expires At (optional)"><TI type="date" value={form.expires_at || ''} onChange={v => setF("expires_at", v)} /></F>
          </Grid>
          {formError && <div style={{ marginTop: 12, background: C.redBg, border: `1px solid ${C.red}`, borderRadius: 6, padding: "10px 12px", color: C.red, fontSize: 13 }}>{formError}</div>}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
            <button onClick={() => { setShowNew(false); setEditing(null); setForm({}); }} disabled={submitting} style={{ padding: "9px 18px", background: C.white, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, cursor: "pointer", color: C.muted }}>Cancel</button>
            <button onClick={handleSubmit} disabled={submitting || !form.title || !form.body} style={{ padding: "9px 22px", background: "var(--admin-accent)", border: "none", borderRadius: 999, color: "var(--admin-paper)", fontWeight: 600, fontSize: 13, cursor: submitting ? "default" : "pointer", opacity: submitting || !form.title || !form.body ? 0.6 : 1 }}>{submitting ? "Saving…" : (editing ? "Save Changes" : "Publish")}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── SECTION: CARE PLANS ─────────────────────────────────────────────────────

const CP_STATUS_MAP = {
  active:   { bg: C.greenBg,     color: C.green,     label: "Active"        },
  approved: { bg: C.approvedBg,  color: C.approved,  label: "Approved"      },
  expiring: { bg: C.amberBg,     color: C.amber,     label: "Expiring Soon" },
  draft:    { bg: C.draftBg,     color: C.draft,     label: "Draft"         },
  expired:  { bg: C.redBg,       color: C.red,       label: "Expired"       },
  rejected: { bg: C.rejectedBg,  color: C.rejected,  label: "Rejected"      },
};

function CarePlansSection({ api, residents }) {
  const router = useRouter();
  const { auth } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewingPlan, setViewingPlan] = useState(null);
  const [viewingPlanDetail, setViewingPlanDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showResidentSelector, setShowResidentSelector] = useState(false);
  const [selectedResident, setSelectedResident] = useState(null);

  useEffect(() => {
    if (!api) return;
    const fetchPlans = async () => {
      try {
        setLoading(true);
        // Try to fetch from care plans list endpoint
        const result = await api("/api/v1/care-plans?limit=100").catch(() => ({ data: [] }));
        const data = result.data || result.care_plans || [];
        // Transform API data to match section's expected format
        const transformed = data.map(p => {
          const resident = residents.find(r => r.id === p.resident_id);
          // Map goal_N_statement fields to goals array
          const goals = [
            p.goal1_statement && { goal: p.goal1_statement, objectives: [] },
            p.goal2_statement && { goal: p.goal2_statement, objectives: [] },
            p.goal3_statement && { goal: p.goal3_statement, objectives: [] },
          ].filter(Boolean);
          // Map selected_domains (integer array) to domain strings
          const domains = Array.isArray(p.selected_domains)
            ? p.selected_domains.map(d => {
                const domain = LIFE_DOMAINS.find(ld => ld.id === d);
                return domain ? domain.label : String(d);
              })
            : [];
          return {
            planId: p.id,
            residentName: p.resident_name || (resident ? `${resident.first_name} ${resident.last_name}` : "Unknown"),
            initials: (p.first_name?.[0] || resident?.first_name?.[0] || "") + (p.last_name?.[0] || resident?.last_name?.[0] || ""),
            diagnosis: p.primary_diagnosis || resident?.primary_diagnosis || "—",
            status: p.status || "draft",
            effectiveDate: p.effective_date,
            reviewDate: p.review_date || p.expiration_date,
            counselor: p.primary_counselor_name || "—",
            legalStatus: resident?.legal_status || "—",
            lastUpdated: p.updated_at ? new Date(p.updated_at).toLocaleDateString("en-US") : "—",
            domains,
            goals,
            safetyPlan: p.crisis_warning_signs || "—",
          };
        });
        setPlans(transformed);
      } catch (err) {
        setPlans([]);
      } finally {
        setLoading(false);
      }
    };
    fetchPlans();
  }, [api, residents]);

  const activeCt   = plans.filter(p => p.status === "active").length;
  const draftCt    = plans.filter(p => p.status === "draft").length;
  const expiringCt = plans.filter(p => p.status === "expiring").length;

  if (loading) {
    return (
      <div>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: C.navy, margin: 0 }}>Care Plans</h2>
        </div>
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: 32, textAlign: "center", color: C.muted }}>Loading care plans…</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: C.navy, margin: 0 }}>Care Plans</h2>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>Person-centered service plans — OAR 309-019</div>
        </div>
        <button onClick={() => setShowResidentSelector(true)} style={{ padding: "9px 18px", background: C.purple, border: "none", borderRadius: 8, color: "var(--admin-paper)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>+ New Care Plan</button>
      </div>

      {expiringCt > 0 && (
        <div style={{ background: C.amberBg, border: `1px solid #fde68a`, borderRadius: 10, padding: "12px 18px", marginBottom: 18, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.amber }}>{expiringCt} care plan{expiringCt !== 1 ? "s" : ""} expiring within 30 days — review and renewal required</div>
            <div style={{ fontSize: 12, color: "var(--admin-warning)", marginTop: 2 }}>Complete plan reviews per OAR 309-019 compliance requirements.</div>
          </div>
        </div>
      )}

      <StatCards stats={[
        { label: "Total Plans",   value: plans.length, color: C.navy    },
        { label: "Active",        value: activeCt,     color: C.green   },
        { label: "Expiring Soon", value: expiringCt,   color: C.amber   },
        { label: "Draft",         value: draftCt,      color: "#6b7280" },
      ]} />

      <div style={{ display: "grid", gap: 14 }}>
        {plans.map(plan => {
          const st = CP_STATUS_MAP[plan.status] || CP_STATUS_MAP.draft;
          return (
            <div key={plan.planId} style={{ background: C.white, border: `1.5px solid ${plan.status === "expiring" ? "#fde68a" : C.border}`, borderRadius: 12, overflow: "hidden" }}>
              {/* Card header */}
              <div style={{ background: C.bluePale, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${C.blueBorder}` }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.navy, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "var(--admin-paper)", flexShrink: 0 }}>{plan.initials}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: C.navy, fontSize: 15 }}>{plan.residentName}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{plan.diagnosis}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ background: st.bg, color: st.color, padding: "3px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{st.label}</span>
                  <div style={{ fontSize: 10, color: C.muted, textAlign: "right", lineHeight: 1.6 }}>
                    <div>Plan: {plan.planId}</div>
                    <div>Updated: {plan.lastUpdated}</div>
                  </div>
                </div>
              </div>

              {/* Card body */}
              <div style={{ padding: "14px 18px" }}>
                <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 12 }}>
                  {[
                    { label: "Effective",    value: plan.effectiveDate ? new Date(plan.effectiveDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Pending" },
                    { label: "Review Due",   value: plan.reviewDate ? new Date(plan.reviewDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Not set", warn: plan.status === "expiring" },
                    { label: "Counselor",    value: plan.counselor },
                    { label: "Legal Status", value: plan.legalStatus },
                  ].map(item => (
                    <div key={item.label} style={{ fontSize: 12 }}>
                      <span style={{ color: C.muted, fontWeight: 600 }}>{item.label}: </span>
                      <span style={{ color: item.warn ? C.amber : C.text, fontWeight: item.warn ? 700 : 400 }}>{item.value}</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                  {plan.domains.map(d => (
                    <span key={d} style={{ background: C.purpleBg, color: C.purple, padding: "2px 10px", borderRadius: 20, fontSize: 10, fontWeight: 600 }}>{d}</span>
                  ))}
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.navy, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 7 }}>Goals ({plan.goals.length})</div>
                  {plan.goals.slice(0, 2).map((g, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "flex-start" }}>
                      <div style={{ width: 18, height: 18, borderRadius: "50%", background: C.bluePale, border: `1px solid ${C.blueBorder}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: C.blue, flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
                      <div style={{ fontSize: 12, color: C.text, lineHeight: 1.5, flex: 1 }}>{g.goal.length > 95 ? g.goal.slice(0, 95) + "…" : g.goal}</div>
                    </div>
                  ))}
                  {plan.goals.length > 2 && <div style={{ fontSize: 11, color: C.muted, marginLeft: 26 }}>+{plan.goals.length - 2} more goal{plan.goals.length - 2 !== 1 ? "s" : ""}…</div>}
                </div>

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                  <button onClick={async () => {
                    setViewingPlan(plan);
                    setLoadingDetail(true);
                    try {
                      const response = await fetch(`/api/v1/care-plans/${plan.planId}`, {
                        headers: { 'Authorization': `Bearer ${auth?.accessToken}` },
                        credentials: 'include'
                      });
                      if (response.ok) {
                        const { data } = await response.json();
                        setViewingPlanDetail(data);
                      }
                    } catch (err) {
                    } finally {
                      setLoadingDetail(false);
                    }
                  }} style={{ padding: "7px 16px", background: C.bluePale, border: `1px solid ${C.blueBorder}`, borderRadius: 7, color: C.blue, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>View All</button>
                  <button onClick={() => router.push(`/care-plan/edit/${plan.planId}`)} style={{ padding: "7px 16px", background: C.navy, border: "none", borderRadius: 7, color: "var(--admin-paper)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Edit Plan</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {plans.length === 0 && (
        <EmptyState title="No care plans yet" icon="◈" desc="Create the first care plan to get started." />
      )}

      {viewingPlan && (
        <Modal title={`Care Plan — ${viewingPlan.residentName}`} onClose={() => setViewingPlan(null)} wide>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 20 }}>
            {[
              { label: "Plan ID",      value: viewingPlan.planId },
              { label: "Status",       value: <span style={{ background: CP_STATUS_MAP[viewingPlan.status]?.bg, color: CP_STATUS_MAP[viewingPlan.status]?.color, padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{CP_STATUS_MAP[viewingPlan.status]?.label}</span> },
              { label: "Effective",    value: viewingPlan.effectiveDate ? new Date(viewingPlan.effectiveDate + "T12:00:00").toLocaleDateString("en-US") : "Pending" },
              { label: "Review Due",   value: viewingPlan.reviewDate ? new Date(viewingPlan.reviewDate + "T12:00:00").toLocaleDateString("en-US") : "Not set" },
              { label: "Counselor",    value: viewingPlan.counselor },
              { label: "Legal Status", value: viewingPlan.legalStatus },
              { label: "Last Updated", value: viewingPlan.lastUpdated },
            ].map(item => (
              <div key={item.label} style={{ minWidth: 110 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{item.label}</div>
                <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{item.value}</div>
              </div>
            ))}
          </div>

          <SH>Diagnosis &amp; Life Domains</SH>
          <div style={{ fontSize: 13, color: C.text, marginBottom: 10, fontWeight: 600 }}>{viewingPlan.diagnosis}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
            {viewingPlan.domains.map(d => (
              <span key={d} style={{ background: C.purpleBg, color: C.purple, padding: "3px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{d}</span>
            ))}
          </div>

          <SH>Recovery Goals &amp; Objectives</SH>
          <div style={{ display: "grid", gap: 14, marginBottom: 20 }}>
            {viewingPlan.goals.map((g, i) => (
              <div key={i} style={{ background: C.bg, border: `1px solid ${C.blueBorder}`, borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: C.blue, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "var(--admin-paper)", flexShrink: 0 }}>G{i + 1}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, lineHeight: 1.5, flex: 1 }}>{g.goal}</div>
                </div>
                <div style={{ display: "grid", gap: 5, marginLeft: 32 }}>
                  {g.objectives.map((obj, j) => (
                    <div key={j} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ color: C.blue, fontSize: 13, marginTop: 0, flexShrink: 0 }}>→</span>
                      <span style={{ fontSize: 12, color: C.text, lineHeight: 1.5 }}>{obj}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <SH>Safety &amp; Risk Plan</SH>
          <div style={{ background: C.redBg, border: `1px solid #fca5a5`, borderRadius: 8, padding: "12px 14px", fontSize: 13, color: "#991b1b", lineHeight: 1.6, marginBottom: 20 }}>{viewingPlan.safetyPlan}</div>

          {viewingPlanDetail && (
            <>
              <SH>Complete Care Plan Details</SH>

              {viewingPlanDetail.crisisWarningSigns && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Crisis Warning Signs</div>
                  <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6, background: C.bg, padding: "12px 14px", borderRadius: 6 }}>{viewingPlanDetail.crisisWarningSigns}</div>
                </div>
              )}

              {viewingPlanDetail.suicideProtocol && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Suicide Prevention Protocol</div>
                  <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6, background: C.bg, padding: "12px 14px", borderRadius: 6 }}>{viewingPlanDetail.suicideProtocol}</div>
                </div>
              )}

              {viewingPlanDetail.dischargeHousing && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Discharge Housing Plan</div>
                  <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6, background: C.bg, padding: "12px 14px", borderRadius: 6 }}>{viewingPlanDetail.dischargeHousing}</div>
                </div>
              )}

              {viewingPlanDetail.communityResources && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Community Resources</div>
                  <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6, background: C.bg, padding: "12px 14px", borderRadius: 6 }}>{viewingPlanDetail.communityResources}</div>
                </div>
              )}

              {viewingPlanDetail.guardianship && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Guardianship Status</div>
                  <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6, background: C.bg, padding: "12px 14px", borderRadius: 6 }}>{viewingPlanDetail.guardianship}</div>
                </div>
              )}

              {viewingPlanDetail.advancedDirective && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Advanced Directive</div>
                  <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6, background: C.bg, padding: "12px 14px", borderRadius: 6 }}>{viewingPlanDetail.advancedDirective}</div>
                </div>
              )}
            </>
          )}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={() => { setViewingPlan(null); setViewingPlanDetail(null); }} style={{ padding: "9px 18px", background: C.white, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, cursor: "pointer", color: C.muted }}>Close</button>
            <button onClick={() => { setViewingPlan(null); setViewingPlanDetail(null); router.push(`/care-plan/edit/${viewingPlan.planId}`); }} style={{ padding: "9px 22px", background: C.navy, border: "none", borderRadius: 7, color: "var(--admin-paper)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Edit This Plan</button>
          </div>
        </Modal>
      )}

      {showResidentSelector && (
        <Modal onClose={() => { setShowResidentSelector(false); setSelectedResident(null); }}>
          <div style={{ width: 500, padding: 0 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: C.navy, margin: "0 0 20px 0" }}>Create New Care Plan</h3>

            {!selectedResident ? (
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.navy, marginBottom: 8 }}>Select Resident</label>
                <select
                  value=""
                  onChange={(e) => setSelectedResident(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    fontSize: 13,
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    background: C.white,
                    color: C.text,
                    cursor: "pointer",
                  }}
                >
                  <option value="">— Choose a resident —</option>
                  {residents
                    .filter(r => !r.deleted_at)
                    .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`))
                    .map(r => (
                      <option key={r.id} value={r.id}>
                        {r.first_name} {r.last_name} {r.medicaid_id ? `(${r.medicaid_id})` : ""}
                      </option>
                    ))}
                </select>
                <div style={{ marginTop: 20, display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button onClick={() => { setShowResidentSelector(false); setSelectedResident(null); }} style={{ padding: "9px 18px", background: C.white, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, cursor: "pointer", color: C.muted }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "14px 16px", marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Selected Resident</div>
                  {(() => {
                    const res = residents.find(r => r.id === selectedResident);
                    return res ? (
                      <>
                        <div style={{ fontSize: 15, fontWeight: 700, color: C.navy }}>{res.first_name} {res.last_name}</div>
                        {res.medicaid_id && <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>ID: {res.medicaid_id}</div>}
                        {res.primary_diagnosis && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Diagnosis: {res.primary_diagnosis}</div>}
                      </>
                    ) : null;
                  })()}
                </div>
                <div style={{ marginTop: 20, display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button onClick={() => setSelectedResident(null)} style={{ padding: "9px 18px", background: C.white, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, cursor: "pointer", color: C.muted }}>Change</button>
                  <button onClick={() => { setShowResidentSelector(false); setSelectedResident(null); router.push(`/care-plan?residentId=${selectedResident}`); }} style={{ padding: "9px 22px", background: C.purple, border: "none", borderRadius: 7, color: "var(--admin-paper)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Create Plan</button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── SECTION: APPOINTMENTS ───────────────────────────────────────────────────

const APPT_TYPES = {
  psychiatric: { label: "Psychiatric",  bg: C.purpleBg,  color: C.purple,   icon: "◈" },
  therapy:     { label: "Therapy",      bg: C.tealBg,    color: C.teal,     icon: "◈" },
  medical:     { label: "Medical",      bg: C.bluePale,  color: C.blue,     icon: "⬡" },
  lab:         { label: "Lab Work",     bg: C.amberBg,   color: C.amber,    icon: "◉" },
  dental:      { label: "Dental",       bg: C.greenBg,   color: C.green,    icon: "◉" },
  vision:      { label: "Vision",       bg: C.greenBg,     color: C.green,    icon: "◎" },
  community:   { label: "Community",    bg: C.purpleBg,    color: C.purple,   icon: "◎" },
  court:       { label: "Court",        bg: C.redBg,       color: C.red,      icon: "⚑" },
  vocational:  { label: "Vocational",   bg: C.cyanBg,      color: C.cyan,     icon: "◎" },
  other:       { label: "Other",        bg: C.draftBg,     color: C.draft,    icon: "◈" },
};

const APPT_STATUS_MAP = {
  scheduled:            { bg: C.cyanBg,     color: C.cyan,      label: "Scheduled"            },
  pending_confirmation: { bg: C.amberBg,    color: C.amber,     label: "Pending Confirmation" },
  completed:            { bg: C.greenBg,    color: C.green,     label: "Completed"            },
  approved:             { bg: C.approvedBg, color: C.approved,  label: "Approved"            },
  rejected:             { bg: C.rejectedBg, color: C.rejected,  label: "Rejected"            },
  cancelled:            { bg: C.cancelledBg, color: C.cancelled, label: "Cancelled"           },
  no_show:              { bg: C.draftBg,    color: C.draft,     label: "No Show"             },
};

function AppointmentsSection({ api, residents }) {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);
  const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewTab, setViewTab]           = useState("upcoming");
  const [filterType, setFilterType]     = useState("");
  const [filterResidentId, setFilterResidentId] = useState("");
  const [showAdd, setShowAdd]           = useState(false);
  const [recording, setRecording]       = useState(null);
  const [form, setForm]                 = useState({});
  const [recForm, setRecForm]           = useState({});
  const [addError, setAddError]         = useState('');
  const [addSubmitting, setAddSubmitting] = useState(false);
  const sf = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const rf = (k, v) => setRecForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!api) return;
    const fetchAppts = async () => {
      try {
        setLoading(true);
        const result = await api("/api/v1/appointments?limit=100").catch(() => ({ data: [] }));
        const data = result.data || result.appointments || [];
        const transformed = data.map(a => {
          const resident = residents.find(r => r.id === a.resident_id);
          const scheduledAt = a.scheduled_at ? new Date(a.scheduled_at) : null;
          return {
            id: a.id,
            residentId: a.resident_id,
            residentName: (a.first_name ? `${a.first_name} ${a.last_name}` : null) || (resident ? `${resident.first_name} ${resident.last_name}` : "Unknown"),
            residentInitials: (a.first_name?.[0] || resident?.first_name?.[0] || "") + (a.last_name?.[0] || resident?.last_name?.[0] || ""),
            type: a.appointment_type || "other",
            provider: a.title || a.staff_first_name ? `${a.staff_first_name || ''} ${a.staff_last_name || ''}`.trim() : "—",
            org: "",
            location: a.location || "—",
            date: scheduledAt ? scheduledAt.toISOString().slice(0, 10) : null,
            time: scheduledAt ? scheduledAt.toTimeString().slice(0, 5) : "00:00",
            duration: a.duration_minutes || 60,
            status: a.status || "scheduled",
            transportNeeded: false,
            staffEscort: false,
            purpose: a.description || a.notes || "",
            outcome: a.notes || null,
          };
        });
        setAppointments(transformed);
      } catch (err) {
        setAppointments([]);
      } finally {
        setLoading(false);
      }
    };
    fetchAppts();
  }, [api, residents]);

  const todayCt     = appointments.filter(a => a.date === today && (a.status === "scheduled" || a.status === "pending_confirmation")).length;
  const pendingCt   = appointments.filter(a => a.status === "pending_confirmation").length;
  const scheduledCt = appointments.filter(a => a.status === "scheduled" && a.date >= today).length;
  const weekCt      = appointments.filter(a => a.date >= today && a.date <= weekEndStr && a.status !== "cancelled").length;

  const filtered = appointments.filter(a => {
    const isPast = a.date < today || a.status === "completed" || a.status === "no_show" || a.status === "cancelled";
    const matchTab =
      viewTab === "all"      ? true :
      viewTab === "today"    ? a.date === today :
      viewTab === "upcoming" ? a.date >= today && !isPast :
      viewTab === "past"     ? isPast : true;
    return matchTab
      && (!filterType || a.type === filterType)
      && (!filterResidentId || a.residentId === filterResidentId);
  });

  const sorted = [...filtered].sort((a, b) => {
    const da = a.date + "T" + a.time, db = b.date + "T" + b.time;
    return viewTab === "past" ? db.localeCompare(da) : da.localeCompare(db);
  });

  const grouped = sorted.reduce((acc, a) => {
    (acc[a.date] = acc[a.date] || []).push(a);
    return acc;
  }, {});

  function fmtDate(d) {
    if (d === today)       return "Today";
    if (d === tomorrowStr) return "Tomorrow";
    return new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  }
  function fmtTime(t) {
    const [h, m] = t.split(":").map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
  }

  async function handleAdd() {
    if (!form.residentId || !form.type || !form.date || !form.time) return;
    setAddError('');
    setAddSubmitting(true);
    try {
      const scheduledAt = new Date(`${form.date}T${form.time}:00`).toISOString();
      // Map UI type to DB enum (medical, dental, social, family, other)
      const typeMap = { psychiatric: 'medical', therapy: 'medical', medical: 'medical', lab: 'medical', dental: 'dental', vision: 'medical', community: 'social', court: 'other', vocational: 'other', other: 'other' };
      const resident = residents.find(r => r.id === form.residentId);
      const residentName = resident ? `${resident.first_name} ${resident.last_name}` : '';
      const res = await api('/api/v1/appointments', {
        method: 'POST',
        body: JSON.stringify({
          resident_id: form.residentId,
          appointment_type: typeMap[form.type] || 'other',
          title: `${APPT_TYPES[form.type]?.label || 'Appointment'} — ${form.provider || 'Provider'}`,
          description: form.purpose || null,
          location: form.location || null,
          scheduled_at: scheduledAt,
          duration_minutes: parseInt(form.duration) || 60,
          status: form.apptStatus || 'scheduled',
          notes: form.purpose || null,
        }),
      });
      const initials = residentName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
      const scheduledDate = form.date;
      const scheduledTime = form.time;
      setAppointments(prev => [...prev, {
        id: res.data?.id || `A${Date.now()}`,
        residentName, residentInitials: initials,
        type: form.type, provider: form.provider || '—', org: form.org || "",
        location: form.location || "", date: scheduledDate, time: scheduledTime,
        duration: parseInt(form.duration) || 60,
        status: form.apptStatus || "scheduled",
        transportNeeded: form.transportNeeded === "true",
        staffEscort: form.staffEscort === "true",
        purpose: form.purpose || "", outcome: null,
      }]);
      setShowAdd(false); setForm({});
    } catch (err) {
      setAddError(err.message || 'Failed to create appointment');
    } finally {
      setAddSubmitting(false);
    }
  }

  async function confirmRecord() {
    if (!recording) return;
    try {
      await api(`/api/v1/appointments/${recording.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: recForm.status, notes: recForm.outcome || null }),
      });
    } catch { /* fall through — still update local state */ }
    setAppointments(prev => prev.map(a =>
      a.id === recording.id ? { ...a, status: recForm.status, outcome: recForm.outcome } : a
    ));
    setRecording(null);
  }

  if (loading) {
    return (
      <div>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: C.navy, margin: 0 }}>Appointments</h2>
        </div>
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: 32, textAlign: "center", color: C.muted }}>Loading appointments…</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: C.navy, margin: 0 }}>Appointments</h2>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>Medical, therapy, and community visits</div>
        </div>
        <button onClick={() => setShowAdd(true)} style={{ padding: "9px 18px", background: C.blue, border: "none", borderRadius: 8, color: "var(--admin-paper)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>+ Add Appointment</button>
      </div>

      <StatCards stats={[
        { label: "Today",                value: todayCt,     color: C.navy  },
        { label: "This Week",            value: weekCt,      color: C.blue  },
        { label: "Pending Confirmation", value: pendingCt,   color: C.amber },
        { label: "Total Scheduled",      value: scheduledCt, color: C.green },
      ]} />

      {pendingCt > 0 && (
        <div style={{ background: C.amberBg, border: `1px solid #fde68a`, borderRadius: 10, padding: "12px 18px", marginBottom: 18, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.amber }}>{pendingCt} appointment{pendingCt !== 1 ? "s" : ""} awaiting provider confirmation</div>
            <div style={{ fontSize: 12, color: "var(--admin-warning)", marginTop: 2 }}>Follow up with providers to confirm scheduling before transport is arranged.</div>
          </div>
          <button onClick={() => { setViewTab("all"); setFilterType(""); }} style={{ padding: "6px 14px", background: C.amber, border: "none", borderRadius: 6, color: "var(--admin-paper)", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>View All</button>
        </div>
      )}

      {/* Filters */}
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px", marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {[{k:"upcoming",l:"Upcoming"},{k:"today",l:"Today"},{k:"past",l:"Past"},{k:"all",l:"All"}].map(t => (
            <button key={t.k} onClick={() => setViewTab(t.k)} style={{
              padding: "5px 16px", border: `1px solid ${viewTab === t.k ? C.blue : C.border}`, borderRadius: 20,
              fontSize: 12, fontWeight: viewTab === t.k ? 700 : 400,
              background: viewTab === t.k ? C.bluePale : C.white,
              color: viewTab === t.k ? C.blue : C.muted, cursor: "pointer",
            }}>{t.l}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 2 }}>
            <ResidentDropdown residents={residents} value={filterResidentId || null} onChange={setFilterResidentId} placeholder="Select resident..." />
          </div>
          <div style={{ flex: 1 }}>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ ...inp, appearance: "none", fontSize: 12 }}>
              <option value="">All types</option>
              {Object.entries(APPT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <button onClick={() => { setFilterResidentId(""); setFilterType(""); }} style={{ padding: "8px 12px", background: C.bluePale, border: `1px solid ${C.blueBorder}`, borderRadius: 7, color: C.blue, fontSize: 12, cursor: "pointer" }}>Clear</button>
        </div>
      </div>

      {/* Appointment list grouped by date */}
      {Object.keys(grouped).length === 0 ? (
        <EmptyState title="No appointments" icon="⬡" desc="No appointments match the current filters." />
      ) : (
        <div style={{ display: "grid", gap: 24 }}>
          {Object.entries(grouped).map(([date, appts]) => (
            <div key={date}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: date === today ? C.blue : C.navy, whiteSpace: "nowrap" }}>{fmtDate(date)}</div>
                <div style={{ flex: 1, height: 1, background: C.border }} />
                <div style={{ fontSize: 11, color: C.muted, whiteSpace: "nowrap" }}>{appts.length} appt{appts.length !== 1 ? "s" : ""}</div>
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                {appts.map(appt => {
                  const ts = APPT_TYPES[appt.type] || APPT_TYPES.other;
                  const ss = APPT_STATUS_MAP[appt.status] || APPT_STATUS_MAP.scheduled;
                  const isPast = appt.date < today || ["completed","no_show","cancelled"].includes(appt.status);
                  const canRecord = appt.date <= today && ["scheduled","pending_confirmation"].includes(appt.status);
                  return (
                    <div key={appt.id} style={{ background: C.white, border: `1.5px solid ${appt.status === "pending_confirmation" ? "#fde68a" : C.border}`, borderRadius: 10, padding: "14px 18px", display: "flex", gap: 16, alignItems: "flex-start", opacity: appt.status === "cancelled" ? 0.55 : 1 }}>
                      {/* Time + type icon column */}
                      <div style={{ textAlign: "center", minWidth: 58, flexShrink: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.navy, lineHeight: 1 }}>{fmtTime(appt.time)}</div>
                        <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>{appt.duration} min</div>
                        <div style={{ marginTop: 10, width: 36, height: 36, borderRadius: 9, background: ts.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: ts.color, margin: "10px auto 0" }}>{ts.icon}</div>
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 7 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                            <div style={{ width: 28, height: 28, borderRadius: "50%", background: C.navy, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "var(--admin-paper)", flexShrink: 0 }}>{appt.residentInitials}</div>
                            <span style={{ fontWeight: 700, color: C.navy, fontSize: 14 }}>{appt.residentName}</span>
                          </div>
                          <span style={{ background: ts.bg, color: ts.color, padding: "2px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700 }}>{ts.label}</span>
                          <span style={{ background: ss.bg, color: ss.color, padding: "2px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700 }}>{ss.label}</span>
                        </div>

                        <div style={{ fontSize: 13, color: C.text, marginBottom: 2 }}>
                          <strong>{appt.provider}</strong>
                          {appt.org && appt.org !== appt.provider && <span style={{ color: C.muted, fontWeight: 400 }}> · {appt.org}</span>}
                        </div>
                        {appt.location && <div style={{ fontSize: 12, color: C.muted, marginBottom: 5 }}>📍 {appt.location}</div>}
                        {appt.purpose && <div style={{ fontSize: 12, color: C.text, lineHeight: 1.5, marginBottom: 7 }}>{appt.purpose}</div>}

                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {appt.transportNeeded && <span style={{ background: C.bluePale, color: C.blue, padding: "1px 9px", borderRadius: 10, fontSize: 10, fontWeight: 600 }}>🚗 Transport needed</span>}
                          {appt.staffEscort    && <span style={{ background: C.purpleBg, color: C.purple, padding: "1px 9px", borderRadius: 10, fontSize: 10, fontWeight: 600 }}>👤 Staff escort</span>}
                        </div>

                        {appt.outcome && (
                          <div style={{ background: C.greenBg, border: `1px solid #bbf7d0`, borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#065f46", marginTop: 8, lineHeight: 1.6 }}>
                            <strong style={{ color: C.green }}>Outcome: </strong>{appt.outcome}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0, alignItems: "flex-end" }}>
                        {canRecord && (
                          <button onClick={() => { setRecording(appt); setRecForm({ status: "completed", outcome: "" }); }} style={{ padding: "6px 13px", background: C.green, border: "none", borderRadius: 6, color: "var(--admin-paper)", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>Record Outcome</button>
                        )}
                        {!isPast && appt.status !== "cancelled" && (
                          <button
                            onClick={() => setAppointments(prev => prev.map(a => a.id === appt.id ? { ...a, status: "cancelled" } : a))}
                            style={{ padding: "5px 12px", background: C.white, border: `1px solid #fca5a5`, borderRadius: 6, color: C.red, fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                          >Cancel</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Appointment modal */}
      {showAdd && (
        <Modal title="New Appointment" onClose={() => { setShowAdd(false); setForm({}); setAddError(''); }}>
          <Grid cols={2}>
            <F label="Resident" span={2}>
              <ResidentDropdown residents={residents} value={form.residentId || null} onChange={v => sf("residentId", v)} placeholder="Select resident..." />
            </F>
            <F label="Appointment Type"><Sel value={form.type} onChange={v => sf("type", v)} options={Object.entries(APPT_TYPES).map(([k,v]) => ({ value: k, label: v.label }))} /></F>
            <F label="Status"><Sel value={form.apptStatus || "scheduled"} onChange={v => sf("apptStatus", v)} options={[{value:"scheduled",label:"Scheduled"},{value:"pending_confirmation",label:"Pending Confirmation"}]} /></F>
            <F label="Date"><TI type="date" value={form.date} onChange={v => sf("date", v)} min={today} /></F>
            <F label="Time"><TI type="time" value={form.time} onChange={v => sf("time", v)} /></F>
            <F label="Provider / Clinician"><TI value={form.provider} onChange={v => sf("provider", v)} placeholder="Dr. Name or provider" /></F>
            <F label="Duration (minutes)"><TI type="number" value={form.duration || "60"} onChange={v => sf("duration", v)} placeholder="60" /></F>
            <F label="Organization / Clinic" span={2}><TI value={form.org} onChange={v => sf("org", v)} placeholder="Clinic or facility name" /></F>
            <F label="Location / Address" span={2}><TI value={form.location} onChange={v => sf("location", v)} placeholder="Street address or on-site room" /></F>
            <F label="Purpose / Reason" span={2}><TA value={form.purpose} onChange={v => sf("purpose", v)} placeholder="Brief description of the appointment purpose…" rows={2} /></F>
            <F label="Transportation Needed"><RG value={form.transportNeeded || "false"} onChange={v => sf("transportNeeded", v)} options={[{value:"true",label:"Yes"},{value:"false",label:"No"}]} /></F>
            <F label="Staff Escort Required"><RG value={form.staffEscort || "false"} onChange={v => sf("staffEscort", v)} options={[{value:"true",label:"Yes"},{value:"false",label:"No"}]} /></F>
          </Grid>
          {addError && <div style={{ marginTop: 12, background: C.redBg, border: `1px solid ${C.red}`, borderRadius: 6, padding: "10px 12px", color: C.red, fontSize: 13 }}>{addError}</div>}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
            <button onClick={() => { setShowAdd(false); setForm({}); setAddError(''); }} style={{ padding: "9px 18px", background: C.white, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, cursor: "pointer", color: C.muted }}>Cancel</button>
            <button
              onClick={handleAdd}
              disabled={addSubmitting || !form.residentId || !form.type || !form.date || !form.time}
              style={{ padding: "9px 22px", background: C.blue, border: "none", borderRadius: 7, color: "var(--admin-paper)", fontWeight: 700, fontSize: 13, cursor: addSubmitting ? "default" : "pointer",
                opacity: addSubmitting || !form.residentId || !form.type || !form.date || !form.time ? 0.45 : 1 }}
            >{addSubmitting ? "Saving…" : "Schedule Appointment"}</button>
          </div>
        </Modal>
      )}

      {/* Record Outcome modal */}
      {recording && (
        <Modal title={`Record Outcome — ${recording.residentName}`} onClose={() => setRecording(null)}>
          <div style={{ background: C.bluePale, border: `1px solid ${C.blueBorder}`, borderRadius: 8, padding: "12px 16px", marginBottom: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>
              {APPT_TYPES[recording.type]?.label} · {fmtDate(recording.date)} at {fmtTime(recording.time)}
            </div>
            <div style={{ fontSize: 12, color: C.text, marginTop: 3 }}>{recording.provider}{recording.org && recording.org !== recording.provider ? ` · ${recording.org}` : ""}</div>
            {recording.purpose && <div style={{ fontSize: 12, color: C.muted, marginTop: 3, fontStyle: "italic" }}>{recording.purpose}</div>}
          </div>
          <F label="Appointment Outcome">
            <RG value={recForm.status} onChange={v => rf("status", v)} options={[
              { value: "completed", label: "Completed — appointment took place"     },
              { value: "no_show",   label: "No Show — resident did not attend"      },
              { value: "cancelled", label: "Cancelled — appointment was cancelled"  },
            ]} />
          </F>
          <div style={{ marginTop: 14 }}>
            <F label="Clinical Notes / Outcome Summary">
              <TA value={recForm.outcome} onChange={v => rf("outcome", v)} placeholder="Describe what occurred, clinical observations, follow-up actions needed…" rows={4} />
            </F>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
            <button onClick={() => setRecording(null)} style={{ padding: "9px 18px", background: C.white, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, cursor: "pointer", color: C.muted }}>Cancel</button>
            <button
              onClick={confirmRecord}
              style={{ padding: "9px 22px", border: "none", borderRadius: 7, color: "var(--admin-paper)", fontWeight: 700, fontSize: 13, cursor: "pointer",
                background: recForm.status === "completed" ? C.green : recForm.status === "no_show" ? C.red : "#6b7280" }}
            >{recForm.status === "completed" ? "Save — Completed" : recForm.status === "no_show" ? "Save — No Show" : "Save — Cancelled"}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── SECTION: DAILY PROGRESS NOTES ───────────────────────────────────────────
const PROGRESS_NOTE_FIELD_SECTIONS = [
  {
    title: 'Progress Notes',
    fields: [
      { key: 'progressNotes', label: 'Progress Notes', type: 'long' },
    ],
  },
  {
    title: 'Mood & Behavior',
    fields: [
      { key: 'moodBehavior', label: 'Observed Mood/Behavior', type: 'list' },
    ],
  },
  {
    title: 'Physical Health',
    fields: [
      { key: 'physicalHealth', label: 'Health Status', type: 'list' },
    ],
  },
  {
    title: 'Medications Administered',
    fields: [
      { key: 'medicationsAdministered', label: 'Medications Given', type: 'list' },
    ],
  },
  {
    title: 'Meal Intake',
    fields: [
      { key: 'mealsBreakfast', label: 'Breakfast %', suffix: '%' },
      { key: 'mealsBreakfastNotes', label: 'Breakfast Notes', type: 'long' },
      { key: 'mealsLunch', label: 'Lunch %', suffix: '%' },
      { key: 'mealsLunchNotes', label: 'Lunch Notes', type: 'long' },
      { key: 'mealsDinner', label: 'Dinner %', suffix: '%' },
      { key: 'mealsDinnerNotes', label: 'Dinner Notes', type: 'long' },
    ],
  },
  {
    title: 'Activities',
    fields: [
      { key: 'activitiesParticipated', label: 'Activities Participated', type: 'list' },
    ],
  },
  {
    title: 'Incidents & Concerns',
    fields: [
      { key: 'incidents', label: 'Incidents or Concerns', type: 'long' },
    ],
  },
];

function normalizeProgressNoteBody(noteBody) {
  if (!noteBody) return {};
  if (typeof noteBody === 'string') {
    try {
      const parsed = JSON.parse(noteBody);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return { progressNotes: noteBody };
    }
  }
  return typeof noteBody === 'object' && !Array.isArray(noteBody) ? noteBody : {};
}

function formatSubmittedValue(value, { suffix } = {}) {
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  const text = String(value);
  return suffix && text !== '—' ? `${text}${suffix}` : text;
}

function SubmittedProgressNoteFields({ noteBody }) {
  const body = normalizeProgressNoteBody(noteBody);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {PROGRESS_NOTE_FIELD_SECTIONS.map((section) => (
        <div
          key={section.title}
          style={{
            background: C.white,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: 14,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {section.title}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
            {section.fields.map((field) => (
              <div key={field.key}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
                  {field.label}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    lineHeight: 1.6,
                    color: C.text,
                    whiteSpace: field.type === 'long' ? 'pre-wrap' : 'normal',
                    wordBreak: 'break-word',
                  }}
                >
                  {formatSubmittedValue(body[field.key], field)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function DailyProgressNotesSection() {
  const today = new Date().toISOString().slice(0, 10);
  const { auth } = useAuth();

  const [notes, setNotes]         = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);

  // filters
  const [filterDate, setFilterDate]     = useState(today);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSearch, setFilterSearch] = useState('');

  // review modal
  const [reviewing, setReviewing]           = useState(null); // note object
  const [reviewNotes, setReviewNotes]       = useState('');
  const [reviewError, setReviewError]       = useState('');
  const [isSubmitting, setIsSubmitting]     = useState(false);
  const [isDownloading, setIsDownloading]   = useState(false);

  // Fetch notes whenever auth or date filter changes
  useEffect(() => {
    if (!auth) return;

    const fetchNotes = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (filterDate) params.set('date', filterDate);

        const res = await fetch(`/api/v1/daily-progress-notes?${params.toString()}`, {
          headers: { Authorization: `Bearer ${auth.accessToken}` },
          credentials: 'same-origin',
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Request failed (${res.status})`);
        }

        const body = await res.json();
        // API returns { data: [...] }
        setNotes(body.data || body.notes || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchNotes();
  }, [auth, filterDate]);

  // Client-side filter by status + search
  const filtered = notes.filter(n => {
    if (filterStatus !== 'all') {
      const s = (n.review_status || '').toLowerCase();
      if (filterStatus === 'pending'  && s !== 'pending')  return false;
      if (filterStatus === 'approved' && s !== 'approved' && s !== 'reviewed') return false;
    }
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      const residentName  = `${n.first_name || ''} ${n.last_name || ''}`.toLowerCase();
      const staffName     = `${n.staff_first_name || ''} ${n.staff_last_name || ''}`.toLowerCase();
      if (!residentName.includes(q) && !staffName.includes(q)) return false;
    }
    return true;
  });

  const totalCount   = filtered.length;
  const pendingCount = filtered.filter(n => (n.review_status || '').toLowerCase() === 'pending').length;

  // Approve / reject a note
  const handleReview = async (status) => {
    if (!reviewing) return;
    setReviewError('');
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/v1/daily-progress-notes/${reviewing.id}/review`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.accessToken}`,
        },
        credentials: 'same-origin',
        body: JSON.stringify({ status, notes: reviewNotes || null }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Review failed');
      }

      setNotes(prev =>
        prev.map(n => n.id === reviewing.id ? { ...n, review_status: status } : n)
      );
      setReviewing(null);
      setReviewNotes('');
    } catch (err) {
      setReviewError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Download progress note as PDF
  const handleDownloadPDF = async () => {
    if (!reviewing) return;
    setIsDownloading(true);
    try {
      await downloadProgressNotesPDF(reviewing);
    } catch (err) {
      setReviewError(`Failed to download PDF: ${err.message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const shiftLabel = (shift) => {
    const map = { morning: 'Morning', afternoon: 'Afternoon', night: 'Night' };
    return map[(shift || '').toLowerCase()] || (shift || '—');
  };

  const statusBadgeStatus = (s) => {
    const lower = (s || '').toLowerCase();
    if (lower === 'pending')  return 'Pending Review';
    if (lower === 'approved' || lower === 'reviewed') return 'Approved';
    return s || '—';
  };

  return (
    <div>
      {/* Review Modal */}
      {reviewing && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,45,94,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: C.bg, borderRadius: 12, width: 'min(560px, 95vw)', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: C.navy, padding: '16px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '12px 12px 0 0', flexShrink: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Review Progress Note</div>
              <button onClick={() => { setReviewing(null); setReviewNotes(''); setReviewError(''); }} disabled={isSubmitting} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, color: '#fff', cursor: isSubmitting ? 'default' : 'pointer', fontSize: 16, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isSubmitting ? 0.5 : 1 }}>✕</button>
            </div>
            <div style={{ padding: 24, flex: 1, overflowY: 'auto' }}>
              <div style={{ background: C.white, border: `1px solid ${C.blueBorder}`, borderRadius: 8, padding: 16, marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Note Details</div>
                <Grid cols={2}>
                  <F label="Resident"><TI value={`${reviewing.first_name || ''} ${reviewing.last_name || ''}`.trim() || '—'} readOnly /></F>
                  <F label="Staff"><TI value={`${reviewing.staff_first_name || ''} ${reviewing.staff_last_name || ''}`.trim() || '—'} readOnly /></F>
                  <F label="Date"><TI value={reviewing.note_date || '—'} readOnly /></F>
                  <F label="Shift"><TI value={shiftLabel(reviewing.shift)} readOnly /></F>
                </Grid>
              </div>
              <div style={{ background: '#f9f9f9', border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Submitted Progress Note</div>
                <SubmittedProgressNoteFields noteBody={reviewing.note_body || reviewing.content || reviewing.notes} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ ...lbl, marginBottom: 8 }}>Review Notes (Optional)</label>
                <TA value={reviewNotes} onChange={setReviewNotes} placeholder="Add notes for this review decision..." rows={4} />
              </div>
              {reviewError && (
                <div style={{ background: C.redBg, border: `1px solid ${C.red}`, borderRadius: 6, padding: '10px 12px', marginBottom: 16, color: C.red, fontSize: 13 }}>
                  {reviewError}
                </div>
              )}
            </div>
            <div style={{ borderTop: `1px solid ${C.border}`, padding: '16px 24px', display: 'flex', gap: 12, justifyContent: 'space-between', background: C.white, flexShrink: 0 }}>
              <button
                onClick={handleDownloadPDF}
                disabled={isSubmitting || isDownloading}
                style={{
                  padding: '9px 14px',
                  border: `1px solid ${C.border}`,
                  borderRadius: 7,
                  background: C.white,
                  cursor: (isSubmitting || isDownloading) ? 'default' : 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  color: C.cyan,
                  opacity: (isSubmitting || isDownloading) ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
                title="Download progress note as PDF"
              >
                <Download size={14} style={{ marginTop: -1 }} /> {isDownloading ? 'Downloading...' : 'Download PDF'}
              </button>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => { setReviewing(null); setReviewNotes(''); setReviewError(''); }} disabled={isSubmitting || isDownloading} style={{ padding: '9px 18px', border: `1px solid ${C.border}`, borderRadius: 7, background: C.white, cursor: (isSubmitting || isDownloading) ? 'default' : 'pointer', fontSize: 13, fontWeight: 600, color: C.text, opacity: (isSubmitting || isDownloading) ? 0.5 : 1 }}>Cancel</button>
                <button onClick={() => handleReview('rejected')} disabled={isSubmitting || isDownloading} style={{ padding: '9px 18px', border: 'none', borderRadius: 7, background: C.red, color: '#fff', cursor: (isSubmitting || isDownloading) ? 'default' : 'pointer', fontSize: 13, fontWeight: 600, opacity: (isSubmitting || isDownloading) ? 0.7 : 1 }}>{isSubmitting ? 'Processing...' : 'Reject'}</button>
                <button onClick={() => handleReview('approved')} disabled={isSubmitting || isDownloading} style={{ padding: '9px 18px', border: 'none', borderRadius: 7, background: C.green, color: '#fff', cursor: (isSubmitting || isDownloading) ? 'default' : 'pointer', fontSize: 13, fontWeight: 600, opacity: (isSubmitting || isDownloading) ? 0.7 : 1 }}>{isSubmitting ? 'Processing...' : 'Approve'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Section header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.navy, margin: 0 }}>Daily Progress Notes</h2>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>Review and approve daily progress notes submitted by staff</div>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total</span>
          <span style={{ fontSize: 22, fontWeight: 700, color: C.blue }}>{totalCount}</span>
        </div>
        <div style={{ background: C.white, border: `1px solid ${pendingCount > 0 ? '#fca5a5' : C.border}`, borderRadius: 8, padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: pendingCount > 0 ? C.red : C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pending</span>
          <span style={{ fontSize: 22, fontWeight: 700, color: pendingCount > 0 ? C.red : C.muted }}>{pendingCount}</span>
          {pendingCount > 0 && <AlertBadge />}
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px', flexWrap: 'wrap' }}>
        <div style={{ flex: '0 0 160px' }}>
          <label style={lbl}>Date</label>
          <input
            type="date"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            style={{ ...inp }}
          />
        </div>
        <div style={{ flex: '0 0 160px' }}>
          <label style={lbl}>Status</label>
          <Sel
            value={filterStatus}
            onChange={setFilterStatus}
            options={[
              { value: 'all',      label: 'All'      },
              { value: 'pending',  label: 'Pending'  },
              { value: 'approved', label: 'Approved' },
            ]}
          />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label style={lbl}>Search Staff / Resident</label>
          <input
            type="text"
            value={filterSearch}
            onChange={e => setFilterSearch(e.target.value)}
            placeholder="Type a name..."
            style={{ ...inp }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button
            onClick={() => { setFilterDate(today); setFilterStatus('all'); setFilterSearch(''); }}
            style={{ padding: '9px 14px', background: C.bluePale, border: `1px solid ${C.blueBorder}`, borderRadius: 7, color: C.blue, fontSize: 13, cursor: 'pointer' }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: 32, textAlign: 'center', color: C.muted }}>Loading progress notes...</div>
      ) : error ? (
        <div style={{ background: C.redBg, border: `1px solid ${C.red}`, borderRadius: 10, padding: '14px 18px', color: C.red, fontSize: 13 }}>
          Failed to load progress notes: {error}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState title="No progress notes found" icon="◈" desc="No notes match the current filters. Try adjusting the date or status." />
      ) : (
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.bluePale }}>
                {['Date', 'Resident', 'Staff', 'Shift', 'Status', 'Action'].map(h => (
                  <th key={h} style={{ padding: '9px 12px', textAlign: 'left', color: C.navy, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: `1px solid ${C.blueBorder}`, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(n => {
                const isPending = (n.review_status || '').toLowerCase() === 'pending';
                return (
                  <tr
                    key={n.id}
                    style={{
                      borderBottom: `1px solid ${C.border}`,
                      borderLeft: isPending ? `3px solid ${C.amber}` : '3px solid transparent',
                      background: isPending ? C.amberBg : C.white,
                    }}
                    onMouseEnter={e => { if (!isPending) e.currentTarget.style.background = C.bluePale; }}
                    onMouseLeave={e => { e.currentTarget.style.background = isPending ? C.amberBg : C.white; }}
                  >
                    <td style={{ padding: '10px 12px', color: C.text, verticalAlign: 'middle' }}>
                      {n.note_date ? new Date(n.note_date).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                      <div style={{ fontWeight: 700, color: C.navy }}>{`${n.first_name || ''} ${n.last_name || ''}`.trim() || '—'}</div>
                    </td>
                    <td style={{ padding: '10px 12px', color: C.text, verticalAlign: 'middle' }}>
                      {`${n.staff_first_name || ''} ${n.staff_last_name || ''}`.trim() || '—'}
                    </td>
                    <td style={{ padding: '10px 12px', color: C.text, verticalAlign: 'middle' }}>
                      {shiftLabel(n.shift)}
                    </td>
                    <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                      <Badge status={statusBadgeStatus(n.review_status)} />
                    </td>
                    <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                      {isPending && (
                        <button
                          onClick={() => { setReviewing(n); setReviewNotes(''); setReviewError(''); }}
                          style={{ padding: '5px 14px', border: `1px solid ${C.blue}`, background: C.bluePale, color: C.blue, borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
                        >
                          Review
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── GENERIC ADMIN REVIEW SECTION ────────────────────────────────────────────
// Reusable section for listing pending/approved submissions with a review modal.
// Used for incidents, drug disposal, and evacuation drills.
const BODY_AREA_LABELS = {
  head: 'Head',
  neck: 'Neck',
  chest: 'Chest',
  back: 'Back',
  abdomen: 'Abdomen',
  left_arm: 'Left Arm',
  right_arm: 'Right Arm',
  left_hand: 'Left Hand',
  right_hand: 'Right Hand',
  left_leg: 'Left Leg',
  right_leg: 'Right Leg',
  left_foot: 'Left Foot',
  right_foot: 'Right Foot',
  other: 'Other',
};

const INCIDENT_NOTIFICATION_LABELS = {
  licensee: 'Licensee',
  primary_care: 'Primary Care Provider',
  family: 'Family / Responsible Party',
  case_manager: 'Case Manager',
  licensor: 'Licensor',
  mental_health: 'Mental Health Provider',
};

function parseSubmittedJson(value, fallback) {
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function reviewFullName(row, firstKey = 'first_name', lastKey = 'last_name') {
  return `${row?.[firstKey] || ''} ${row?.[lastKey] || ''}`.trim();
}

function reviewDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
}

function reviewTime(value) {
  if (!value) return '';
  return String(value).slice(0, 5);
}

function yesNo(value) {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return '';
}

function formatDurationFromSeconds(seconds) {
  if (seconds == null || seconds === '') return '';
  const numeric = Number(seconds);
  if (!Number.isFinite(numeric)) return String(seconds);
  const minutes = numeric / 60;
  return `${Number.isInteger(minutes) ? minutes : minutes.toFixed(1)} minutes`;
}

function formatBodyAreas(value) {
  const parsed = parseSubmittedJson(value, {});
  const areas = Array.isArray(parsed) ? parsed : parsed?.areas;
  if (!Array.isArray(areas) || areas.length === 0) return '';
  return areas.map(area => BODY_AREA_LABELS[area] || String(area)).join(', ');
}

function formatNotifications(value) {
  const notifications = parseSubmittedJson(value, []);
  if (!Array.isArray(notifications) || notifications.length === 0) return '';
  return notifications.map((entry) => {
    const label = INCIDENT_NOTIFICATION_LABELS[entry.notified_party] || entry.notified_party || 'Notification';
    const status = yesNo(entry.was_notified) || 'No';
    const contact = entry.contact_name ? ` - ${entry.contact_name}` : '';
    const date = reviewDate(entry.notified_date);
    const time = reviewTime(entry.notified_time);
    const when = [date, time].filter(Boolean).join(' ');
    return `${label}: ${status}${contact}${when ? ` (${when})` : ''}`;
  }).join('\n');
}

function countResidentsPresent(value) {
  const residents = parseSubmittedJson(value, []);
  if (Array.isArray(residents)) return `${residents.length}`;
  return '';
}

function displayReviewValue(value) {
  if (value == null || value === '') return '-';
  if (typeof value === 'boolean') return yesNo(value) || '-';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '-';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

function ReviewField({ field }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ ...lbl, marginBottom: 5 }}>{field.label}</div>
      <div style={{
        minHeight: 36,
        padding: '9px 10px',
        background: '#f8fafc',
        border: `1px solid ${C.border}`,
        borderRadius: 7,
        color: C.text,
        fontSize: 13,
        lineHeight: 1.45,
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
      }}>
        {displayReviewValue(field.value)}
      </div>
    </div>
  );
}

function ReviewSections({ sections }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {sections.map((section, sectionIndex) => (
        <div key={`${section.title || 'section'}-${sectionIndex}`}>
          {section.title && (
            <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {section.title}
            </div>
          )}
          <Grid cols={2}>
            {(section.fields || []).map((field, fieldIndex) => (
              <div key={`${field.label}-${fieldIndex}`} style={{ gridColumn: field.wide ? '1 / -1' : undefined }}>
                <ReviewField field={field} />
              </div>
            ))}
          </Grid>
        </div>
      ))}
    </div>
  );
}

function AdminReviewSection({
  title,
  desc,
  fetchUrl,
  reviewUrlBuilder,
  columns,
  mapRow,
  detailFields,
  detailSections,
  residents = [],
}) {
  const { auth } = useAuth();
  const today = new Date().toISOString().slice(0, 10);

  const [items, setItems]               = useState([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);

  const [filterDate, setFilterDate]     = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterResidentId, setFilterResidentId] = useState('');

  const [reviewing, setReviewing]       = useState(null);
  const [reviewNotes, setReviewNotes]   = useState('');
  const [reviewError, setReviewError]   = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!auth) return;
    const fetch_ = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = filterDate ? `${fetchUrl}${fetchUrl.includes('?') ? '&' : '?'}date=${filterDate}` : fetchUrl;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${auth.accessToken}` },
          credentials: 'same-origin',
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Request failed (${res.status})`);
        }
        const body = await res.json();
        setItems(body.data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetch_();
  }, [auth, fetchUrl, filterDate]);

  const filtered = items.filter(n => {
    if (filterStatus !== 'all') {
      const s = (n.review_status || '').toLowerCase();
      if (filterStatus === 'pending'  && s !== 'pending')  return false;
      if (filterStatus === 'approved' && s !== 'approved') return false;
      if (filterStatus === 'rejected' && s !== 'rejected') return false;
    }
    if (filterResidentId) {
      if (n.resident_id) {
        if (n.resident_id !== filterResidentId) return false;
      } else {
        const selected = residents.find(r => r.id === filterResidentId);
        const residentName = `${n.first_name || ''} ${n.last_name || ''}`.trim().toLowerCase();
        const selectedName = `${selected?.first_name || ''} ${selected?.last_name || ''}`.trim().toLowerCase();
        if (!selectedName || residentName !== selectedName) return false;
      }
    }
    return true;
  });

  const totalCount   = filtered.length;
  const pendingCount = filtered.filter(n => (n.review_status || '').toLowerCase() === 'pending').length;

  const handleReview = async (status) => {
    if (!reviewing) return;
    setReviewError('');
    setIsSubmitting(true);
    try {
      const res = await fetch(reviewUrlBuilder(reviewing.id), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.accessToken}`,
        },
        credentials: 'same-origin',
        body: JSON.stringify({ status, notes: reviewNotes || null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Review failed');
      }
      setItems(prev => prev.map(n => n.id === reviewing.id ? { ...n, review_status: status } : n));
      setReviewing(null);
      setReviewNotes('');
    } catch (err) {
      setReviewError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusBadge = (s) => {
    const lower = (s || '').toLowerCase();
    if (lower === 'pending')  return 'Pending Review';
    if (lower === 'approved') return 'Approved';
    if (lower === 'rejected') return 'Rejected';
    return s || '—';
  };

  return (
    <div>
      {/* Review Modal */}
      {reviewing && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,45,94,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: C.bg, borderRadius: 12, width: 'min(640px, 95vw)', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: C.navy, padding: '16px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '12px 12px 0 0', flexShrink: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Review {title.slice(0, -1)}</div>
              <button onClick={() => { setReviewing(null); setReviewNotes(''); setReviewError(''); }} disabled={isSubmitting} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, color: '#fff', cursor: isSubmitting ? 'default' : 'pointer', fontSize: 16, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isSubmitting ? 0.5 : 1 }}>✕</button>
            </div>
            <div style={{ padding: 24, flex: 1, overflowY: 'auto' }}>
              <div style={{ background: C.white, border: `1px solid ${C.blueBorder}`, borderRadius: 8, padding: 16, marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Submission Details</div>
                <ReviewSections sections={detailSections ? detailSections(reviewing) : [{ fields: detailFields(reviewing) }]} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ ...lbl, marginBottom: 8 }}>Review Notes (Optional)</label>
                <TA value={reviewNotes} onChange={setReviewNotes} placeholder="Add notes for this review decision..." rows={4} />
              </div>
              {reviewError && (
                <div style={{ background: C.redBg, border: `1px solid ${C.red}`, borderRadius: 6, padding: '10px 12px', marginBottom: 16, color: C.red, fontSize: 13 }}>
                  {reviewError}
                </div>
              )}
            </div>
            <div style={{ background: C.white, padding: '14px 22px', display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: `1px solid ${C.border}`, borderRadius: '0 0 12px 12px' }}>
              <button onClick={() => handleReview('rejected')} disabled={isSubmitting} style={{ padding: '9px 18px', background: C.redBg, border: `1px solid ${C.red}`, borderRadius: 7, color: C.red, fontSize: 13, fontWeight: 700, cursor: isSubmitting ? 'default' : 'pointer', opacity: isSubmitting ? 0.5 : 1 }}>Reject</button>
              <button onClick={() => handleReview('approved')} disabled={isSubmitting} style={{ padding: '9px 18px', background: C.blue, border: 'none', borderRadius: 7, color: '#fff', fontSize: 13, fontWeight: 700, cursor: isSubmitting ? 'default' : 'pointer', opacity: isSubmitting ? 0.5 : 1 }}>{isSubmitting ? 'Saving…' : 'Approve'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.navy, margin: 0 }}>{title}</h2>
        {desc && <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{desc}</div>}
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total</span>
          <span style={{ fontSize: 22, fontWeight: 700, color: C.blue }}>{totalCount}</span>
        </div>
        <div style={{ background: C.white, border: `1px solid ${pendingCount > 0 ? '#fca5a5' : C.border}`, borderRadius: 8, padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: pendingCount > 0 ? C.red : C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pending</span>
          <span style={{ fontSize: 22, fontWeight: 700, color: pendingCount > 0 ? C.red : C.muted }}>{pendingCount}</span>
          {pendingCount > 0 && <AlertBadge />}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px', flexWrap: 'wrap' }}>
        <div style={{ flex: '0 0 160px' }}>
          <label style={lbl}>Date</label>
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={{ ...inp }} />
        </div>
        <div style={{ flex: '0 0 160px' }}>
          <label style={lbl}>Status</label>
          <Sel value={filterStatus} onChange={setFilterStatus} options={[
            { value: 'all',      label: 'All'      },
            { value: 'pending',  label: 'Pending'  },
            { value: 'approved', label: 'Approved' },
            { value: 'rejected', label: 'Rejected' },
          ]} />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label style={lbl}>Resident</label>
          <ResidentDropdown residents={residents} value={filterResidentId || null} onChange={setFilterResidentId} placeholder="Select resident..." />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button onClick={() => { setFilterDate(''); setFilterStatus('all'); setFilterResidentId(''); }}
            style={{ padding: '9px 14px', background: C.bluePale, border: `1px solid ${C.blueBorder}`, borderRadius: 7, color: C.blue, fontSize: 13, cursor: 'pointer' }}>
            Reset
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: 32, textAlign: 'center', color: C.muted }}>Loading…</div>
      ) : error ? (
        <div style={{ background: C.redBg, border: `1px solid ${C.red}`, borderRadius: 10, padding: '14px 18px', color: C.red, fontSize: 13 }}>
          Failed to load: {error}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState title="No records found" icon="◈" desc="No items match the current filters. Try adjusting the date or status." />
      ) : (
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.bluePale }}>
                {[...columns, 'Status', 'Action'].map(h => (
                  <th key={h} style={{ padding: '9px 12px', textAlign: 'left', color: C.navy, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: `1px solid ${C.blueBorder}`, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(n => {
                const isPending = (n.review_status || '').toLowerCase() === 'pending';
                const cells = mapRow(n);
                return (
                  <tr key={n.id} style={{
                    borderBottom: `1px solid ${C.border}`,
                    borderLeft: isPending ? `3px solid ${C.amber}` : '3px solid transparent',
                    background: isPending ? C.amberBg : C.white,
                  }}>
                    {cells.map((cell, i) => (
                      <td key={i} style={{ padding: '10px 12px', color: C.text, verticalAlign: 'middle' }}>{cell}</td>
                    ))}
                    <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                      <Badge status={statusBadge(n.review_status)} />
                    </td>
                    <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                      {isPending && (
                        <button onClick={() => { setReviewing(n); setReviewNotes(''); setReviewError(''); }}
                          style={{ padding: '5px 14px', border: `1px solid ${C.blue}`, background: C.bluePale, color: C.blue, borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                          Review
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── ADMIN: INCIDENT REPORTS ─────────────────────────────────────────────────
function IncidentReportsSection({ residents }) {
  return (
    <AdminReviewSection
      title="Incident Reports"
      desc="Review and approve incident reports submitted by staff."
      fetchUrl="/api/v1/incidents"
      reviewUrlBuilder={(id) => `/api/v1/incidents/${id}/review`}
      residents={residents}
      columns={['Date', 'Resident', 'Type', 'Staff']}
      mapRow={(n) => [
        n.incident_date ? new Date(n.incident_date).toLocaleDateString() : '—',
        <span key="r" style={{ fontWeight: 700, color: C.navy }}>{`${n.first_name || ''} ${n.last_name || ''}`.trim() || '—'}</span>,
        n.incident_type || '—',
        `${n.staff_first_name || ''} ${n.staff_last_name || ''}`.trim() || '—',
      ]}
      detailSections={(n) => [
        {
          title: 'Resident & Incident Details',
          fields: [
            { label: 'Resident', value: reviewFullName(n) },
            { label: 'Date of Incident', value: reviewDate(n.incident_date) },
            { label: 'Time of Incident', value: reviewTime(n.incident_time) },
            { label: 'Type of Incident', value: n.incident_type },
            { label: 'Where Did Incident Occur?', value: n.incident_location, wide: true },
            { label: 'Other Residents Involved', value: yesNo(n.other_residents_involved) },
            { label: 'Was Incident Witnessed?', value: yesNo(n.was_witnessed) },
            { label: 'If So, By Whom?', value: n.witnessed_by, wide: true },
          ],
        },
        {
          title: 'Incident Narrative',
          fields: [
            { label: 'Details of Incident and Description of Any Injuries', value: n.incident_details, wide: true },
            { label: 'Specific Action(s) Taken by Staff', value: n.staff_actions_taken, wide: true },
            { label: 'Body Areas Injured', value: formatBodyAreas(n.body_areas_injured), wide: true },
          ],
        },
        {
          title: 'Notifications',
          fields: [
            { label: 'Notifications Made', value: formatNotifications(n.notifications), wide: true },
          ],
        },
        {
          title: 'Follow-Up & Sign-Off',
          fields: [
            { label: 'Follow-Up Plan', value: n.follow_up_plan, wide: true },
            { label: 'Name of Person Completing Form', value: n.completed_by_name },
            { label: 'Staff Account', value: reviewFullName(n, 'staff_first_name', 'staff_last_name') },
            { label: 'Signature', value: n.completed_by_signature, wide: true },
          ],
        },
      ]}
    />
  );
}

// ─── ADMIN: DRUG DISPOSAL ────────────────────────────────────────────────────
function DrugDisposalSection({ residents }) {
  return (
    <AdminReviewSection
      title="Drug Disposal Records"
      desc="Review and approve medication disposal records submitted by staff."
      fetchUrl="/api/v1/drug-disposal"
      reviewUrlBuilder={(id) => `/api/v1/drug-disposal/${id}/review`}
      residents={residents}
      columns={['Date', 'Resident', 'Drug', 'Quantity', 'Staff']}
      mapRow={(n) => [
        n.disposal_date ? new Date(n.disposal_date).toLocaleDateString() : '—',
        <span key="r" style={{ fontWeight: 700, color: C.navy }}>{`${n.first_name || ''} ${n.last_name || ''}`.trim() || '—'}</span>,
        n.drug_name || '—',
        `${n.quantity_disposed || ''} ${n.quantity_unit || ''}`.trim() || '—',
        `${n.staff_first_name || ''} ${n.staff_last_name || ''}`.trim() || '—',
      ]}
      detailSections={(n) => [
        {
          title: 'Resident Information',
          fields: [
            { label: 'Resident', value: reviewFullName(n) },
          ],
        },
        {
          title: 'Medications Disposed',
          fields: [
            { label: 'Date', value: reviewDate(n.disposal_date) },
            { label: 'Drug Name', value: n.drug_name },
            { label: 'Drug Strength', value: n.drug_strength },
            { label: 'Quantity Disposed', value: `${n.quantity_disposed || ''} ${n.quantity_unit || ''}`.trim() },
            { label: 'Reason for Disposal', value: n.disposal_reason },
            { label: 'Reason Other', value: n.disposal_reason_other },
            { label: 'Method of Disposal', value: n.disposal_method },
            { label: 'Method Other', value: n.disposal_method_other },
            { label: 'Staff Name (Counting & Disposing)', value: n.counting_staff_name || reviewFullName(n, 'staff_first_name', 'staff_last_name') },
            { label: 'Witness (If Controlled)', value: n.witness_name },
            { label: 'Controlled Substance', value: yesNo(n.is_controlled_substance) },
          ],
        },
      ]}
    />
  );
}

// ─── ADMIN: EVACUATION DRILLS ────────────────────────────────────────────────
function EvacuationDrillsSection() {
  return (
    <AdminReviewSection
      title="Evacuation Drills"
      desc="Review and approve evacuation drill records submitted by staff."
      fetchUrl="/api/v1/evacuation-drills"
      reviewUrlBuilder={(id) => `/api/v1/evacuation-drills/${id}/review`}
      columns={['Date', 'Type', 'Location', 'Accounted', 'Staff']}
      mapRow={(n) => [
        n.drill_date ? new Date(n.drill_date).toLocaleDateString() : '—',
        n.drill_type || '—',
        n.location_evacuated_to || '—',
        n.all_residents_accounted ? '✓ All' : 'Partial',
        `${n.staff_first_name || ''} ${n.staff_last_name || ''}`.trim() || '—',
      ]}
      detailSections={(n) => [
        {
          title: 'Drill Information',
          fields: [
            { label: 'Drill Type', value: n.drill_type },
            { label: 'Drill Date', value: reviewDate(n.drill_date) },
            { label: 'Drill Time', value: reviewTime(n.drill_time) },
            { label: 'Duration', value: formatDurationFromSeconds(n.evacuation_time_seconds) },
          ],
        },
        {
          title: 'Evacuation Details',
          fields: [
            { label: 'Location Evacuated To', value: n.location_evacuated_to },
            { label: 'Residents Evacuated', value: countResidentsPresent(n.residents_present) },
            { label: 'All Residents Accounted For', value: yesNo(n.all_residents_accounted) },
            { label: 'Conducted By', value: reviewFullName(n, 'staff_first_name', 'staff_last_name') },
          ],
        },
        {
          title: 'Observations & Sign-Off',
          fields: [
            { label: 'Issues Encountered / Follow-Up Actions', value: n.issues_noted, wide: true },
            { label: 'Signature', value: n.conducted_by_signature, wide: true },
          ],
        },
      ]}
    />
  );
}

// ─── GENERIC STUB ─────────────────────────────────────────────────────────────
function StubSection({ title, desc, buttonLabel, buttonColor = C.blue, onAdd }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div><h2 style={{ fontSize: 20, fontWeight: 700, color: C.navy, margin: 0 }}>{title}</h2><div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{desc}</div></div>
        {buttonLabel && <button onClick={onAdd} style={{ padding: "9px 18px", background: buttonColor, border: "none", borderRadius: 8, color: "var(--admin-paper)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{buttonLabel}</button>}
      </div>
      <EmptyState title="Coming soon" desc="This module will be available in a future release." />
    </div>
  );
}

// ─── SECTION: MEDICATIONS ────────────────────────────────────────────────────

const MED_TYPE_STYLE = {
  "Antipsychotic":     { bg: C.purpleBg,    color: C.purple },
  "Antidepressant":    { bg: C.cyanBg,      color: C.cyan },
  "Mood Stabilizer":   { bg: C.approvedBg,  color: C.approved },
  "Anxiolytic":        { bg: C.amberBg,     color: C.amber },
  "Anticholinergic":   { bg: C.greenBg,     color: C.green },
  "Opioid Antagonist": { bg: C.purpleBg,    color: C.purple },
  "Alpha Blocker":     { bg: C.amberBg,     color: C.amber },
  "Controlled":        { bg: C.rejectedBg,  color: C.rejected },
  "Other":             { bg: C.draftBg,     color: C.draft },
};

const SCHED_STATUS = {
  administered: { bg: C.greenBg,     color: C.green,     border: C.emeraldBorder, label: "✓ Given"      },
  pending:      { bg: C.cyanBg,      color: C.cyan,      border: "#bfdbfe",       label: "○ Pending"    },
  submitted:    { bg: C.cyanBg,      color: C.cyan,      border: "#bfdbfe",       label: "☑ Submitted"  },
  approved:     { bg: C.approvedBg,  color: C.approved,  border: C.emeraldBorder, label: "✓ Approved"   },
  rejected:     { bg: C.rejectedBg,  color: C.rejected,  border: "#fca5a5",       label: "✗ Rejected"   },
  overdue:      { bg: C.rejectedBg,  color: C.rejected,  border: "#fca5a5",       label: "! Overdue"    },
  refused:      { bg: C.purpleBg,    color: C.purple,    border: "#ddd6fe",       label: "⊗ Refused"    },
  held:         { bg: C.amberBg,     color: C.amber,     border: "#fde68a",       label: "⏸ Held"       },
  missed:       { bg: C.draftBg,     color: C.draft,     border: "#e2e8f0",       label: "— Missed"     },
  cancelled:    { bg: C.cancelledBg, color: C.cancelled, border: "#e5e7eb",       label: "⊘ Cancelled"  },
  prn:          { bg: C.greenBg,     color: C.green,     border: C.emeraldBorder, label: "PRN / As Needed" },
};

// ─── ADMIN: MEDICATIONS ──────────────────────────────────────────────────────
// Admin/manager prescribes medications. The list + add-prescription form lives
// here. Administration history (who gave what, when, who refused) is on a tab.
function MedicationsSection() {
  const { auth } = useAuth();
  const [tab, setTab] = useState('prescriptions');
  const [meds, setMeds] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [residentFilterId, setResidentFilterId] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showForm, setShowForm] = useState(false);

  // Prescription form state
  const initialForm = {
    resident_id: '', drug_name: '', drug_strength: '', dosage: '',
    route: 'oral', frequency: '', prescriber: '', indication: '',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: '',
    is_controlled_substance: false, is_prn: false,
    prn_instructions: '', special_instructions: '',
  };
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Discontinue modal
  const [discontinuing, setDiscontinuing] = useState(null);
  const [discontinueReason, setDiscontinueReason] = useState('');

  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // Fetch prescriptions + residents
  useEffect(() => {
    if (!auth) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [medsRes, resRes] = await Promise.all([
          fetch('/api/v1/medications?limit=200', {
            headers: { Authorization: `Bearer ${auth.accessToken}` },
            credentials: 'same-origin',
          }),
          fetch('/api/v1/admin/residents?limit=200', {
            headers: { Authorization: `Bearer ${auth.accessToken}` },
            credentials: 'same-origin',
          }),
        ]);
        const medsBody = await medsRes.json();
        const resBody = await resRes.json();
        setMeds(medsBody.data || []);
        setResidents(resBody.data || resBody.residents || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [auth]);

  // Fetch administrations when tab changes
  useEffect(() => {
    if (!auth || tab !== 'history') return;
    const load = async () => {
      try {
        const res = await fetch('/api/v1/medication-administrations?limit=200', {
          headers: { Authorization: `Bearer ${auth.accessToken}` },
          credentials: 'same-origin',
        });
        const body = await res.json();
        setAdmins(body.data || []);
      } catch (err) {
        setError(err.message);
      }
    };
    load();
  }, [auth, tab]);

  // Filtered prescriptions list
  const filteredMeds = meds.filter(m => {
    if (filterStatus === 'active' && !m.is_active) return false;
    if (filterStatus === 'inactive' && m.is_active) return false;
    if (residentFilterId && m.resident_id !== residentFilterId) return false;
    return true;
  });

  const handleSubmit = async () => {
    if (!form.resident_id || !form.drug_name || !form.dosage || !form.frequency || !form.prescriber) {
      setFormError('Please fill in all required fields.');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      const res = await fetch('/api/v1/medications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.accessToken}`,
        },
        credentials: 'same-origin',
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Failed to create prescription');
        return;
      }
      // Refresh list
      const listRes = await fetch('/api/v1/medications?limit=200', {
        headers: { Authorization: `Bearer ${auth.accessToken}` },
        credentials: 'same-origin',
      });
      const listBody = await listRes.json();
      setMeds(listBody.data || []);
      setShowForm(false);
      setForm(initialForm);
    } catch (err) {
      setFormError('An error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDiscontinue = async () => {
    if (!discontinuing) return;
    try {
      const res = await fetch(`/api/v1/medications/${discontinuing.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.accessToken}`,
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          is_active: false,
          discontinued_reason: discontinueReason || 'No reason given',
        }),
      });
      if (res.ok) {
        setMeds(prev => prev.map(m => m.id === discontinuing.id ? { ...m, is_active: false } : m));
        setDiscontinuing(null);
        setDiscontinueReason('');
      }
    } catch (err) {
    }
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString() : '—';
  const fmtTime = (d) => d ? new Date(d).toLocaleString() : '—';

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: C.navy, margin: 0 }}>Medications</h2>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>Manage prescriptions and review administration history.</div>
        </div>
        {tab === 'prescriptions' && (
          <button
            onClick={() => setShowForm(true)}
            style={{ padding: '9px 18px', background: C.blue, border: 'none', borderRadius: 7, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            + Prescribe Medication
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: `1px solid ${C.border}` }}>
        {[
          { id: 'prescriptions', label: 'Prescriptions' },
          { id: 'history', label: 'Administration History' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '10px 18px', border: 'none', background: 'transparent',
              fontSize: 13, fontWeight: 700,
              color: tab === t.id ? C.blue : C.muted,
              borderBottom: `2px solid ${tab === t.id ? C.blue : 'transparent'}`,
              cursor: 'pointer',
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* PRESCRIPTIONS TAB */}
      {tab === 'prescriptions' && (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={lbl}>Resident</label>
              <ResidentDropdown residents={residents} value={residentFilterId || null} onChange={setResidentFilterId} placeholder="Select resident..." />
            </div>
            <div style={{ flex: '0 0 160px' }}>
              <label style={lbl}>Status</label>
              <Sel value={filterStatus} onChange={setFilterStatus} options={[
                { value: 'all', label: 'All' },
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Discontinued' },
              ]} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button onClick={() => setResidentFilterId('')} style={{ padding: '9px 14px', background: C.bluePale, border: `1px solid ${C.blueBorder}`, borderRadius: 7, color: C.blue, fontSize: 13, cursor: 'pointer' }}>Clear</button>
            </div>
          </div>

          {loading ? (
            <EmptyState title="Loading..." desc="Fetching prescriptions" />
          ) : error ? (
            <div style={{ background: C.redBg, border: `1px solid ${C.red}`, borderRadius: 10, padding: '14px 18px', color: C.red, fontSize: 13 }}>{error}</div>
          ) : filteredMeds.length === 0 ? (
            <EmptyState title="No prescriptions" desc="Click '+ Prescribe Medication' to add the first one." />
          ) : (
            <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: C.bluePale }}>
                    {['Resident', 'Drug', 'Dosage', 'Frequency', 'Route', 'Prescriber', 'Status', 'Action'].map(h => (
                      <th key={h} style={{ padding: '9px 12px', textAlign: 'left', color: C.navy, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: `1px solid ${C.blueBorder}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredMeds.map(m => (
                    <tr key={m.id} style={{ borderBottom: `1px solid ${C.border}`, background: !m.is_active ? '#fafafa' : C.white }}>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: C.navy }}>
                        {`${m.first_name || ''} ${m.last_name || ''}`.trim() || '—'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 600 }}>{m.drug_name}</div>
                        {m.drug_strength && <div style={{ fontSize: 11, color: C.muted }}>{m.drug_strength}</div>}
                      </td>
                      <td style={{ padding: '10px 12px' }}>{m.dosage}</td>
                      <td style={{ padding: '10px 12px' }}>
                        {m.frequency}{m.is_prn && <span style={{ marginLeft: 6, background: C.amberBg, color: C.amber, padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 700 }}>PRN</span>}
                      </td>
                      <td style={{ padding: '10px 12px' }}>{m.route}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12 }}>{m.prescriber}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <Badge status={m.is_active ? 'Active' : 'Discontinued'} />
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {m.is_active && (
                          <button
                            onClick={() => setDiscontinuing(m)}
                            style={{ padding: '4px 10px', border: `1px solid ${C.red}`, background: C.redBg, color: C.red, borderRadius: 5, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}
                          >
                            Discontinue
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* HISTORY TAB */}
      {tab === 'history' && (
        <>
          {admins.length === 0 ? (
            <EmptyState title="No administrations yet" desc="Once staff start administering medications, the history will appear here." />
          ) : (
            <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: C.bluePale }}>
                    {['When', 'Resident', 'Drug', 'Dose', 'Staff', 'Status', 'Notes'].map(h => (
                      <th key={h} style={{ padding: '9px 12px', textAlign: 'left', color: C.navy, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: `1px solid ${C.blueBorder}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {admins.map(a => (
                    <tr key={a.id} style={{
                      borderBottom: `1px solid ${C.border}`,
                      borderLeft: a.was_refused ? `3px solid ${C.red}` : '3px solid transparent',
                      background: a.was_refused ? C.redBg : C.white,
                    }}>
                      <td style={{ padding: '10px 12px', fontSize: 12 }}>{fmtTime(a.administered_at)}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: C.navy }}>
                        {`${a.first_name || ''} ${a.last_name || ''}`.trim() || '—'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>{a.drug_name}</td>
                      <td style={{ padding: '10px 12px' }}>{a.dose_given || a.dosage || '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12 }}>
                        {`${a.staff_first_name || ''} ${a.staff_last_name || ''}`.trim() || '—'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <Badge status={a.was_refused ? 'Refused' : 'Given'} />
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, maxWidth: 240, color: C.muted }}>
                        {a.was_refused ? a.refusal_reason : (a.notes || a.prn_reason || '—')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* PRESCRIPTION FORM MODAL */}
      {showForm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,45,94,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: C.bg, borderRadius: 12, width: 'min(720px, 95vw)', maxHeight: '92vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: C.navy, padding: '16px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '12px 12px 0 0' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>New Prescription</div>
              <button onClick={() => { setShowForm(false); setFormError(''); }} disabled={submitting}
                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, color: '#fff', cursor: submitting ? 'default' : 'pointer', fontSize: 16, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: submitting ? 0.5 : 1 }}>✕</button>
            </div>
            <div style={{ padding: 24, flex: 1, overflowY: 'auto' }}>
              <Grid cols={2}>
                <F label="Resident *">
                  <Sel value={form.resident_id} onChange={v => setF('resident_id', v)}
                    options={residents.map(r => ({ value: r.id, label: `${r.first_name || ''} ${r.last_name || ''}`.trim() }))} />
                </F>
                <F label="Prescriber *">
                  <TI value={form.prescriber} onChange={v => setF('prescriber', v)} placeholder="Dr. Last Name" />
                </F>
              </Grid>
              <div style={{ height: 12 }} />
              <Grid cols={2}>
                <F label="Drug Name *">
                  <TI value={form.drug_name} onChange={v => setF('drug_name', v)} placeholder="e.g., Sertraline" />
                </F>
                <F label="Strength">
                  <TI value={form.drug_strength} onChange={v => setF('drug_strength', v)} placeholder="e.g., 50mg" />
                </F>
              </Grid>
              <div style={{ height: 12 }} />
              <Grid cols={3}>
                <F label="Dosage *">
                  <TI value={form.dosage} onChange={v => setF('dosage', v)} placeholder="e.g., 1 tablet" />
                </F>
                <F label="Route *">
                  <Sel value={form.route} onChange={v => setF('route', v)} options={[
                    { value: 'oral', label: 'Oral' },
                    { value: 'sublingual', label: 'Sublingual' },
                    { value: 'topical', label: 'Topical' },
                    { value: 'injection', label: 'Injection' },
                    { value: 'inhalation', label: 'Inhalation' },
                    { value: 'transdermal', label: 'Transdermal' },
                    { value: 'other', label: 'Other' },
                  ]} />
                </F>
                <F label="Frequency *">
                  <Sel value={form.frequency} onChange={v => setF('frequency', v)} options={[
                    { value: 'Once daily', label: 'Once daily' },
                    { value: 'Twice daily', label: 'Twice daily' },
                    { value: 'Three times daily', label: 'Three times daily' },
                    { value: 'Four times daily', label: 'Four times daily' },
                    { value: 'Every morning', label: 'Every morning' },
                    { value: 'Every evening', label: 'Every evening' },
                    { value: 'At bedtime', label: 'At bedtime' },
                    { value: 'As needed', label: 'As needed (PRN)' },
                    { value: 'Weekly', label: 'Weekly' },
                    { value: 'Monthly', label: 'Monthly' },
                  ]} />
                </F>
              </Grid>
              <div style={{ height: 12 }} />
              <Grid cols={2}>
                <F label="Indication">
                  <TI value={form.indication} onChange={v => setF('indication', v)} placeholder="What it's prescribed for" />
                </F>
                <F label="Start Date *">
                  <TI type="date" value={form.start_date} onChange={v => setF('start_date', v)} />
                </F>
              </Grid>
              <div style={{ height: 12 }} />
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.is_controlled_substance}
                    onChange={e => setF('is_controlled_substance', e.target.checked)} />
                  Controlled substance
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.is_prn}
                    onChange={e => setF('is_prn', e.target.checked)} />
                  PRN (as needed)
                </label>
              </div>
              {form.is_prn && (
                <div style={{ marginTop: 12 }}>
                  <F label="PRN Instructions">
                    <TA value={form.prn_instructions} onChange={v => setF('prn_instructions', v)} placeholder="When to administer (e.g., 'For pain > 5/10')" rows={2} />
                  </F>
                </div>
              )}
              <div style={{ marginTop: 12 }}>
                <F label="Special Instructions">
                  <TA value={form.special_instructions} onChange={v => setF('special_instructions', v)} placeholder="Any additional notes for staff" rows={2} />
                </F>
              </div>
              {formError && (
                <div style={{ marginTop: 16, background: C.redBg, border: `1px solid ${C.red}`, borderRadius: 7, padding: '10px 12px', color: C.red, fontSize: 13 }}>{formError}</div>
              )}
            </div>
            <div style={{ background: C.white, padding: '14px 22px', display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: `1px solid ${C.border}`, borderRadius: '0 0 12px 12px' }}>
              <button onClick={() => setShowForm(false)} disabled={submitting}
                style={{ padding: '9px 18px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: submitting ? 'default' : 'pointer', color: C.muted }}>Cancel</button>
              <button onClick={handleSubmit} disabled={submitting}
                style={{ padding: '9px 18px', background: C.blue, border: 'none', borderRadius: 7, color: '#fff', fontSize: 13, fontWeight: 700, cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.5 : 1 }}>
                {submitting ? 'Saving…' : 'Prescribe'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DISCONTINUE MODAL */}
      {discontinuing && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,45,94,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: C.bg, borderRadius: 12, width: 'min(480px, 95vw)' }}>
            <div style={{ background: C.navy, padding: '16px 22px', borderRadius: '12px 12px 0 0', color: '#fff', fontSize: 15, fontWeight: 700 }}>
              Discontinue {discontinuing.drug_name}
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>
                This will mark the prescription as inactive. Staff will no longer see it.
              </div>
              <F label="Reason (Optional)">
                <TA value={discontinueReason} onChange={setDiscontinueReason} placeholder="e.g., Therapy completed, adverse reaction..." rows={3} />
              </F>
            </div>
            <div style={{ background: C.white, padding: '14px 22px', display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: `1px solid ${C.border}`, borderRadius: '0 0 12px 12px' }}>
              <button onClick={() => { setDiscontinuing(null); setDiscontinueReason(''); }}
                style={{ padding: '9px 18px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, cursor: 'pointer', color: C.muted }}>Cancel</button>
              <button onClick={handleDiscontinue}
                style={{ padding: '9px 18px', background: C.red, border: 'none', borderRadius: 7, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Discontinue</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ─── SECTION: RESIDENT REQUESTS ───────────────────────────────────────────────
function ResidentRequestsSection() {
  const { auth } = useAuth();
  const [list, setList]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [selected, setSelected]     = useState(null); // request being reviewed
  const [responseText, setResponseText] = useState('');
  const [newStatus, setNewStatus]   = useState('');
  const [saving, setSaving]         = useState(false);
  const [saveError, setSaveError]   = useState('');

  const fetchList = useCallback(async () => {
    if (!auth) return;
    setLoading(true);
    setError(null);
    try {
      const params = statusFilter && statusFilter !== 'all' ? `?status=${statusFilter}&limit=100` : '?limit=100';
      const res = await fetch(`/api/v1/resident-requests${params}`, {
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

  const openReview = (req) => {
    setSelected(req);
    setResponseText(req.response || '');
    setNewStatus(req.status || 'pending');
    setSaveError('');
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch(`/api/v1/resident-requests/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.accessToken}` },
        credentials: 'same-origin',
        body: JSON.stringify({ status: newStatus, response: responseText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setSelected(null);
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

  const priorityBadge = (p) => {
    if (p === 'urgent' || p === 'high') return <span style={{ background: C.redBg, color: C.red, padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700 }}>{p?.toUpperCase()}</span>;
    if (p === 'low') return <span style={{ background: '#f3f4f6', color: '#6b7280', padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700 }}>LOW</span>;
    return null;
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: C.navy, margin: 0 }}>Resident Requests</h2>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>Review and respond to resident requests</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['pending', 'approved', 'fulfilled', 'denied', 'all'].map(s => (
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
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: 32, textAlign: 'center', color: C.muted }}>Loading requests…</div>
      ) : error ? (
        <div style={{ background: C.redBg, border: `1px solid ${C.red}`, borderRadius: 10, padding: '14px 18px', color: C.red, fontSize: 13 }}>Failed to load: {error}</div>
      ) : list.length === 0 ? (
        <EmptyState title="No resident requests" icon="◇" desc={`No ${statusFilter === 'all' ? '' : statusFilter + ' '}requests at this time.`} />
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {list.map(req => (
            <div
              key={req.id}
              onClick={() => openReview(req)}
              style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 14 }}
              onMouseEnter={e => e.currentTarget.style.background = C.bluePale}
              onMouseLeave={e => e.currentTarget.style.background = C.white}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 5, flexWrap: 'wrap' }}>
                  {statusBadge(req.status)}
                  {priorityBadge(req.priority)}
                  <span style={{ background: C.bluePale, color: C.blue, padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700 }}>{req.type || 'general'}</span>
                </div>
                <div style={{ fontWeight: 700, color: C.navy, fontSize: 14, marginBottom: 4 }}>
                  {req.resident_name || `Resident #${req.resident_id}`}
                </div>
                <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5, marginBottom: 4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {req.details || req.description || '—'}
                </div>
                {req.responded_by && (
                  <div style={{ fontSize: 11, color: C.green, marginTop: 3 }}>
                    Responded by {req.responded_by_name || req.responded_by}
                    {req.responded_at && ` · ${new Date(req.responded_at).toLocaleDateString()}`}
                  </div>
                )}
              </div>
              <div style={{ fontSize: 11, color: C.muted, whiteSpace: 'nowrap', flexShrink: 0 }}>
                {req.created_at ? new Date(req.created_at).toLocaleDateString() : '—'}
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <Modal title="Review Request" onClose={() => setSelected(null)}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>Resident</div>
            <div style={{ fontWeight: 700, color: C.navy }}>{selected.resident_name || `Resident #${selected.resident_id}`}</div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>Type</div>
            <div style={{ color: C.text, fontSize: 13 }}>{selected.type || '—'}</div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>Request Details</div>
            <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '12px 14px', fontSize: 13, color: C.text, lineHeight: 1.6 }}>
              {selected.details || selected.description || '—'}
            </div>
          </div>
          <F label="Status">
            <select value={newStatus} onChange={e => setNewStatus(e.target.value)} style={{ ...inp, appearance: 'none' }}>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="fulfilled">Fulfilled</option>
              <option value="denied">Denied</option>
            </select>
          </F>
          <div style={{ marginTop: 14 }}>
            <F label="Response / Notes">
              <TA value={responseText} onChange={setResponseText} placeholder="Enter your response or notes for this request…" rows={4} />
            </F>
          </div>
          {selected.responded_by && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: C.greenBg, border: `1px solid ${C.green}40`, borderRadius: 8, fontSize: 12, color: C.green }}>
              Previously responded by {selected.responded_by_name || selected.responded_by}
              {selected.responded_at && ` on ${new Date(selected.responded_at).toLocaleDateString()}`}
            </div>
          )}
          {saveError && <div style={{ marginTop: 12, color: C.red, fontSize: 13 }}>{saveError}</div>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            <button onClick={() => setSelected(null)} style={{ padding: '9px 18px', background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, cursor: 'pointer', color: C.muted }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{ padding: '9px 22px', background: C.navy, border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Saving…' : 'Save Response'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── SECTION: ACTIVITIES ───────────────────────────────────────────────────────
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function ActivitiesSection() {
  const { auth } = useAuth();
  const [list, setList]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [showForm, setShowForm]     = useState(false);
  const [editing, setEditing]       = useState(null);
  const [form, setForm]             = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState('');
  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const fetchList = useCallback(async () => {
    if (!auth) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/activities?limit=200', {
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
  }, [auth]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const openNew = () => {
    setEditing(null);
    setForm({ day_of_week: 'Monday', start_time: '', name: '', location: '', category: '', description: '', duration_minutes: '', active: true });
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (act) => {
    setEditing(act);
    setForm({ day_of_week: act.day_of_week, start_time: act.start_time || '', name: act.name || '', location: act.location || '', category: act.category || '', description: act.description || '', duration_minutes: act.duration_minutes ?? '', active: act.active !== false });
    setFormError('');
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.day_of_week) { setFormError('Activity name and day are required.'); return; }
    setSubmitting(true);
    setFormError('');
    try {
      const url = editing ? `/api/v1/activities/${editing.id}` : '/api/v1/activities';
      const method = editing ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.accessToken}` },
        credentials: 'same-origin',
        body: JSON.stringify({ ...form, duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save activity');
      setShowForm(false);
      setEditing(null);
      setForm({});
      fetchList();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this activity?')) return;
    try {
      await fetch(`/api/v1/activities/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${auth.accessToken}` },
        credentials: 'same-origin',
      });
      setList(prev => prev.filter(a => a.id !== id));
    } catch { /* silent */ }
  };

  const handleToggleActive = async (act) => {
    try {
      const res = await fetch(`/api/v1/activities/${act.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.accessToken}` },
        credentials: 'same-origin',
        body: JSON.stringify({ active: !act.active }),
      });
      if (res.ok) setList(prev => prev.map(a => a.id === act.id ? { ...a, active: !act.active } : a));
    } catch { /* silent */ }
  };

  // Group by day_of_week
  const byDay = DAY_NAMES.reduce((acc, d) => { acc[d] = list.filter(a => a.day_of_week === d); return acc; }, {});

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: C.navy, margin: 0 }}>Weekly Activities</h2>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>Manage the resident activity schedule</div>
        </div>
        <button onClick={openNew} style={{ padding: '9px 18px', background: C.navy, border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Add Activity</button>
      </div>

      {loading ? (
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: 32, textAlign: 'center', color: C.muted }}>Loading activities…</div>
      ) : error ? (
        <div style={{ background: C.redBg, border: `1px solid ${C.red}`, borderRadius: 10, padding: '14px 18px', color: C.red, fontSize: 13 }}>Failed to load: {error}</div>
      ) : list.length === 0 ? (
        <EmptyState title="No activities scheduled" icon="◆" desc='Click "+ Add Activity" to schedule a recurring weekly activity.' />
      ) : (
        <div style={{ display: 'grid', gap: 20 }}>
          {DAY_NAMES.map(day => {
            const acts = byDay[day];
            if (!acts.length) return null;
            return (
              <div key={day}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.blue, textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: `2px solid ${C.blueBorder}`, paddingBottom: 6, marginBottom: 10 }}>{day}</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {acts.map(act => (
                    <div key={act.id} style={{ background: C.white, border: `1px solid ${act.active ? C.border : '#e5e7eb'}`, borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14, opacity: act.active ? 1 : 0.6 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, color: C.navy, fontSize: 14 }}>{act.name}</span>
                          {!act.active && <span style={{ background: '#f3f4f6', color: '#6b7280', padding: '1px 7px', borderRadius: 10, fontSize: 10, fontWeight: 700 }}>INACTIVE</span>}
                          {act.category && <span style={{ background: C.purpleBg, color: C.purple, padding: '1px 7px', borderRadius: 10, fontSize: 10, fontWeight: 700 }}>{act.category}</span>}
                        </div>
                        <div style={{ fontSize: 12, color: C.muted }}>
                          {act.start_time && <span>{act.start_time}</span>}
                          {act.duration_minutes && <span> · {act.duration_minutes} min</span>}
                          {act.location && <span> · {act.location}</span>}
                        </div>
                        {act.description && <div style={{ fontSize: 12, color: C.text, marginTop: 4, lineHeight: 1.5 }}>{act.description}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button onClick={() => handleToggleActive(act)} title={act.active ? 'Deactivate' : 'Activate'} style={{ padding: '5px 10px', background: act.active ? C.greenBg : '#f3f4f6', border: `1px solid ${act.active ? C.green + '40' : '#e5e7eb'}`, borderRadius: 6, color: act.active ? C.green : C.muted, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{act.active ? 'Active' : 'Off'}</button>
                        <button onClick={() => openEdit(act)} style={{ padding: '5px 10px', background: C.bluePale, border: `1px solid ${C.blueBorder}`, borderRadius: 6, color: C.blue, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Edit</button>
                        <button onClick={() => handleDelete(act.id)} style={{ padding: '5px 10px', background: C.redBg, border: `1px solid #fca5a5`, borderRadius: 6, color: C.red, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Del</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <Modal title={editing ? 'Edit Activity' : 'New Activity'} onClose={() => { setShowForm(false); setEditing(null); }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 18px' }}>
            <F label="Activity Name" span={2}>
              <TI value={form.name} onChange={v => setF('name', v)} placeholder="e.g., Morning Yoga" />
            </F>
            <F label="Day of Week">
              <select value={form.day_of_week || 'Monday'} onChange={e => setF('day_of_week', e.target.value)} style={{ ...inp, appearance: 'none' }}>
                {DAY_NAMES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </F>
            <F label="Start Time">
              <TI value={form.start_time} onChange={v => setF('start_time', v)} placeholder="e.g., 9:00 AM" />
            </F>
            <F label="Duration (minutes)">
              <TI value={form.duration_minutes} onChange={v => setF('duration_minutes', v)} type="number" placeholder="60" />
            </F>
            <F label="Location">
              <TI value={form.location} onChange={v => setF('location', v)} placeholder="e.g., Community Room" />
            </F>
            <F label="Category">
              <select value={form.category || ''} onChange={e => setF('category', e.target.value)} style={{ ...inp, appearance: 'none' }}>
                <option value="">Select category</option>
                {['Therapy', 'Wellness', 'Creative', 'Life Skills', 'Community'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </F>
            <F label="Active">
              <select value={form.active ? 'yes' : 'no'} onChange={e => setF('active', e.target.value === 'yes')} style={{ ...inp, appearance: 'none' }}>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </F>
            <F label="Description" span={2}>
              <TA value={form.description} onChange={v => setF('description', v)} placeholder="Optional details…" rows={3} />
            </F>
          </div>
          {formError && <div style={{ marginTop: 12, color: C.red, fontSize: 13 }}>{formError}</div>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            <button onClick={() => { setShowForm(false); setEditing(null); }} style={{ padding: '9px 18px', background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, cursor: 'pointer', color: C.muted }}>Cancel</button>
            <button onClick={handleSubmit} disabled={submitting} style={{ padding: '9px 22px', background: C.navy, border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 13, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
              {submitting ? 'Saving…' : editing ? 'Save Changes' : 'Add Activity'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── ACCOUNT MANAGEMENT SECTION ──────────────────────────────────────────────
// Gmail/Google-Admin style account row: initials avatar, stacked name+email,
// role chip, status pill, and rounded actions revealed on row hover.
function AccountRow({ a, onReset, onDeactivate, onReactivate }) {
  const [hover, setHover] = useState(false);
  const name = ((a.first_name || '') + ' ' + (a.last_name || '')).trim() || '—';
  const initials = (((a.first_name?.[0] || '') + (a.last_name?.[0] || '')) || (a.email?.[0] || '?')).toUpperCase();
  const td = { padding: "11px 14px", verticalAlign: "middle" };
  const actBtn = {
    display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px",
    fontSize: 12, fontWeight: 600, borderRadius: 999, cursor: "pointer", fontFamily: "inherit",
  };
  return (
    <tr
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ borderBottom: "1px solid var(--admin-border-soft)", background: hover ? "var(--admin-canvas)" : "transparent", transition: "background 0.12s ease" }}
    >
      <td style={td}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <span style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--admin-accent-soft)", color: "var(--admin-accent)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{initials}</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.navy }}>{name}</span>
        </div>
      </td>
      <td style={{ ...td, color: C.text }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Mail size={13} strokeWidth={1.8} style={{ color: C.muted, flexShrink: 0 }} /> {a.email}
        </span>
      </td>
      <td style={td}>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: C.text, background: C.draftBg, padding: "3px 10px", borderRadius: 999, textTransform: "capitalize", whiteSpace: "nowrap" }}>{(a.role || '').replace(/_/g, ' ')}</span>
      </td>
      <td style={{ ...td, color: C.muted, fontSize: 12.5, whiteSpace: "nowrap" }}>{a.last_login ? new Date(a.last_login).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}</td>
      <td style={td}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, padding: "3px 10px 3px 8px", borderRadius: 999, background: a.is_active ? "var(--admin-accent-soft)" : "var(--admin-danger-bg)", color: a.is_active ? "var(--admin-accent)" : "var(--admin-danger)", fontWeight: 600, whiteSpace: "nowrap" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />
          {a.is_active ? "Active" : "Inactive"}
        </span>
      </td>
      <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
        <div style={{ display: "inline-flex", gap: 6, justifyContent: "flex-end" }}>
          <button onClick={() => onReset(a)} style={{ ...actBtn, background: "transparent", color: "var(--admin-accent)", border: "1px solid var(--admin-border)" }}>
            <KeyRound size={13} strokeWidth={1.9} /> Reset
          </button>
          {a.is_active ? (
            <button onClick={() => onDeactivate(a)} style={{ ...actBtn, background: "transparent", color: "var(--admin-danger)", border: "1px solid var(--admin-border)" }}>Deactivate</button>
          ) : (
            <button onClick={() => onReactivate(a)} style={{ ...actBtn, background: "transparent", color: "var(--admin-accent)", border: "1px solid var(--admin-border)" }}>
              <Check size={13} strokeWidth={2} /> Reactivate
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function AccountManagementSection({ api }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [resetTarget, setResetTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showResult, setShowResult] = useState(null);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '500' });
      if (roleFilter !== 'all') params.set('role', roleFilter);
      if (statusFilter === 'active') params.set('active', '1');
      if (statusFilter === 'inactive') params.set('active', '0');
      if (search.trim()) params.set('search', search.trim());
      const res = await api(`/api/v1/admin/accounts?${params.toString()}`);
      setAccounts(res.data || []);
    } catch (err) {
    } finally {
      setLoading(false);
    }
  }, [api, roleFilter, statusFilter, search]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  const onDeactivate = async (acct, reason) => {
    try {
      await api(`/api/v1/admin/accounts/${acct.id}`, {
        method: 'DELETE',
        body: JSON.stringify({ reason: reason || null }),
      });
      setDeleteTarget(null);
      await loadAccounts();
    } catch (err) {
      alert('Deactivate failed: ' + err.message);
    }
  };

  const onReactivate = async (acct) => {
    try {
      await api(`/api/v1/admin/accounts/${acct.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: true }),
      });
      await loadAccounts();
    } catch (err) {
      alert('Reactivate failed: ' + err.message);
    }
  };

  const onResetPassword = async ({ generate, password }) => {
    try {
      const res = await api(`/api/v1/admin/accounts/${resetTarget.id}/password`, {
        method: 'POST',
        body: JSON.stringify({ generate, password, notify: true }),
      });
      setResetTarget(null);
      setShowResult({
        email: res.email,
        password: res.password,
        generated: res.generated,
      });
    } catch (err) {
      alert('Reset failed: ' + err.message);
    }
  };

  const counts = {
    total: accounts.length,
    active: accounts.filter(a => a.is_active).length,
    staff: accounts.filter(a => a.account_type === 'staff').length,
    residents: accounts.filter(a => a.account_type === 'resident').length,
  };

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ fontFamily: "var(--font-fraunces), Georgia, serif", fontSize: 22, fontWeight: 500, color: C.navy, margin: 0, letterSpacing: "-0.01em" }}>Account Management</h2>
        <div style={{ fontSize: 12.5, color: C.muted, marginTop: 3 }}>Manage staff &amp; resident login credentials, reset passwords, and deactivate accounts.</div>
      </div>

      {/* Stat strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 }}>
        {[
          { label: "Total", value: counts.total, accent: false },
          { label: "Active", value: counts.active, accent: true },
          { label: "Staff", value: counts.staff, accent: false },
          { label: "Residents", value: counts.residents, accent: false },
        ].map(s => (
          <div key={s.label} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px", boxShadow: "0 1px 3px rgba(15,23,42,0.05)" }}>
            <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5, fontWeight: 700 }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: s.accent ? "var(--admin-accent)" : C.navy, lineHeight: 1 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ flex: "1 1 240px", position: "relative", display: "flex", alignItems: "center" }}>
          <Search size={15} strokeWidth={1.9} style={{ position: "absolute", left: 13, color: C.muted, pointerEvents: "none" }} />
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: "100%", padding: "9px 14px 9px 36px", border: `1px solid ${C.border}`, borderRadius: 999, fontSize: 14, fontFamily: "inherit", background: C.white, color: C.text, outline: "none", boxSizing: "border-box" }}
            {...inputFocusHandlers}
          />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={{ padding: "9px 14px", border: `1px solid ${C.border}`, borderRadius: 999, fontSize: 13.5, fontFamily: "inherit", background: C.white, color: C.text, cursor: "pointer" }}>
          <option value="all">All roles</option>
          <option value="admin">Admin</option>
          <option value="manager">Manager</option>
          <option value="staff">Staff</option>
          <option value="resident_care_of">Resident</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: "9px 14px", border: `1px solid ${C.border}`, borderRadius: 999, fontSize: 13.5, fontFamily: "inherit", background: C.white, color: C.text, cursor: "pointer" }}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: 32, textAlign: "center", color: C.muted, boxShadow: "0 1px 3px rgba(15,23,42,0.05)" }}>Loading accounts…</div>
      ) : accounts.length === 0 ? (
        <EmptyState title="No accounts match" Icon={KeyRound} desc="Adjust filters or seed accounts to get started." />
      ) : (
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 3px rgba(15,23,42,0.05)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "var(--admin-canvas)", borderBottom: `1px solid var(--admin-border-soft)` }}>
                {["Name", "Email", "Role", "Last Login", "Status"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "11px 14px", fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>{h}</th>
                ))}
                <th style={{ textAlign: "right", padding: "11px 14px", fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map(a => (
                <AccountRow
                  key={a.id}
                  a={a}
                  onReset={setResetTarget}
                  onDeactivate={setDeleteTarget}
                  onReactivate={onReactivate}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reset password modal */}
      {resetTarget && (
        <ResetPasswordModal
          account={resetTarget}
          onClose={() => setResetTarget(null)}
          onSubmit={onResetPassword}
        />
      )}

      {/* Result modal */}
      {showResult && (
        <CredentialResultModal
          email={showResult.email}
          password={showResult.password}
          generated={showResult.generated}
          onClose={() => setShowResult(null)}
        />
      )}

      {/* Deactivate confirm */}
      {deleteTarget && (
        <DeactivateConfirmModal
          account={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={(reason) => onDeactivate(deleteTarget, reason)}
        />
      )}
    </div>
  );
}

function ResetPasswordModal({ account, onClose, onSubmit }) {
  const [mode, setMode] = useState('generate');
  const [pwd, setPwd] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const valid = mode === 'generate' || (pwd.length >= 8 && pwd.length <= 128);

  const submit = async () => {
    if (!valid) return;
    setSubmitting(true);
    await onSubmit({ generate: mode === 'generate', password: mode === 'type' ? pwd : undefined });
    setSubmitting(false);
  };

  return (
    <Modal onClose={onClose} title={`Reset password — ${account.email}`}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 13, color: C.muted }}>
          Choose how to set this user&apos;s new password. They will be required to change it on next login.
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => setMode('generate')}
            style={{
              flex: 1,
              padding: "10px 12px",
              border: `2px solid ${mode === 'generate' ? C.blue : C.border}`,
              background: mode === 'generate' ? C.bluePale : C.white,
              borderRadius: 6,
              cursor: "pointer",
              fontFamily: "inherit",
              fontWeight: 600,
              color: mode === 'generate' ? C.blue : C.text,
            }}
          >Generate a secure password</button>
          <button
            onClick={() => setMode('type')}
            style={{
              flex: 1,
              padding: "10px 12px",
              border: `2px solid ${mode === 'type' ? C.blue : C.border}`,
              background: mode === 'type' ? C.bluePale : C.white,
              borderRadius: 6,
              cursor: "pointer",
              fontFamily: "inherit",
              fontWeight: 600,
              color: mode === 'type' ? C.blue : C.text,
            }}
          >Type a custom password</button>
        </div>
        {mode === 'type' && (
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }}>New password (8–128 chars)</label>
            <input
              type="text"
              value={pwd}
              onChange={e => setPwd(e.target.value)}
              placeholder="Type the password the user will use"
              autoComplete="new-password"
              style={{ width: "100%", padding: "10px 12px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, fontFamily: "ui-monospace, Menlo, monospace" }}
            />
            <div style={{ fontSize: 11, color: pwd.length === 0 ? C.muted : (valid ? C.muted : "#991b1b"), marginTop: 4 }}>
              {pwd.length === 0 ? "Will be shown to the user once. Make it temporary." : (valid ? `${pwd.length} chars` : `${pwd.length} chars — must be 8–128`)}
            </div>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
          <button onClick={onClose} style={{ padding: "8px 14px", border: `1px solid ${C.border}`, background: C.white, borderRadius: 6, cursor: "pointer", fontFamily: "inherit", color: C.text }}>Cancel</button>
          <button
            onClick={submit}
            disabled={!valid || submitting}
            style={{ padding: "8px 14px", border: "none", background: valid && !submitting ? C.blue : C.muted, color: C.white, borderRadius: 6, cursor: valid && !submitting ? "pointer" : "not-allowed", fontFamily: "inherit", fontWeight: 600 }}
          >{submitting ? "Saving…" : "Reset password"}</button>
        </div>
      </div>
    </Modal>
  );
}

function CredentialResultModal({ email, password, generated, onClose }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Email: ${email}\nPassword: ${password}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* ignore */ }
  };
  return (
    <Modal onClose={onClose} title={generated ? "Password generated" : "Password reset"}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ padding: 12, background: "var(--admin-warning-bg)", border: "1px solid rgba(242,147,57,0.3)", borderRadius: 6, color: "var(--admin-warning)", fontSize: 13, fontWeight: 600 }}>
          ⚠️ One-time view — copy and securely transmit this password to the user now. It will not be shown again.
        </div>
        <div>
          <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, fontWeight: 600 }}>Email</div>
          <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 14, padding: "10px 12px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, userSelect: "all" }}>{email}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, fontWeight: 600 }}>Password</div>
          <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 16, padding: "10px 12px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, userSelect: "all", letterSpacing: "0.04em" }}>{password}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 6 }}>
          <button onClick={copy} style={{ padding: "8px 14px", border: `1px solid ${C.blueBorder}`, background: copied ? C.blue : C.bluePale, color: copied ? C.white : C.blue, borderRadius: 6, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
            {copied ? "✓ Copied" : "Copy both"}
          </button>
          <button onClick={onClose} style={{ padding: "8px 14px", border: "none", background: C.navy, color: C.white, borderRadius: 6, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>Done</button>
        </div>
      </div>
    </Modal>
  );
}

function DeactivateConfirmModal({ account, onCancel, onConfirm }) {
  const [reason, setReason] = useState('');
  return (
    <Modal onClose={onCancel} title={`Deactivate account — ${account.email}`}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ padding: 12, background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 6, color: "#991b1b", fontSize: 13 }}>
          The user will no longer be able to log in. Their data and audit history are preserved. You can reactivate the account later.
        </div>
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }}>Reason (optional)</label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value.slice(0, 500))}
            rows={3}
            placeholder="e.g., No longer with the facility"
            style={{ width: "100%", padding: "10px 12px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, fontFamily: "inherit", resize: "vertical" }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
          <button onClick={onCancel} style={{ padding: "8px 14px", border: `1px solid ${C.border}`, background: C.white, borderRadius: 6, cursor: "pointer", fontFamily: "inherit", color: C.text }}>Cancel</button>
          <button onClick={() => onConfirm(reason)} style={{ padding: "8px 14px", border: "none", background: "#dc2626", color: C.white, borderRadius: 6, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>Deactivate account</button>
        </div>
      </div>
    </Modal>
  );
}

// ─── NAV ─────────────────────────────────────────────────────────────────────
// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function AdminApp() {
  const { auth, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const initialView = searchParams.get('view') || 'dashboard';

  const [view, setViewState]        = useState(initialView);
  // Wrap setView so every section change syncs the URL (`?view=<id>`).
  // Uses replaceState (not push) so in-page section switches don't pollute
  // browser history — back/forward still jumps across actual route changes.
  const setView = useCallback((next) => {
    setViewState(next);
    if (typeof window !== 'undefined') {
      const url = next === 'dashboard' ? '/admin' : `/admin?view=${next}`;
      window.history.replaceState({ view: next }, '', url);
    }
  }, []);
  // Sync state back from URL on browser back/forward.
  useEffect(() => {
    const onPop = () => {
      const p = new URLSearchParams(window.location.search);
      setViewState(p.get('view') || 'dashboard');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const [residents, setResidents]   = useState([]);
  const [staff, setStaff]           = useState([]);
  const [stats, setStats]           = useState(null);
  const [pendingMedCount, setPendingMedCount] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const api = useApi(auth);

  useEffect(() => {
    if (!authLoading) {
      if (!auth) {
        router.replace("/");
      } else if (auth.user && auth.user.role && !['admin', 'administrator'].includes(auth.user.role.toLowerCase())) {
        // Only admins can access this page
        router.replace("/");
      }
    }
  }, [auth, authLoading, router]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    if (viewParam) {
      setView(viewParam);
    }
  }, [setView]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const fetchResidents = useCallback(() => {
    api("/api/v1/residents").then(d => {
      setResidents(d.data || []);
    }).catch(() => {});
  }, [api]);

  const fetchStaff = useCallback(() => {
    api("/api/v1/staff").then(d => {
      setStaff(d.data || []);
    }).catch(() => {});
  }, [api]);

  const fetchStats = useCallback(() => {
    api("/api/v1/dashboard").then(d => {
      setStats(d.data || null);
    }).catch(() => {});
  }, [api]);

  useEffect(() => {
    if (auth) { fetchResidents(); fetchStaff(); fetchStats(); }
  }, [auth, fetchResidents, fetchStaff, fetchStats]);

  if (authLoading || !auth) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "sans-serif", background: C.bg }}>
        <div style={{ color: C.muted, fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  const displayName = auth.user?.first_name
    ? `${auth.user.first_name} ${auth.user.last_name || ""}`.trim()
    : auth.user?.email?.split("@")[0] || "Admin";

  const initials = displayName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  const sidebarBadges = {
    daily_progress_notes: Number(stats?.pending_daily_progress_notes ?? 0),
    incident_reports:     Number(stats?.pending_incident_reports     ?? 0),
    drug_disposal:        Number(stats?.pending_drug_disposals       ?? 0),
    evacuation_drills:    Number(stats?.pending_evacuation_drills    ?? 0),
    pending_admissions:   Number(stats?.pending_admissions           ?? 0),
  };
  const totalAlerts = Object.values(sidebarBadges).reduce((a, b) => a + (b || 0), 0);

  const pages = {
    dashboard:     <DashboardSection setView={setView} stats={stats} residents={residents} staff={staff} />,
    residents:     <ResidentsSection residents={residents} />,
    staff:         <StaffSection staff={staff} onRefresh={fetchStaff} />,
    pre_screening: <PreScreeningRedirect />,
    pending_admissions: <PendingAdmissionsSection />,
    face_sheets:   <FaceSheetsSection residents={residents} />,
    evacuation:    <StubSection title="Evacuation Drills" desc="OAR 411-050-0725(3) · AFH required drills" buttonLabel="+ Log Drill" buttonColor={C.gold} />,
    care_plans:    <CarePlansSection api={api} residents={residents} />,
    appointments:  <AppointmentsSection api={api} residents={residents} />,
    medications:   <MedicationsSection />,
    reports:       <ReportsSection />,
    daily_progress_notes: <DailyProgressNotesSection />,
    incident_reports:     <IncidentReportsSection residents={residents} />,
    drug_disposal:        <DrugDisposalSection residents={residents} />,
    evacuation_drills:    <EvacuationDrillsSection />,
    resident_requests: <ResidentRequestsSection />,
    activities:    <ActivitiesSection />,
    announcements: <AnnouncementsSection />,
    calendar:      <AdminCalendarSection api={api} residents={residents} />,
    notifications: <NotificationsSection api={api} />,
    account_management: <AccountManagementSection api={api} />,
  };

  return (
    <AdminShell
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
    </AdminShell>
  );
}

// ─── ADMIN SHELL ───────────────────────────────────────────────────────────────
function AdminShell({ view, setView, displayName, initials, role, logout, residents, sidebarBadges, totalAlerts, isMobile, children }) {
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const searchRef = useRef(null);
  const profileRef = useRef(null);

  // Restore sidebar collapse preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem('admin:sidebarCollapsed');
      if (saved === '1') setSidebarCollapsed(true);
    } catch {}
  }, []);
  const handleCollapsedChange = useCallback((next) => {
    setSidebarCollapsed(next);
    try { localStorage.setItem('admin:sidebarCollapsed', next ? '1' : '0'); } catch {}
  }, []);

  // Close menus on outside click
  useEffect(() => {
    function onClick(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Keyboard shortcut: Cmd/Ctrl + K opens search
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => document.getElementById('admin-resident-search')?.focus(), 0);
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
      .filter(r => `${r.first_name} ${r.last_name}`.toLowerCase().includes(q) || (r.primary_diagnosis || '').toLowerCase().includes(q))
      .slice(0, 6);
  }, [residents, searchQuery]);

  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: 'var(--admin-canvas)',
        color: 'var(--admin-text)',
        fontFamily: 'var(--font-geist-sans), -apple-system, system-ui, sans-serif',
      }}
    >
      <AdminNavigation
        currentView={view}
        onViewChange={setView}
        badges={sidebarBadges}
        mobileOpen={mobileNavOpen}
        onMobileOpenChange={setMobileNavOpen}
        collapsed={sidebarCollapsed}
        onCollapsedChange={handleCollapsedChange}
      />

      {/* Main column */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          marginLeft: isMobile ? 0 : 0,
        }}
      >
        {/* ── Top bar ─────────────────────────────────────────────────────── */}
        <header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 60,
            background: 'rgba(247, 246, 242, 0.85)',
            backdropFilter: 'saturate(180%) blur(14px)',
            WebkitBackdropFilter: 'saturate(180%) blur(14px)',
            borderBottom: '1px solid var(--admin-border-soft)',
            padding: isMobile ? '10px 12px' : '14px 28px',
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? 8 : 16,
          }}
        >
          {isMobile && (
            <MobileMenuButton open={mobileNavOpen} onClick={() => setMobileNavOpen(v => !v)} />
          )}

          {/* Search (becomes inline on desktop, modal-overlay on mobile when open) */}
          <div ref={searchRef} style={{ position: 'relative', flex: 1, minWidth: 0, maxWidth: isMobile ? '100%' : 460 }}>
            <div
              onClick={() => { setSearchOpen(true); setTimeout(() => document.getElementById('admin-resident-search')?.focus(), 0); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: 'var(--admin-paper)',
                border: '1px solid var(--admin-border)',
                borderRadius: 10,
                padding: isMobile ? '8px 12px' : '9px 14px',
                cursor: 'text',
                transition: 'border-color 0.18s ease, box-shadow 0.18s ease',
                ...(searchOpen ? { borderColor: 'var(--admin-accent)', boxShadow: 'var(--admin-focus)' } : null),
              }}
            >
              <Search size={15} strokeWidth={1.85} style={{ color: 'var(--admin-text-muted)', flexShrink: 0 }} />
              <input
                id="admin-resident-search"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                onFocus={() => setSearchOpen(true)}
                placeholder={isMobile ? 'Search residents…' : 'Search residents, staff, or jump to a page…'}
                aria-label="Search residents"
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontSize: 13.5,
                  color: 'var(--admin-text)',
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
                    color: 'var(--admin-text-muted)',
                    background: 'var(--admin-canvas)',
                    border: '1px solid var(--admin-border)',
                    borderRadius: 5,
                    padding: '1px 6px',
                    flexShrink: 0,
                  }}
                >
                  ⌘K
                </kbd>
              )}
            </div>

            {/* Search dropdown */}
            {searchOpen && searchQuery.trim() && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  right: 0,
                  background: 'var(--admin-paper)',
                  border: '1px solid var(--admin-border)',
                  borderRadius: 12,
                  boxShadow: '0 18px 48px rgba(15,23,42,0.12)',
                  overflow: 'hidden',
                  zIndex: 70,
                  animation: 'admin-fade-up 0.18s ease both',
                }}
              >
                {filteredResidents.length === 0 ? (
                  <div style={{ padding: '14px 16px', fontSize: 13, color: 'var(--admin-text-soft)' }}>
                    No residents match “{searchQuery}”.
                  </div>
                ) : (
                  <div style={{ padding: 6 }}>
                    <div style={{ fontSize: 10, color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600, padding: '8px 10px 4px' }}>
                      Residents
                    </div>
                    {filteredResidents.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => { router.push(`/care-plan?residentId=${r.id}`); setSearchOpen(false); setSearchQuery(''); }}
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
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--admin-canvas)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div
                          style={{
                            width: 28, height: 28, borderRadius: '50%',
                            background: 'var(--admin-accent-soft)',
                            color: 'var(--admin-accent)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 700, flexShrink: 0,
                          }}
                        >
                          {(r.first_name?.[0] || '') + (r.last_name?.[0] || '')}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--admin-text)' }}>{r.first_name} {r.last_name}</div>
                          {r.primary_diagnosis && (
                            <div style={{ fontSize: 11, color: 'var(--admin-text-soft)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {r.primary_diagnosis}
                            </div>
                          )}
                        </div>
                        <ChevronRight size={14} strokeWidth={1.75} style={{ color: 'var(--admin-text-muted)' }} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right cluster */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
            {!isMobile && (
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--admin-text-soft)',
                  fontWeight: 500,
                  padding: '7px 12px',
                  background: 'var(--admin-paper)',
                  border: '1px solid var(--admin-border)',
                  borderRadius: 9,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                }}
              >
                <Calendar size={13} strokeWidth={1.85} style={{ color: 'var(--admin-text-muted)' }} />
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
                background: view === 'notifications' ? 'var(--admin-ink)' : 'var(--admin-paper)',
                color: view === 'notifications' ? '#fff' : 'var(--admin-text)',
                border: '1px solid var(--admin-border)',
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
                    background: 'var(--admin-danger)',
                    animation: 'admin-pulse-dot 1.8s ease-in-out infinite',
                  }}
                />
              )}
            </button>

            {/* Profile menu */}
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
                  background: 'var(--admin-paper)',
                  border: '1px solid var(--admin-border)',
                  borderRadius: 999,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <span
                  style={{
                    width: 30, height: 30, borderRadius: '50%',
                    background: 'var(--admin-ink)',
                    color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                  }}
                >
                  {initials || 'A'}
                </span>
                {!isMobile && (
                  <span style={{ lineHeight: 1.15, textAlign: 'left' }}>
                    <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--admin-text)' }}>{displayName}</span>
                    <span style={{ display: 'block', fontSize: 10.5, color: 'var(--admin-text-soft)', textTransform: 'capitalize', marginTop: 1 }}>{role?.replace(/_/g, ' ') || 'Admin'}</span>
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
                    background: 'var(--admin-paper)',
                    border: '1px solid var(--admin-border)',
                    borderRadius: 12,
                    boxShadow: '0 18px 48px rgba(15,23,42,0.12)',
                    padding: 6,
                    minWidth: 200,
                    zIndex: 70,
                    animation: 'admin-fade-up 0.18s ease both',
                  }}
                >
                  <div style={{ padding: '8px 10px 6px' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--admin-text)' }}>{displayName}</div>
                    <div style={{ fontSize: 11, color: 'var(--admin-text-soft)', marginTop: 2 }}>Signed in</div>
                  </div>
                  <div style={{ borderTop: '1px solid var(--admin-border-soft)', margin: '4px 2px' }} />
                  <button
                    onClick={() => { setView('account_management'); setProfileOpen(false); }}
                    style={menuItemStyle}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--admin-canvas)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <KeyRound size={14} strokeWidth={1.85} />
                    Account Management
                  </button>
                  <button
                    onClick={logout}
                    style={{ ...menuItemStyle, color: 'var(--admin-danger)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--admin-danger-bg)')}
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

        {/* ── Main content ─────────────────────────────────────────────────── */}
        <main
          className="dc-watermark"
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

const menuItemStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 9,
  width: '100%',
  padding: '8px 10px',
  background: 'transparent',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  color: 'var(--admin-text)',
  fontSize: 12.5,
  fontWeight: 500,
  textAlign: 'left',
  fontFamily: 'inherit',
};
