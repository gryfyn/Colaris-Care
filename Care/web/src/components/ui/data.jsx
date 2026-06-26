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

export function Avatar({ name, round, sm }) {
  const [a, b, text] = avatarColors(name);
  return (
    <div className={`cx-ava${round ? " is-round" : ""}${sm ? " sm" : ""}`}
      style={{ background: `linear-gradient(150deg, ${a}, ${b})`, color: text }}>
      {initials(name)}
    </div>
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

export function PrimaryLink({ href, children }) {
  return <Link href={href} className="cx-btn cx-btn-primary" style={{ textDecoration: "none" }}>{children}</Link>;
}
