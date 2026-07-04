"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import styles from "../login/login.module.css";

export default function ResetPasswordClient() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  return token ? <SetNewPassword token={token} /> : <RequestReset />;
}

// Step 1 — no token: request a reset link by email.
function RequestReset() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [devUrl, setDevUrl] = useState("");

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      setDevUrl(data?.data?.devResetUrl || "");
      setSent(true);
    } catch {
      setError("Unable to reach the service. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell
      kicker="Account recovery"
      title="Reset your password."
      lede="Enter the email for your account and we'll send a link to set a new password."
    >
      {sent ? (
        <div className={styles.form}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, color: "#0F766E" }}>
            <CheckCircle2 size={18} /> If an account exists for that email, a password reset link is on its way. The link expires in 30 minutes.
          </div>
          {devUrl && (
            <div className={styles.error} style={{ background: "#ecfdf5", color: "#047857", borderColor: "#6ee7b7" }}>
              Dev mode (no email configured): <a href={devUrl} style={{ color: "#047857", textDecoration: "underline" }}>open reset link</a>
            </div>
          )}
          <Link href="/login" className={styles.back}>Back to sign in</Link>
        </div>
      ) : (
        <form className={styles.form} onSubmit={submit}>
          <label>
            <span>Email</span>
            <div className={styles.inputWrap}>
              <Mail size={16} />
              <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} placeholder="you@example.com" autoComplete="email" required />
            </div>
          </label>
          {error && <div className={styles.error}>{error}</div>}
          <button className={styles.submit} type="submit" disabled={busy}>
            {busy ? "Sending" : "Send reset link"} <ArrowRight size={17} />
          </button>
          <Link href="/login" className={styles.back}>Back to sign in</Link>
        </form>
      )}
    </Shell>
  );
}

// Step 2 — token present: set the new password.
function SetNewPassword({ token }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not reset your password.");
        return;
      }
      setDone(true);
    } catch {
      setError("Unable to reach the service. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell
      kicker="Account recovery"
      title="Set a new password."
      lede="Choose a strong password you don't use elsewhere. It must be at least 8 characters."
    >
      {done ? (
        <div className={styles.form}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, color: "#0F766E" }}>
            <CheckCircle2 size={18} /> Your password has been reset. You can now sign in with your new password.
          </div>
          <Link href="/login" className={styles.submit} style={{ textDecoration: "none", justifyContent: "center" }}>
            Go to sign in <ArrowRight size={17} />
          </Link>
        </div>
      ) : (
        <form className={styles.form} onSubmit={submit}>
          <label>
            <span>New password</span>
            <div className={styles.inputWrap}>
              <LockKeyhole size={16} />
              <input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} placeholder="New password" autoComplete="new-password" required />
            </div>
          </label>
          <label>
            <span>Confirm password</span>
            <div className={styles.inputWrap}>
              <LockKeyhole size={16} />
              <input type="password" value={confirm} onChange={(e) => { setConfirm(e.target.value); setError(""); }} placeholder="Confirm new password" autoComplete="new-password" required />
            </div>
          </label>
          {error && <div className={styles.error}>{error}</div>}
          <button className={styles.submit} type="submit" disabled={busy}>
            {busy ? "Saving" : "Reset password"} <ArrowRight size={17} />
          </button>
          <Link href="/login" className={styles.back}>Back to sign in</Link>
        </form>
      )}
    </Shell>
  );
}

function Shell({ kicker, title, lede, children }) {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.brand}>
          <Image src="/colarislogo.png" alt="" width={46} height={46} priority />
          <span>
            <strong>Colaris Care</strong>
            <small>Secure workspace access</small>
          </span>
        </div>
        <div className={styles.copy}>
          <span className={styles.kicker}><ShieldCheck size={14} /> {kicker}</span>
          <h1>{title}</h1>
          <p>{lede}</p>
        </div>
        {children}
      </section>
    </main>
  );
}
