import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import styles from '../site.module.css';

export const metadata = {
  title: 'About — Colaris',
  description:
    'Colaris is a healthcare technology company creating operational software and independent websites for care organizations.',
};

export default function AboutPage() {
  return (
    <>
      <section className={styles.pageHero}>
        <div className={styles.shell}>
          <div className={styles.pageHeroGrid}>
            <div className={styles.pageHeroInner}>
            <span className={styles.eyebrow}>About</span>
            <h1 className={styles.h1}>A connected platform for the way care really works.</h1>
            <p className={styles.heroLead}>
              Colaris is the healthcare technology company from Glass Inc Technologies — creating
              software and independent websites for organizations that deliver care.
            </p>
            <div className={styles.heroCtas}>
              <Link className={styles.btnPrimary} href="/request-demo">Request a demo <ArrowRight size={16} /></Link>
              <Link className={styles.btnGhost} href="/vision">Our vision</Link>
              </div>
            </div>
            <div className={`${styles.heroVisual} ${styles.careTeamImage}`} role="img" aria-label="Healthcare professional supporting connected care" />
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.shell}>
          <div className={`${styles.prose} ${styles.reveal}`}>
            <h2>Digital experiences built for care</h2>
            <p>
              Colaris brings healthcare context to digital product work. We create operational
              software for care teams and independent public websites for healthcare facilities.
              Each service solves a different problem, but both are shaped by the need for clarity,
              trust, accessibility, and dependable infrastructure.
            </p>

            <h2>Two focused service lines</h2>
            <p>
              Colaris Care helps teams replace disconnected operational workflows with one shared
              environment. Colaris Websites gives healthcare facilities an independent, modern web
              presence that helps families, referral partners, and future employees understand the
              organization and take the right next step.
            </p>

            <h2>Glass Inc Technologies</h2>
            <p>
              Colaris is built and operated by Glass Inc Technologies. Our mission is to simplify
              healthcare operations by giving organizations a connected platform that improves
              efficiency, enhances collaboration, and elevates patient outcomes — with a long-term
              vision of becoming the operating system powering the future of healthcare.
            </p>
            <p className={styles.muted}>Company: Glass Inc Technologies · Flagship product: Colaris · Care Simplified.</p>
          </div>
        </div>
      </section>

      <section className={styles.deepBand}>
        <div className={`${styles.shell} ${styles.deepInner} ${styles.reveal}`}>
          <span className={styles.eyebrow}>Care Simplified</span>
          <h2 className={styles.deepTitle}>Bring connected care to your organization.</h2>
          <div className={styles.deepCtas}>
            <Link className={`${styles.btnPrimary} ${styles.btnOnDeep}`} href="/request-demo">Request a demo <ArrowRight size={16} /></Link>
            <Link className={`${styles.btnGhost} ${styles.btnGhostDeep}`} href="/contact">Contact us</Link>
          </div>
        </div>
      </section>
    </>
  );
}
