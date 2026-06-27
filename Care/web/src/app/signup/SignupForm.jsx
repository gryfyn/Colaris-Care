"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2, LockKeyhole, Mail, MailCheck, UserRound } from "lucide-react";
import styles from "../login/login.module.css";

export default function SignupForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(null); // { emailSent, verifyLink }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "Could not create your account."); return; }
      setSent({ emailSent: data.emailSent, verifyLink: data.verifyLink });
    } catch {
      setError("Unable to reach the sign-up service.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.brand}>
          <Image src="/colarislogo.png" alt="" width={46} height={46} priority />
          <span><strong>Colaris</strong><small>Create your facility account</small></span>
        </div>

        {sent ? (
          <div className={styles.copy}>
            <span className={styles.kicker}><MailCheck size={14} /> Check your email</span>
            <h1>Confirm your email to continue.</h1>
            <p>
              {sent.emailSent
                ? `We sent a verification link to ${email}. Click it to set up your facility.`
                : "Your account is created. Use the link below to verify your email and continue setup."}
            </p>
            {sent.verifyLink && (
              <Link className={styles.submit} href={sent.verifyLink.replace(/^https?:\/\/[^/]+/, "")} style={{ marginTop: 8 }}>
                Verify email <ArrowRight size={17} />
              </Link>
            )}
            <p className={styles.signupLine} style={{ marginTop: 14 }}>
              Already verified? <Link href="/login" className={styles.signupLink}>Sign in</Link>
            </p>
          </div>
        ) : (
          <>
            <div className={styles.copy}>
              <span className={styles.kicker}><UserRound size={14} /> New account</span>
              <h1>Start your facility on Colaris.</h1>
              <p>Create an admin account. You&apos;ll verify your email, then set up your facility profile.</p>
            </div>

            <button type="button" className={styles.googleBtn} disabled title="Google sign-up is coming soon">
              <span className={styles.gIcon}>G</span> Continue with Google · coming soon
            </button>
            <div className={styles.orRule}><span>or</span></div>

            <form className={styles.form} onSubmit={submit}>
              <label>
                <span>Full name</span>
                <div className={styles.inputWrap}>
                  <UserRound size={16} />
                  <input type="text" value={name} onChange={(e) => { setName(e.target.value); setError(""); }} placeholder="Jane Doe" autoComplete="name" required />
                </div>
              </label>
              <label>
                <span>Work email</span>
                <div className={styles.inputWrap}>
                  <Mail size={16} />
                  <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} placeholder="you@facility.com" autoComplete="email" required />
                </div>
              </label>
              <label>
                <span>Password</span>
                <div className={styles.inputWrap}>
                  <LockKeyhole size={16} />
                  <input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} placeholder="At least 8 characters" autoComplete="new-password" minLength={8} required />
                </div>
              </label>

              {error && <div className={styles.error}>{error}</div>}

              <button className={styles.submit} type="submit" disabled={busy}>
                {busy ? "Creating account" : "Create account"} <ArrowRight size={17} />
              </button>
            </form>

            <p className={styles.signupLine}>
              Already have an account? <Link href="/login" className={styles.signupLink}>Sign in</Link>
            </p>
          </>
        )}

        <Link href="/" className={styles.back}>Back to main page</Link>
      </section>

      <aside className={styles.panel}>
        <div className={styles.panelBadge}>Set up in minutes</div>
        <h2>Your facility, ready to run.</h2>
        <p>Sign up, verify your email, and tell us about your facility. We&apos;ll provision your admin and staff workspaces automatically.</p>
        <div className={styles.checks}>
          {["Email-verified, secure access", "Your own organization & facility", "Admin + staff portals provisioned", "Pick your theme and layout"].map((item) => (
            <span key={item}><CheckCircle2 size={16} /> {item}</span>
          ))}
        </div>
      </aside>
    </main>
  );
}
