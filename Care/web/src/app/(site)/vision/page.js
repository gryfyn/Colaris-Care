import Link from 'next/link';
import { ArrowRight, Shield, HeartHandshake, Cpu, Lightbulb, Minimize2 } from 'lucide-react';
import styles from '../site.module.css';

export const metadata = {
  title: 'Vision & Mission — Colaris',
  description:
    'Colaris exists to become the operating system powering the future of healthcare — simplifying operations, enhancing collaboration, and elevating outcomes.',
};

const PRINCIPLES = [
  { Icon: Shield,         name: 'Trustworthy',    desc: 'Organizations rely on Colaris for critical operations and sensitive information.' },
  { Icon: HeartHandshake, name: 'Human-Centered', desc: 'Technology should support people, not replace them.' },
  { Icon: Cpu,            name: 'Modern',         desc: 'Built on modern cloud technology with intuitive, considered experiences.' },
  { Icon: Lightbulb,      name: 'Intelligent',    desc: 'Data-driven insight that helps organizations make better decisions.' },
  { Icon: Minimize2,      name: 'Simple',         desc: 'Complex healthcare processes made genuinely easy.' },
];

const HORIZON = [
  { title: 'Intelligent automation', body: "AI-driven workflows that take routine work off your teams' plate." },
  { title: 'Predictive analytics',   body: 'Insight that helps organizations act before problems become incidents.' },
  { title: 'A connected ecosystem',  body: 'A platform that becomes the operating system for modern healthcare organizations.' },
];

export default function VisionPage() {
  return (
    <>
      <section className={styles.pageHero}>
        <div className={styles.shell}>
          <div className={styles.pageHeroGrid}>
            <div className={styles.pageHeroInner}>
            <span className={styles.eyebrow}>Vision &amp; mission</span>
            <h1 className={styles.h1}>The operating system for the <em>future of healthcare.</em></h1>
            <p className={styles.heroLead}>
              Colaris is not another healthcare management system. It&apos;s a connected platform
              built to simplify care delivery and elevate outcomes for every organization that
              relies on it.
            </p>
            <div className={styles.heroCtas}>
              <Link className={styles.btnPrimary} href="/request-demo">Request a demo <ArrowRight size={16} /></Link>
              <Link className={styles.btnGhost} href="/platform">See the platform</Link>
              </div>
            </div>
            <div className={`${styles.heroVisual} ${styles.collaborationImage}`} role="img" aria-label="Healthcare team collaborating on the future of care" />
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.shell}>
          <div className={`${styles.split} ${styles.reveal}`}>
            <div>
              <span className={styles.eyebrow}>Vision</span>
              <p className={styles.h2} style={{ marginTop: 16 }}>
                To become the operating system powering the future of healthcare.
              </p>
            </div>
            <div>
              <span className={styles.eyebrow}>Mission</span>
              <p className={styles.lead} style={{ marginTop: 16, fontSize: '1.18rem', color: 'var(--ink-2)' }}>
                To simplify healthcare operations by providing organizations with a connected
                platform that improves efficiency, enhances collaboration, and elevates patient
                outcomes.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.sectionPaper}`}>
        <div className={styles.shell}>
          <div className={`${styles.sectionHead} ${styles.reveal}`}>
            <span className={styles.eyebrow}>What we value</span>
            <h2 className={styles.h2}>The principles behind the product.</h2>
            <p className={styles.lead}>Five commitments that shape every decision we make in Colaris.</p>
          </div>
          <div className={`${styles.cardGrid} ${styles.reveal}`}>
            {PRINCIPLES.map(({ Icon, name, desc }) => (
              <div key={name} className={styles.card}>
                <span className={styles.cardIcon}><Icon size={20} /></span>
                <h3 className={styles.cardTitle}>{name}</h3>
                <p className={styles.cardText}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.shell}>
          <div className={`${styles.sectionHead} ${styles.reveal}`}>
            <span className={styles.eyebrow}>The long term</span>
            <h2 className={styles.h2}>Where Colaris is heading.</h2>
            <p className={styles.lead}>
              Colaris will evolve into a comprehensive ecosystem — helping organizations deliver
              better outcomes while reducing operational complexity.
            </p>
          </div>
          <div className={`${styles.cardGrid} ${styles.reveal}`}>
            {HORIZON.map(({ title, body }) => (
              <div key={title} className={styles.card}>
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
          <h2 className={styles.deepTitle}>Help build the future of care delivery.</h2>
          <p className={styles.deepSub}>See where Colaris is today — and where it&apos;s going next.</p>
          <div className={styles.deepCtas}>
            <Link className={`${styles.btnPrimary} ${styles.btnOnDeep}`} href="/request-demo">Request a demo <ArrowRight size={16} /></Link>
            <Link className={`${styles.btnGhost} ${styles.btnGhostDeep}`} href="/about">About Glass Inc</Link>
          </div>
        </div>
      </section>
    </>
  );
}
