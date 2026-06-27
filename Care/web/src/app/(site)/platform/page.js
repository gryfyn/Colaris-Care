import Link from 'next/link';
import {
  Users, ClipboardList, Pill, Briefcase, Calendar, ShieldCheck,
  AlertTriangle, CreditCard, MessageSquare, BarChart2,
  ArrowRight, Check, Network, Database, Eye, FileCheck2,
} from 'lucide-react';
import styles from '../site.module.css';

export const metadata = {
  title: 'Platform — Colaris',
  description:
    'One connected platform for patient management, care planning, workforce, compliance, billing, and analytics — every team working from a single source of truth.',
};

const CAPABILITIES = [
  { Icon: Users,          name: 'Patient Management',        desc: "Every resident's profile, history, and care team in one connected record." },
  { Icon: ClipboardList,  name: 'Care Planning',             desc: 'Build, update, and track individualized care plans as needs change.' },
  { Icon: Pill,           name: 'Medication Administration', desc: 'Record medications and administration with a clear, auditable trail.' },
  { Icon: Briefcase,      name: 'Workforce Management',      desc: 'Manage staff, roles, and credentials across the whole organization.' },
  { Icon: Calendar,       name: 'Staff Scheduling',          desc: 'Build balanced schedules and fill open shifts without the spreadsheets.' },
  { Icon: ShieldCheck,    name: 'Compliance Tracking',       desc: 'Stay audit-ready with requirements and renewals tracked automatically.' },
  { Icon: AlertTriangle,  name: 'Incident Reporting',        desc: 'Capture, route, and resolve incidents the moment they happen.' },
  { Icon: CreditCard,     name: 'Billing & Financial Ops',   desc: 'Run billing and revenue operations alongside the care you deliver.' },
  { Icon: MessageSquare,  name: 'Communication & Messaging', desc: 'Keep caregivers, administrators, and families on the same page.' },
  { Icon: BarChart2,      name: 'Analytics & Reporting',     desc: 'Turn day-to-day operations into decisions you can act on.' },
];

const WHY = [
  { Icon: Database, title: 'One connected record', body: 'Enter information once. Every module reads from the same source, so data never drifts between systems.' },
  { Icon: Eye,      title: 'Real-time visibility',  body: 'Administrators and caregivers see the same up-to-date picture of residents, staff, and operations.' },
  { Icon: Network,  title: 'Workflows that hand off', body: 'Admissions flow into care plans, care plans into scheduling, incidents into reporting — without re-keying.' },
  { Icon: FileCheck2, title: 'Audit-ready by default', body: 'Sensitive actions are logged and scoped per facility, so you can answer "who did what, when" with confidence.' },
];

const STATS = [
  { num: '10', label: 'Connected capabilities' },
  { num: '1', label: 'Source of truth' },
  { num: '5', label: 'Products in the suite' },
  { num: '0', label: 'Disconnected silos' },
];

export default function PlatformPage() {
  return (
    <>
      <section className={styles.pageHero}>
        <div className={styles.shell}>
          <div className={styles.pageHeroGrid}>
            <div className={styles.pageHeroInner}>
            <span className={styles.eyebrow}>The platform</span>
            <h1 className={styles.h1}>One platform for everything care delivery needs.</h1>
            <p className={styles.heroLead}>
              Traditional systems isolate workflows into disconnected tools. Colaris brings
              patient care, workforce, compliance, billing, and analytics into a single
              ecosystem — so every team works from the same source of truth.
            </p>
            <div className={styles.heroCtas}>
              <Link className={styles.btnPrimary} href="/request-demo">Request a demo <ArrowRight size={16} /></Link>
              <Link className={styles.btnGhost} href="/suite">Explore the suite</Link>
              </div>
            </div>
            <div className={`${styles.heroVisual} ${styles.productHeroImage}`} role="img" aria-label="Colaris connected healthcare operations dashboard" />
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.shell}>
          <div className={`${styles.sectionHead} ${styles.reveal}`}>
            <span className={styles.eyebrow}>Capabilities</span>
            <h2 className={styles.h2}>Ten capabilities, one connected system.</h2>
            <p className={styles.lead}>Adopt the modules your organization needs today — they all share the same data and identity.</p>
          </div>
          <div className={`${styles.cardGrid} ${styles.reveal}`}>
            {CAPABILITIES.map(({ Icon, name, desc }) => (
              <div key={name} className={styles.card}>
                <span className={styles.cardIcon}><Icon size={20} /></span>
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
              <span className={styles.eyebrow}>Why one platform</span>
              <h2 className={styles.h2}>Connected by design, not by integration.</h2>
              <p className={styles.lead}>
                When everything lives in one system, the work stops being about managing tools
                and starts being about delivering care.
              </p>
              <div style={{ marginTop: 28 }}>
                <Link className={styles.btnPrimary} href="/request-demo">See it in action <ArrowRight size={16} /></Link>
              </div>
            </div>
            <ul className={`${styles.checkList} ${styles.reveal}`}>
              {WHY.map(({ Icon, title, body }) => (
                <li key={title} className={styles.checkItem}>
                  <span className={styles.checkMark}><Icon size={13} /></span>
                  <div className={styles.checkBody}>
                    <h4>{title}</h4>
                    <p>{body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className={styles.sectionTight}>
        <div className={styles.shell}>
          <div className={`${styles.statStrip} ${styles.reveal}`}>
            {STATS.map(({ num, label }) => (
              <div key={label} className={styles.stat}>
                <div className={styles.statNum}>{num}</div>
                <p className={styles.statLabel}>{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.deepBand}>
        <div className={`${styles.shell} ${styles.deepInner} ${styles.reveal}`}>
          <span className={styles.eyebrow}>Care Simplified</span>
          <h2 className={styles.deepTitle}>See the whole platform working together.</h2>
          <p className={styles.deepSub}>Walk through Colaris with our team and see how a single source of truth changes day-to-day operations.</p>
          <div className={styles.deepCtas}>
            <Link className={`${styles.btnPrimary} ${styles.btnOnDeep}`} href="/request-demo">Request a demo <ArrowRight size={16} /></Link>
            <Link className={`${styles.btnGhost} ${styles.btnGhostDeep}`} href="/suite">Explore the suite</Link>
          </div>
        </div>
      </section>
    </>
  );
}
