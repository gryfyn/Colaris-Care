"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/* Deterministic, softly tinted avatar colors from a name. */
const PALETTE = [
  ["#DDF3EC", "#C7E9DE", "#176552"],
  ["#E4EEF8", "#D1E2F1", "#315F82"],
  ["#F7E4EE", "#EECBDD", "#87345F"],
  ["#F3E3EC", "#E8CDDD", "#7A4261"],
  ["#E4F0E4", "#D1E4D2", "#416A49"],
  ["#EAE6F5", "#DCD5EC", "#5B4D83"],
];
export function avatarColors(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
export function initials(name = "") {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] || "") + (p[1]?.[0] || "")).toUpperCase() || "—";
}

export function Avatar({ name, round, sm, src, size = "md" }) {
  const [a, b, text] = avatarColors(name);
  const resolvedSize = sm ? "sm" : size;
  /* Track the exact src that failed so a later swap to a good URL still renders,
     and so the photo ring disappears along with the broken image. */
  const [failedSrc, setFailedSrc] = useState("");
  const showPhoto = Boolean(src) && failedSrc !== src;

  return (
    <span className={`cx-ava cx-ava-${resolvedSize}${round ? " is-round" : ""}${showPhoto ? " has-photo" : ""}`}
      style={{ background: `linear-gradient(150deg, ${a}, ${b})`, color: text }}>
      {showPhoto && (
        <img
          src={src}
          alt={name ? `${name} portrait` : "Resident portrait"}
          onError={() => setFailedSrc(src)}
        />
      )}
      {initials(name)}
    </span>
  );
}

export function PortraitLightbox({ name, src, open, onClose }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const [failedSrc, setFailedSrc] = useState("");

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const dialog = dialogRef.current;
    closeRef.current?.focus();

    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
        .filter((node) => !node.disabled && node.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus?.();
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="cx-lightbox-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} className="cx-lightbox" role="dialog" aria-modal="true" aria-label={`${name || "Resident"} portrait`}>
        <button ref={closeRef} type="button" className="cx-icon-btn cx-lightbox-close" aria-label="Close portrait view" onClick={onClose}>X</button>
        {src && failedSrc !== src ? (
          <img
            src={src}
            alt={name ? `${name} portrait` : "Resident portrait"}
            onError={(event) => {
              event.currentTarget.style.display = "none";
              event.currentTarget.removeAttribute("src");
              setFailedSrc(src);
            }}
          />
        ) : (
          <Avatar name={name} round size="2xl" />
        )}
        <div className="cx-lightbox-caption">{name}</div>
      </div>
    </div>
  );
}

export function PortraitButton({ name, src, size = "xl", round = true, className = "" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={`cx-portrait-button${className ? ` ${className}` : ""}`}
        onClick={() => setOpen(true)}
        aria-label={`Open ${name || "resident"} portrait`}
      >
        <Avatar name={name} round={round} size={size} src={src} />
      </button>
      <PortraitLightbox name={name} src={src} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function Badge({ tone = "gray", dot, children }) {
  return (
    <span className={`cx-badge is-${tone}`}>
      {dot && <span className="cx-bdot" />}
      {children}
    </span>
  );
}

export function PageHeader({ eyebrow, title, lede, action }) {
  return (
    <div className="cx-head">
      <div>
        {eyebrow && <div className="cx-eyebrow">{eyebrow}</div>}
        <h1 className="cx-h1">{title}</h1>
        {lede && <p className="cx-lede">{lede}</p>}
      </div>
      {action && <div style={{ marginLeft: "auto" }}>{action}</div>}
    </div>
  );
}

export function PageBand({ eyebrow, title, lede, action, children }) {
  return (
    <header className="cx-page-band cx-page-band-simple">
      <div className="cx-page-band-main">
        <div className="cx-page-band-copy">
          {eyebrow && <div className="cx-section-eyebrow">{eyebrow}</div>}
          <h1 className="cx-page-title">{title}</h1>
          {lede && <p className="cx-page-lede">{lede}</p>}
          {children}
        </div>
      </div>
      {action && <div className="cx-page-actions">{action}</div>}
    </header>
  );
}

export function StatCard({ icon: Icon, label, value, delta, deltaDir }) {
  return (
    <div className="cx-stat">
      <div className="cx-stat-top">
        <div className="cx-stat-ico">{Icon && <Icon size={18} strokeWidth={2} />}</div>
        {delta && <span className={`cx-stat-delta ${deltaDir || "up"}`}>{delta}</span>}
      </div>
      <div className="cx-stat-val">{value}</div>
      <div className="cx-stat-lbl">{label}</div>
    </div>
  );
}

export function Panel({ title, action, pad, children }) {
  return (
    <div className="cx-panel">
      {(title || action) && (
        <div className="cx-panel-h">
          <h3>{title}</h3>
          {action}
        </div>
      )}
      <div style={pad ? { padding: 18 } : undefined}>{children}</div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, note, action }) {
  return (
    <div className="cx-empty2">
      <div className="cx-empty-ico">{Icon && <Icon size={22} strokeWidth={1.9} />}</div>
      <h3>{title}</h3>
      {note && <p>{note}</p>}
      {action}
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }) {
  const rowItems = Array.from({ length: rows });
  const colItems = Array.from({ length: cols });

  return (
    <div className="cx-tblscroll" role="status" aria-label="Loading data">
      <table className="cx-tbl cx-skel-table" aria-hidden="true">
        <thead>
          <tr>
            {colItems.map((_, index) => (
              <th key={index}>
                <span className="cx-skel-headwrap"><span className="cx-skel cx-skel-head" /></span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowItems.map((_, rowIndex) => (
            <tr key={rowIndex}>
              {colItems.map((_, colIndex) => (
                <td key={colIndex}>
                  {colIndex === 0 ? (
                    <span className="cx-skel-cellname">
                      <span className="cx-skel cx-skel-avatar" />
                      <span className="cx-skel cx-skel-text" />
                    </span>
                  ) : (
                    <span className="cx-skel cx-skel-text" data-short={colIndex % 2 === 0 ? "true" : undefined} />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PrimaryLink({ href, children }) {
  return <Link href={href} className="cx-btn cx-btn-primary" style={{ textDecoration: "none" }}>{children}</Link>;
}
