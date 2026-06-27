'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Mail, MessageSquare, Building2 } from 'lucide-react';
import styles from '../site.module.css';

const TOPICS = ['Request a demo', 'Sales question', 'Support', 'Partnership', 'Something else'];

export default function ContactForm() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', topic: '', message: '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <>
      <section className={styles.pageHero}>
        <div className={styles.shell}>
          <div className={styles.pageHeroInner}>
            <span className={styles.eyebrow}>Contact</span>
            <h1 className={styles.h1}>Let&apos;s talk.</h1>
            <p className={styles.heroLead}>
              Questions about Colaris, pricing, or how it fits your organization? Send us a note
              and the team at Glass Inc Technologies will get back to you.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.shell}>
          <div className={styles.formLayout}>
            <div className={styles.formAside}>
              <span className={styles.eyebrow}>Reach us</span>
              <h3>Glass Inc Technologies</h3>
              <p>We typically respond within one business day.</p>
              <ul className={styles.asideList}>
                <li className={styles.asideItem}><Mail size={18} /> hello@colaris.com</li>
                <li className={styles.asideItem}><MessageSquare size={18} /> Sales &amp; product questions</li>
                <li className={styles.asideItem}><Building2 size={18} /> Maker of the Colaris platform</li>
              </ul>
              <p style={{ marginTop: 24 }}>
                Looking for a walkthrough?{' '}
                <Link href="/request-demo" style={{ color: 'var(--teal)', fontWeight: 600 }}>Request a demo →</Link>
              </p>
            </div>

            {submitted ? (
              <div className={styles.formSuccess}>
                <span className={styles.successMark}><Check size={26} /></span>
                <h3>Message sent.</h3>
                <p>Thanks, {form.name.split(' ')[0] || 'there'} — we&apos;ll reply at <strong>{form.email || 'your email'}</strong> shortly.</p>
                <div className={styles.deepCtas} style={{ justifyContent: 'center', marginTop: 24 }}>
                  <Link className={styles.btnPrimary} href="/">Back to home <ArrowRight size={16} /></Link>
                </div>
              </div>
            ) : (
              <form className={styles.formCard} onSubmit={onSubmit} noValidate>
                <div className={styles.fieldRow}>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="cname">Name <span className={styles.req}>*</span></label>
                    <input id="cname" className={styles.input} value={form.name} onChange={set('name')} required autoComplete="name" />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="cemail">Email <span className={styles.req}>*</span></label>
                    <input id="cemail" type="email" className={styles.input} value={form.email} onChange={set('email')} required autoComplete="email" />
                  </div>
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="ctopic">What&apos;s this about?</label>
                  <select id="ctopic" className={styles.select} value={form.topic} onChange={set('topic')}>
                    <option value="">Select a topic…</option>
                    {TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="cmessage">Message <span className={styles.req}>*</span></label>
                  <textarea id="cmessage" className={styles.textarea} value={form.message} onChange={set('message')} required />
                </div>
                <div className={styles.formActions}>
                  <button type="submit" className={styles.btnPrimary}>Send message <ArrowRight size={16} /></button>
                  <span className={styles.formNote}>We&apos;ll only use your details to reply to you.</span>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
