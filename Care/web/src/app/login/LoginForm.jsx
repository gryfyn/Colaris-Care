"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { storeSession } from "@/lib/client-auth";
import styles from "./login.module.css";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const requestedNext = params.get("next") || "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, next: requestedNext }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "Sign in failed.");
        return;
      }

      storeSession({ accessToken: data.accessToken, user: data.user });
      router.push(data.redirectTo || "/staff/dashboard");
    } catch {
      setError("Unable to reach the sign-in service.");
    } finally {
      setBusy(false);
    }
  }

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
          <span className={styles.kicker}><ShieldCheck size={14} /> Shared login</span>
          <h1>Sign in to the correct workspace.</h1>
          <p>
            The email determines the role, organization, facility, and destination for this environment.
          </p>
        </div>

        <form className={styles.form} onSubmit={submit}>
          <label>
            <span>Email</span>
            <div className={styles.inputWrap}>
              <Mail size={16} />
              <input
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError("");
                }}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>
          </label>

          <label>
            <span>Password</span>
            <div className={styles.inputWrap}>
              <LockKeyhole size={16} />
              <input
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError("");
                }}
                placeholder="Password"
                autoComplete="current-password"
                required
              />
            </div>
          </label>

          {error && <div className={styles.error}>{error}</div>}

          <button className={styles.submit} type="submit" disabled={busy}>
            {busy ? "Signing in" : "Continue"} <ArrowRight size={17} />
          </button>
        </form>

        <p className={styles.signupLine}>
          New to Colaris? <Link href="/signup" className={styles.signupLink}>Create an account</Link>
        </p>

        <Link href="/" className={styles.back}>Back to main page</Link>
      </section>

      <aside className={styles.panel}>
        <div className={styles.panelBadge}>SaaS-ready access pattern</div>
        <h2>One login, role-aware routing.</h2>
        <p>
          Authentication now issues tenant-scoped access and refresh tokens while keeping the same organization,
          facility, and role routing behavior.
        </p>
        <div className={styles.checks}>
          {["Email maps to role", "Facility context is captured", "Admin and staff share one sign-in", "Server routes enforce access"].map((item) => (
            <span key={item}><CheckCircle2 size={16} /> {item}</span>
          ))}
        </div>
      </aside>
    </main>
  );
}
