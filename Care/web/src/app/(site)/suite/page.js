import Link from 'next/link';
import {
  HeartPulse, Users, ShieldCheck, CreditCard, BarChart2, Sparkles,
  ArrowRight, Boxes, Fingerprint, RefreshCw,
} from 'lucide-react';
import styles from '../site.module.css';

export const metadata = {
  title: 'The Colaris Suite — Colaris',
  description:
    'A family of healthcare products — Care, Workforce, Compliance, Billing, Insights, and AI — built on one shared platform, data model, and identity.',
};

const SUITE = [
  { Icon: HeartPulse,  lead: 'Care',       desc: 'Patient and care management at the heart of the platform — profiles, care plans, medications, and progress notes.' },
  { Icon: Users,       lead: 'Workforce',  desc: 'Staff scheduling and workforce optimization — roles, credentials, shifts, and assignments in one place.' },
  { Icon: ShieldCheck, lead: 'Compliance', desc: 'Regulatory compliance and audit readiness — requirements, renewals, incidents, and a clear audit trail.' },
  { Icon: CreditCard,  lead: 'Billing',    desc: 'Healthcare billing and revenue management running alongside the care your teams deliver.' },
  { Icon: BarChart2,   lead: 'Insights',   desc: 'Reporting, dashboards, and analytics that turn everyday operations into decisions.' },
  { Icon: Sparkles,    lead: 'AI',         desc: 'Intelligent automation and decision support woven through the platform.', tag: 'Roadmap' },
];

const SHARED = [
  { Icon: Boxes,       title: 'One data model',  body: 'Every product reads and writes the same connected record — no exports, no syncing, no drift.' },
  { Icon: Fingerprint, title: 'One identity',    body: 'A single sign-in and permission model across the suite, scoped to each facility.' },
  { Icon: RefreshCw,   title: 'One experience',  body: 'Consistent design and workflows, so teams learn once and move between products with ease.' },
];

export default function SuitePage() {
  return (
    <>
      <section className={styles.pageHero}>
        <div className={styles.shell}>
          <div className={styles.pageHeroGrid}>
            <div className={styles.pageHeroInner}>
            <span className={styles.eyebrow}>The Colaris suite</span>
            <h1 className={styles.h1}>A family of products, <em>one ecosystem.</em></h1>
            <p className={styles.heroLead}>
              Start with what you need today and grow into the rest. Every Colaris product is
              built on the same platform, so they share data, identity, and experience from day one.
            </p>
            <div className={styles.heroCtas}>
              <Link className={styles.btnPrimary} href="/request-demo">Request a demo <ArrowRight size={16} /></Link>
              <Link className={styles.btnGhost} href="/platform">See the platform</Link>
              </div>
            </div>
            <div className={`${styles.heroVisual} ${styles.productHeroImage}`} role="img" aria-label="Colaris healthcare product suite dashboard" />
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.shell}>
          <div className={`${styles.cardGrid} ${styles.reveal}`}>
            {SUITE.map(({ Icon, lead, desc, tag }) => {
              // Colaris Care is live — its card links into the product. The rest
              // are on the roadmap and render as static cards.
              const live = lead === 'Care';
              const inner = (
                <>
                  <span className={`${styles.cardIcon} ${styles.cardIconSolid}`}><Icon size={20} /></span>
                  <h3 className={styles.cardTitle}><span>Colaris</span> {lead}</h3>
                  <p className={styles.cardText}>{desc}</p>
                  {live ? <span className={styles.tag}>Available now</span> : (tag && <span className={styles.tag}>{tag}</span>)}
                  {live && <span className={styles.cardLink}>Explore Colaris Care <ArrowRight size={15} /></span>}
                </>
              );
              return live ? (
                <Link key={lead} href="/care" className={`${styles.card} ${styles.cardLive}`}>{inner}</Link>
              ) : (
                <article key={lead} className={styles.card}>{inner}</article>
              );
            })}
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.sectionPaper}`}>
        <div className={styles.shell}>
          <div className={`${styles.sectionHead} ${styles.reveal}`}>
            <span className={styles.eyebrow}>One foundation</span>
            <h2 className={styles.h2}>Separate products that never feel separate.</h2>
            <p className={styles.lead}>The suite isn&apos;t a bundle of integrations. It&apos;s one platform, presented as the products your teams need.</p>
          </div>
          <div className={`${styles.cardGrid} ${styles.reveal}`}>
            {SHARED.map(({ Icon, title, body }) => (
              <div key={title} className={styles.card}>
                <span className={styles.cardIcon}><Icon size={20} /></span>
                <h3 className={styles.cardTitle}>{title}</h3>
                <p className={styles.cardText}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.deepBand}>
        <div className={`${styles.shell} ${styles.deepInner} ${styles.reveal}`}>
          <span className={styles.eyebrow}>Care Simplified</span>
          <h2 className={styles.deepTitle}>Build the suite that fits your organization.</h2>
          <p className={styles.deepSub}>Tell us how your teams work today, and we&apos;ll show you where Colaris fits.</p>
          <div className={styles.deepCtas}>
            <Link className={`${styles.btnPrimary} ${styles.btnOnDeep}`} href="/request-demo">Request a demo <ArrowRight size={16} /></Link>
            <Link className={`${styles.btnGhost} ${styles.btnGhostDeep}`} href="/who-its-for">Who it&apos;s for</Link>
          </div>
        </div>
      </section>
    </>
  );
}
