"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, BadgeCheck, CheckCircle2, Loader2, XCircle } from "lucide-react";
import styles from "../login/login.module.css";

export default function VerifyClient() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState("verifying"); // verifying | ok | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) { setState("error"); setMessage("This link is missing its verification token."); return; }
    let alive = true;
    fetch("/api/auth/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        if (res.ok) setState("ok");
        else { setState("error"); setMessage(data.error || "This verification link is invalid or expired."); }
      })
      .catch(() => { if (alive) { setState("error"); setMessage("Unable to reach the verification service."); } });
    return () => { alive = false; };
  }, [token]);

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.brand}>
          <Image src="/colarislogo.png" alt="" width={46} height={46} priority />
          <span><strong>Colaris</strong><small>Email verification</small></span>
        </div>

        <div className={styles.copy}>
          {state === "verifying" && (<>
            <span className={styles.kicker}><Loader2 size={14} /> Verifying</span>
            <h1>Confirming your email…</h1>
            <p>Hang tight while we verify your link.</p>
          </>)}
          {state === "ok" && (<>
            <span className={styles.kicker}><BadgeCheck size={14} /> Verified</span>
            <h1>Your email is confirmed.</h1>
            <p>Next, set up your facility profile — it only takes a minute.</p>
            <Link className={styles.submit} href={`/onboarding?token=${token}`} style={{ marginTop: 8 }}>
              Continue to setup <ArrowRight size={17} />
            </Link>
          </>)}
          {state === "error" && (<>
            <span className={styles.kicker}><XCircle size={14} /> Couldn&apos;t verify</span>
            <h1>This link didn&apos;t work.</h1>
            <p>{message}</p>
            <p className={styles.signupLine} style={{ marginTop: 8 }}>
              <Link href="/signup" className={styles.signupLink}>Start over</Link> · <Link href="/login" className={styles.signupLink}>Sign in</Link>
            </p>
          </>)}
        </div>

        <Link href="/" className={styles.back}>Back to main page</Link>
      </section>

      <aside className={styles.panel}>
        <div className={styles.panelBadge}>Almost there</div>
        <h2>One step from your workspace.</h2>
        <p>Once your email is verified, you&apos;ll add your facility details and pick how Colaris looks for your team.</p>
        <div className={styles.checks}>
          {["Email verification keeps access secure", "Your facility profile feeds the whole app", "Admission forms pre-fill your facility"].map((item) => (
            <span key={item}><CheckCircle2 size={16} /> {item}</span>
          ))}
        </div>
      </aside>
    </main>
  );
}
