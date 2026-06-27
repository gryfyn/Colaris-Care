'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Clock, ShieldCheck, MessageSquare } from 'lucide-react';
import styles from '../site.module.css';

const ORG_TYPES = [
  'Residential Treatment Facility',
  'Assisted Living Community',
  'Long-Term Care Provider',
  'Behavioral Health Organization',
  'Community Healthcare Provider',
  'Other',
];
const TEAM_SIZES = ['1–25', '26–100', '101–500', '500+'];

const ASIDE = [
  { Icon: Clock,       text: 'A 30-minute walkthrough tailored to your organization' },
  { Icon: MessageSquare, text: 'Answers to your workflow and rollout questions' },
  { Icon: ShieldCheck, text: 'A look at how tenant isolation and audit trails work' },
];

export default function DemoForm() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: '', email: '', organization: '', role: '',
    orgType: '', teamSize: '', message: '',
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = (e) => {
    e.preventDefault();
    // No backend wired yet — capture intent and show confirmation.
    setSubmitted(true);
  };

  return (
    <>
      <section className={styles.pageHero}>
        <div className={styles.shell}>
          <div className={styles.pageHeroInner}>
            <span className={styles.eyebrow}>Request a demo</span>
            <h1 className={styles.h1}>See Colaris in action.</h1>
            <p className={styles.heroLead}>
              Tell us a little about your organization and our team will reach out to schedule
              a walkthrough built around how you deliver care.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.shell}>
          <div className={styles.formLayout}>
            <div className={styles.formAside}>
              <span className={styles.eyebrow}>What to expect</span>
              <h3>A walkthrough, not a sales pitch.</h3>
              <p>We&apos;ll show you the platform working end to end and focus on the workflows that matter to your teams.</p>
              <ul className={styles.asideList}>
                {ASIDE.map(({ Icon, text }) => (
                  <li key={text} className={styles.asideItem}><Icon size={18} /> {text}</li>
                ))}
              </ul>
            </div>

            {submitted ? (
              <div className={styles.formSuccess}>
                <span className={styles.successMark}><Check size={26} /></span>
                <h3>Thanks, {form.name.split(' ')[0] || 'there'} — request received.</h3>
                <p>
                  Our team will reach out at <strong>{form.email || 'your email'}</strong> to schedule
                  your Colaris walkthrough. In the meantime, feel free to keep exploring.
                </p>
                <div className={styles.deepCtas} style={{ justifyContent: 'center', marginTop: 24 }}>
                  <Link className={styles.btnPrimary} href="/platform">Explore the platform <ArrowRight size={16} /></Link>
                </div>
              </div>
            ) : (
              <form className={styles.formCard} onSubmit={onSubmit} noValidate>
                <div className={styles.fieldRow}>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="name">Full name <span className={styles.req}>*</span></label>
                    <input id="name" className={styles.input} value={form.name} onChange={set('name')} required autoComplete="name" />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="email">Work email <span className={styles.req}>*</span></label>
                    <input id="email" type="email" className={styles.input} value={form.email} onChange={set('email')} required autoComplete="email" />
                  </div>
                </div>
                <div className={styles.fieldRow}>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="organization">Organization <span className={styles.req}>*</span></label>
                    <input id="organization" className={styles.input} value={form.organization} onChange={set('organization')} required autoComplete="organization" />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="role">Your role</label>
                    <input id="role" className={styles.input} value={form.role} onChange={set('role')} autoComplete="organization-title" />
                  </div>
                </div>
                <div className={styles.fieldRow}>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="orgType">Organization type</label>
                    <select id="orgType" className={styles.select} value={form.orgType} onChange={set('orgType')}>
                      <option value="">Select one…</option>
                      {ORG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="teamSize">Team size</label>
                    <select id="teamSize" className={styles.select} value={form.teamSize} onChange={set('teamSize')}>
                      <option value="">Select one…</option>
                      {TEAM_SIZES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="message">What would you like to see?</label>
                  <textarea id="message" className={styles.textarea} value={form.message} onChange={set('message')} placeholder="Tell us about your current workflows or what you'd like Colaris to solve." />
                </div>
                <div className={styles.formActions}>
                  <button type="submit" className={styles.btnPrimary}>Request demo <ArrowRight size={16} /></button>
                  <span className={styles.formNote}>We&apos;ll only use your details to contact you about Colaris.</span>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
