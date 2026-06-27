import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Check, Building2, HeartHandshake, Layers } from 'lucide-react';
import styles from '../site.module.css';

export const metadata = {
  title: "Who it's for — Colaris",
  description:
    'Colaris is built for residential treatment, assisted living, long-term care, behavioral health, and community healthcare providers — and is expanding to clinics, hospitals, and beyond.',
};

const PRIMARY = [
  { name: 'Residential Treatment Facilities', desc: 'Coordinate clinical care, documentation, and daily operations under one roof.' },
  { name: 'Assisted Living Communities',      desc: 'Manage residents, care plans, and staff with a single connected record.' },
  { name: 'Long-Term Care Providers',         desc: 'Keep care continuous and audit-ready across long resident stays.' },
  { name: 'Behavioral Health Organizations',  desc: 'Support sensitive care with structured workflows and strict access controls.' },
  { name: 'Community Healthcare Providers',   desc: 'Run lean operations without juggling a stack of disconnected tools.' },
];

const SOON = [
  'Clinics', 'Hospitals', 'Home Healthcare Agencies', 'Healthcare Networks', 'Government Healthcare Programs',
];

const NEEDS = [
  { Icon: Building2,      title: 'Organizations of all sizes', body: 'From a single facility to a multi-site network, Colaris scales with how you operate.' },
  { Icon: HeartHandshake, title: 'Care teams first',           body: 'Built so caregivers, administrators, and families stay on the same page.' },
  { Icon: Layers,         title: 'Tenant-isolated by design',  body: "Each facility's data is separated and access-controlled — privacy is structural, not optional." },
];

export default function WhoItsForPage() {
  return (
    <>
      <section className={styles.pageHero}>
        <div className={styles.shell}>
          <div className={styles.pageHeroGrid}>
            <div className={styles.pageHeroInner}>
            <span className={styles.eyebrow}>Who it&apos;s for</span>
            <h1 className={styles.h1}>Built for the organizations delivering care.</h1>
            <p className={styles.heroLead}>
              Colaris serves healthcare organizations of all sizes — and is designed to grow
              into a comprehensive ecosystem across the wider healthcare landscape.
            </p>
            <div className={styles.heroCtas}>
              <Link className={styles.btnPrimary} href="/request-demo">Request a demo <ArrowRight size={16} /></Link>
              <Link className={styles.btnGhost} href="/platform">See the platform</Link>
              </div>
            </div>
            <div className={`${styles.heroVisual} ${styles.residentCareImage}`} role="img" aria-label="Caregiver supporting a resident in a welcoming care setting" />
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.shell}>
          <div className={`${styles.sectionHead} ${styles.reveal}`}>
            <span className={styles.eyebrow}>Serving today</span>
            <h2 className={styles.h2}>Where Colaris is delivering care now.</h2>
          </div>
          <div className={`${styles.cardGrid} ${styles.reveal}`}>
            {PRIMARY.map(({ name, desc }) => (
              <div key={name} className={styles.card}>
                <span className={styles.cardIcon}><Check size={20} /></span>
                <h3 className={styles.cardTitle}>{name}</h3>
                <p className={styles.cardText}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.sectionPaper}`}>
        <div className={styles.shell}>
          <div className={styles.split}>
            <div className={styles.reveal}>
              <span className={styles.eyebrow}>Expanding to</span>
              <h2 className={styles.h2}>A platform built to grow with healthcare.</h2>
              <p className={styles.lead}>
                The same connected foundation is designed to extend across the broader
                healthcare landscape over time.
              </p>
            </div>
            <ul className={`${styles.checkList} ${styles.reveal}`}>
              {SOON.map((name) => (
                <li key={name} className={styles.checkItem}>
                  <span className={styles.checkMark}><ArrowUpRight size={13} /></span>
                  <div className={styles.checkBody}><h4>{name}</h4></div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.shell}>
          <div className={`${styles.cardGrid} ${styles.reveal}`}>
            {NEEDS.map(({ Icon, title, body }) => (
              <div key={title} className={styles.card}>
                <span className={`${styles.cardIcon} ${styles.cardIconSolid}`}><Icon size={20} /></span>
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
          <h2 className={styles.deepTitle}>Not sure if Colaris fits your organization?</h2>
          <p className={styles.deepSub}>Tell us about your facility and teams — we&apos;ll show you what Colaris looks like for you.</p>
          <div className={styles.deepCtas}>
            <Link className={`${styles.btnPrimary} ${styles.btnOnDeep}`} href="/request-demo">Request a demo <ArrowRight size={16} /></Link>
            <Link className={`${styles.btnGhost} ${styles.btnGhostDeep}`} href="/contact">Contact us</Link>
          </div>
        </div>
      </section>
    </>
  );
}
