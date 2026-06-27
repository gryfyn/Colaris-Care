"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Building2, CheckCircle2, Layout, Loader2, Palette } from "lucide-react";
import { THEMES } from "@/components/app/prefs";
import styles from "./onboarding.module.css";

const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Phoenix",
  "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu",
];
const LAYOUTS = [
  { id: "comfortable", label: "Comfortable", note: "Full sidebar, roomy spacing" },
  { id: "compact", label: "Compact", note: "Collapsed sidebar, more on screen" },
];
const STORAGE_KEY = "colaris.prefs.v1";

export default function OnboardingClient() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [gate, setGate] = useState("checking"); // checking | ready | blocked | done
  const [gateMsg, setGateMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    facilityName: "", legalName: "", address: "", phone: "", email: "",
    timezone: "America/Los_Angeles", licensedCapacity: "",
  });
  const [theme, setTheme] = useState("spruce");
  const [layout, setLayout] = useState("comfortable");

  const set = (key) => (e) => setForm((s) => ({ ...s, [key]: e.target.value }));

  useEffect(() => {
    if (!token) { setGate("blocked"); setGateMsg("This setup link is missing its token. Please use the link from your verification step."); return; }
    let alive = true;
    fetch(`/api/auth/verify?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const d = await res.json().catch(() => ({}));
        if (!alive) return;
        if (!res.ok) { setGate("blocked"); setGateMsg(d.error || "We couldn't find your signup."); return; }
        if (d.completed) { setGate("blocked"); setGateMsg("This account is already set up — please sign in."); return; }
        if (!d.verified) { setGate("blocked"); setGateMsg("Please verify your email before setting up your facility."); return; }
        if (d.email) setForm((s) => ({ ...s, email: s.email || d.email }));
        setGate("ready");
      })
      .catch(() => { if (alive) { setGate("blocked"); setGateMsg("Unable to reach the setup service."); } });
    return () => { alive = false; };
  }, [token]);

  const activeTheme = useMemo(() => THEMES.find((t) => t.id === theme) || THEMES[0], [theme]);

  async function submit(event) {
    event.preventDefault();
    if (!form.facilityName.trim()) { setError("Facility name is required."); return; }
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/v1/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...form, theme, layout }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error || "Could not finish setup."); return; }
      // Apply the chosen look to this browser so the portal opens themed.
      try {
        const cur = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...cur, theme, sidebarCollapsed: layout === "compact" }));
      } catch {}
      setGate("done");
    } catch {
      setError("Unable to reach the setup service.");
    } finally {
      setBusy(false);
    }
  }

  if (gate === "checking") {
    return <main className={styles.page}><div className={styles.center}><Loader2 size={22} className={styles.spin} /><p>Loading your setup…</p></div></main>;
  }
  if (gate === "blocked") {
    return (
      <main className={styles.page}><div className={styles.card}>
        <Brand />
        <h1 className={styles.h1}>We can&apos;t open setup</h1>
        <p className={styles.lead}>{gateMsg}</p>
        <div className={styles.actions}><Link className={styles.btnPrimary} href="/signup">Start over</Link><Link className={styles.btnGhost} href="/login">Sign in</Link></div>
      </div></main>
    );
  }
  if (gate === "done") {
    return (
      <main className={styles.page}><div className={styles.card}>
        <Brand />
        <span className={styles.kicker}><CheckCircle2 size={14} /> Facility ready</span>
        <h1 className={styles.h1}>You&apos;re all set.</h1>
        <p className={styles.lead}>Your organization, facility, and admin workspace are provisioned. Sign in to open your admin portal — your staff portal is ready too.</p>
        <div className={styles.actions}><Link className={styles.btnPrimary} href="/login?next=/admin/dashboard&intent=admin">Sign in to admin <ArrowRight size={16} /></Link></div>
      </div></main>
    );
  }

  return (
    <main className={styles.page}>
      <form className={styles.card} onSubmit={submit}>
        <Brand />
        <span className={styles.kicker}><Building2 size={14} /> Facility setup</span>
        <h1 className={styles.h1}>Tell us about your facility.</h1>
        <p className={styles.lead}>This sets up your organization and pre-fills forms like admission across the app.</p>

        <div className={styles.grid}>
          <Field label="Facility name" required full><input value={form.facilityName} onChange={set("facilityName")} placeholder="Maple Grove Care" required /></Field>
          <Field label="Legal name" hint="optional" full><input value={form.legalName} onChange={set("legalName")} placeholder="Maple Grove Care LLC" /></Field>
          <Field label="Address" full><input value={form.address} onChange={set("address")} placeholder="1420 Birchwood Ave, Portland, OR 97201" /></Field>
          <Field label="Phone"><input value={form.phone} onChange={set("phone")} placeholder="(555) 014-0100" /></Field>
          <Field label="Email"><input type="email" value={form.email} onChange={set("email")} placeholder="hello@maplegrove.example" /></Field>
          <Field label="Time zone">
            <select value={form.timezone} onChange={set("timezone")}>{TIMEZONES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
          </Field>
          <Field label="Licensed capacity"><input type="number" min="0" value={form.licensedCapacity} onChange={set("licensedCapacity")} placeholder="48" /></Field>
        </div>

        <div className={styles.sectionHead}><Palette size={15} /> <span>Appearance</span></div>
        <div className={styles.swatches}>
          {THEMES.map((t) => (
            <button type="button" key={t.id} className={`${styles.swatch} ${theme === t.id ? styles.swatchOn : ""}`} onClick={() => setTheme(t.id)} title={t.label} aria-pressed={theme === t.id}>
              <span className={styles.swatchDots}><span style={{ background: t.swatch[0] }} /><span style={{ background: t.swatch[1] }} /></span>
              <span className={styles.swatchLabel}>{t.label}</span>
            </button>
          ))}
        </div>

        <div className={styles.sectionHead}><Layout size={15} /> <span>Layout</span></div>
        <div className={styles.layouts}>
          {LAYOUTS.map((l) => (
            <button type="button" key={l.id} className={`${styles.layoutOpt} ${layout === l.id ? styles.layoutOn : ""}`} onClick={() => setLayout(l.id)} aria-pressed={layout === l.id}>
              <strong>{l.label}</strong><span>{l.note}</span>
            </button>
          ))}
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.actions}>
          <button className={styles.btnPrimary} type="submit" disabled={busy} data-theme-preview={activeTheme.id}>
            {busy ? "Setting up…" : "Finish setup"} <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </main>
  );
}

function Brand() {
  return (
    <div className={styles.brand}>
      <Image src="/colarislogo.png" alt="" width={42} height={42} priority />
      <span><strong>Colaris</strong><small>Facility setup</small></span>
    </div>
  );
}

function Field({ label, hint, required, full, children }) {
  return (
    <label className={`${styles.field} ${full ? styles.full : ""}`}>
      <span className={styles.fieldLabel}>{label}{required && <em> *</em>}{hint && <i> {hint}</i>}</span>
      {children}
    </label>
  );
}
