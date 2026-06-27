import Link from 'next/link';
import {
  Users, Pill, ClipboardCheck, CalendarCheck, ShieldCheck, BellRing,
  ArrowRight, HeartPulse,
} from 'lucide-react';
import styles from '../site.module.css';

export const metadata = {
  title: 'Colaris Care — Patient & care management | Colaris',
  description:
    'Colaris Care is the patient and care management product at the heart of the Colaris suite — resident records, care plans, medications, documentation, and compliance in one connected workspace.',
};

const ADMIN_LOGIN = '/login?next=/admin/dashboard&intent=admin';
const STAFF_LOGIN = '/login?next=/staff/dashboard&intent=staff';

const CAPABILITIES = [
  { Icon: Users, title: 'Resident records', desc: 'Profiles, face sheets, care plans, and assigned teams connected in one reliable record.' },
  { Icon: Pill, title: 'Medication workflows', desc: 'Prescriptions, administration queues, and review history with a clear, auditable trail.' },
  { Icon: ClipboardCheck, title: 'Clinical documentation', desc: 'Progress notes, incidents, drug disposal, and evacuation drills through structured workflows.' },
  { Icon: CalendarCheck, title: 'Daily coordination', desc: 'Appointments, shifts, announcements, and facility calendars in the flow of care.' },
  { Icon: ShieldCheck, title: 'Compliance review', desc: 'A consistent administrator review queue with status, notes, and operational oversight.' },
  { Icon: BellRing, title: 'Actionable alerts', desc: 'Assignments, incidents, and schedule changes surfaced to the right people, resolved when done.' },
];

const HIGHLIGHTS = [
  { title: 'Built on the shared Colaris platform', body: 'Care reads and writes the same connected record as the rest of the suite — one data model, one identity, no exports.' },
  { title: 'Secure by default', body: 'Per-facility tenant isolation, encrypted health information, and a full audit trail on every change.' },
  { title: 'Documents where you need them', body: 'Capture admission packets, IDs, and staff credentials, stored privately and opened with short-lived links.' },
];

const STATS = [
  { num: 'Admin + Staff', label: 'Two purpose-built portals on one record' },
  { num: 'HIPAA-minded', label: 'Encrypted PHI with tenant-scoped access' },
  { num: 'Real-time', label: 'Notifications that clear when the task is done' },
  { num: 'One suite', label: 'Care is the first of six Colaris products' },
];

export default function CarePage() {
  return (
    <>
      <section className={styles.pageHero}>
        <div className={styles.shell}>
          <div className={styles.pageHeroGrid}>
            <div className={styles.pageHeroInner}>
              <span className={styles.eyebrow}><HeartPulse size={14} /> Colaris Care</span>
              <h1 className={styles.h1}>Patient and care management, <em>at the heart of the suite.</em></h1>
              <p className={styles.heroLead}>
                The connected workspace for resident records, care plans, medications, and documentation —
                with a portal for administrators and one for the caregivers on the floor.
              </p>
              <div className={styles.heroCtas}>
                <Link className={styles.btnPrimary} href={ADMIN_LOGIN}>Open admin <ArrowRight size={16} /></Link>
                <Link className={styles.btnGhost} href={STAFF_LOGIN}>Staff portal</Link>
              </div>
            </div>
            <div className={`${styles.heroVisual} ${styles.productHeroImage}`} role="img" aria-label="Colaris Care workspace" />
          </div>
        </div>
      </section>

      <section className={styles.section}>
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

      <section className={`${styles.section} ${styles.sectionPaper}`}>
        <div className={styles.shell}>
          <div className={`${styles.sectionHead} ${styles.reveal}`}>
            <span className={styles.eyebrow}>What Care covers</span>
            <h2 className={styles.h2}>Everything a care team touches in a day.</h2>
            <p className={styles.lead}>From admission to administration, the work lives in one place — structured, accountable, and easy to navigate.</p>
          </div>
          <div className={`${styles.cardGrid} ${styles.reveal}`}>
            {CAPABILITIES.map(({ Icon, title, desc }) => (
              <article key={title} className={styles.card}>
                <span className={styles.cardIcon}><Icon size={20} /></span>
                <h3 className={styles.cardTitle}>{title}</h3>
                <p className={styles.cardText}>{desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.shell}>
          <div className={styles.split}>
            <div className={styles.reveal}>
              <span className={styles.eyebrow}>Why teams choose it</span>
              <h2 className={styles.h2}>Connected, secure, and ready for survey day.</h2>
              <p className={styles.lead}>Care is a product, not a silo — it shares the platform the rest of Colaris is built on.</p>
            </div>
            <ul className={`${styles.checkList} ${styles.reveal}`}>
              {HIGHLIGHTS.map(({ title, body }) => (
                <li key={title} className={styles.checkItem}>
                  <span className={styles.checkMark}><ShieldCheck size={14} /></span>
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

      <section className={styles.deepBand}>
        <div className={`${styles.shell} ${styles.deepInner} ${styles.reveal}`}>
          <span className={styles.eyebrow}>Care Simplified</span>
          <h2 className={styles.deepTitle}>Step into the workspace.</h2>
          <p className={styles.deepSub}>Sign in to the administrator or caregiver portal, or talk to us about bringing Colaris Care to your facility.</p>
          <div className={styles.deepCtas}>
            <Link className={`${styles.btnPrimary} ${styles.btnOnDeep}`} href={ADMIN_LOGIN}>Open admin <ArrowRight size={16} /></Link>
            <Link className={`${styles.btnGhost} ${styles.btnGhostDeep}`} href="/request-demo">Request a demo</Link>
          </div>
        </div>
      </section>
    </>
  );
}
