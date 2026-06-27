import Link from 'next/link';
import { ArrowRight, Compass, PenTool, Code2, Rocket, SearchCheck, Accessibility, Gauge, BarChart3 } from 'lucide-react';
import styles from '../site.module.css';

export const metadata = {
  title: 'Healthcare Facility Websites — Colaris',
  description: 'Independent, accessible, high-performing websites designed and built by Colaris for healthcare facilities and care organizations.',
};

const OUTCOMES = [
  { Icon: SearchCheck, title: 'Clearer discovery', body: 'Help families and referral partners understand your services, eligibility, and next step.' },
  { Icon: Accessibility, title: 'Accessible by default', body: 'Readable content, keyboard-friendly interactions, strong contrast, and responsive layouts.' },
  { Icon: Gauge, title: 'Fast and dependable', body: 'Modern performance practices that keep essential information quick to reach.' },
  { Icon: BarChart3, title: 'Measurable', body: 'Analytics foundations that show what people seek and where inquiries originate.' },
];

const PROCESS = [
  { n: '01', Icon: Compass, title: 'Discover', body: 'We learn your organization, audiences, services, and goals.' },
  { n: '02', Icon: PenTool, title: 'Design', body: 'We shape the content, visual direction, and complete user experience.' },
  { n: '03', Icon: Code2, title: 'Build', body: 'We develop, test, optimize, and prepare your independent website.' },
  { n: '04', Icon: Rocket, title: 'Launch', body: 'We deploy the site, connect analytics, and support a confident handoff.' },
];

export default function WebsitesPage() {
  return (
    <>
      <section className={styles.pageHero}>
        <div className={styles.shell}>
          <div className={styles.pageHeroGrid}>
            <div className={styles.pageHeroInner}>
              <span className={styles.eyebrow}>Independent healthcare websites</span>
              <h1 className={styles.h1}>A better first experience with your facility.</h1>
              <p className={styles.heroLead}>
                Colaris designs and builds independent websites for healthcare facilities.
                Your site belongs to your organization and works separately from our software.
              </p>
              <div className={styles.heroCtas}>
                <Link className={styles.btnPrimary} href="/contact">Start a website project <ArrowRight size={16} /></Link>
                <Link className={styles.btnGhost} href="/pricing">View pricing approach</Link>
              </div>
            </div>
            <div className={styles.serviceHeroVisual} aria-label="Example independent healthcare facility website">
              <div className={styles.serviceBrowser}>
                <div className={styles.serviceBrowserBar}><i /><i /><i /><span>dependablecare.org</span></div>
                <div className={styles.serviceSiteNav}><b>Dependable Care</b><span>Our care&nbsp;&nbsp; Community&nbsp;&nbsp; Admissions</span><em>Schedule a visit</em></div>
                <div className={styles.serviceSiteHero}><div><small>Care that feels personal</small><strong>Support, dignity, and belonging.</strong><span>Discover our approach →</span></div><div className={styles.servicePhoto} /></div>
                <div className={styles.serviceSiteFoot}><span><b>24/7</b> compassionate support</span><span><b>4.9</b> family rating</span><span><b>12+</b> care programs</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.shell}>
          <div className={`${styles.sectionHead} ${styles.reveal}`}>
            <span className={styles.eyebrow}>Built for healthcare decisions</span>
            <h2 className={styles.h2}>More than a brochure. A clear path to trust.</h2>
            <p className={styles.lead}>Every page helps a real audience answer a real question, from finding appropriate care to making the first inquiry.</p>
          </div>
          <div className={`${styles.cardGrid} ${styles.cardGrid2} ${styles.reveal}`}>
            {OUTCOMES.map(({ Icon, title, body }) => <article className={styles.card} key={title}><span className={styles.cardIcon}><Icon size={20} /></span><h3 className={styles.cardTitle}>{title}</h3><p className={styles.cardText}>{body}</p></article>)}
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.sectionPaper}`}>
        <div className={styles.shell}>
          <div className={`${styles.sectionHead} ${styles.reveal}`}><span className={styles.eyebrow}>How we work</span><h2 className={styles.h2}>A focused path from idea to launch.</h2></div>
          <div className={`${styles.processGrid} ${styles.reveal}`}>
            {PROCESS.map(({ n, Icon, title, body }) => <article className={styles.processStep} key={n}><span>{n} · <Icon size={14} /></span><h3>{title}</h3><p>{body}</p></article>)}
          </div>
        </div>
      </section>

      <section className={styles.deepBand}>
        <div className={`${styles.shell} ${styles.deepInner} ${styles.reveal}`}>
          <span className={styles.eyebrow}>Your organization, independently represented</span>
          <h2 className={styles.deepTitle}>Build a website worthy of the care you provide.</h2>
          <p className={styles.deepSub}>Tell us what your facility needs to communicate and we&apos;ll shape the right scope.</p>
          <div className={styles.deepCtas}><Link className={`${styles.btnPrimary} ${styles.btnOnDeep}`} href="/contact">Start a project <ArrowRight size={16} /></Link><Link className={`${styles.btnGhost} ${styles.btnGhostDeep}`} href="/pricing">See pricing</Link></div>
        </div>
      </section>
    </>
  );
}
