import Link from 'next/link';
import { ArrowRight, HeartPulse, Globe2, Check } from 'lucide-react';
import styles from '../site.module.css';

export const metadata = {
  title: 'Healthcare Digital Solutions — Colaris',
  description: 'Explore Colaris Care software and independent healthcare facility websites from Colaris.',
};

const SOLUTIONS = [
  {
    Icon: HeartPulse,
    eyebrow: 'Operational software',
    title: 'Colaris Care',
    body: 'A connected environment for resident records, care planning, medications, workforce coordination, compliance, and reporting.',
    points: ['One operational source of truth', 'Designed for care teams', 'Modular adoption and guided rollout'],
    href: '/suite',
    cta: 'Explore Colaris Care',
  },
  {
    Icon: Globe2,
    eyebrow: 'Independent websites',
    title: 'Colaris Websites',
    body: 'Custom public websites that help healthcare facilities communicate trust, explain services, and turn interest into the right next step.',
    points: ['Independent from Colaris Care', 'Accessible and responsive', 'Search and analytics foundations'],
    href: '/websites',
    cta: 'Explore facility websites',
  },
];

export default function SolutionsPage() {
  return (
    <>
      <section className={styles.pageHero}>
        <div className={styles.shell}><div className={styles.pageHeroInner}><span className={styles.eyebrow}>Solutions</span><h1 className={styles.h1}>Digital systems for the work inside — and the story outside.</h1><p className={styles.heroLead}>Colaris helps healthcare organizations improve internal operations and public digital experiences through two focused, independent offerings.</p><div className={styles.heroCtas}><Link className={styles.btnPrimary} href="/contact">Discuss your goals <ArrowRight size={16} /></Link><Link className={styles.btnGhost} href="/pricing">View pricing</Link></div></div></div>
      </section>
      <section className={styles.section}>
        <div className={styles.shell}>
          <div className={`${styles.cardGrid} ${styles.cardGrid2} ${styles.reveal}`}>
            {SOLUTIONS.map(({ Icon, eyebrow, title, body, points, href, cta }) => (
              <article className={styles.card} key={title}>
                <span className={`${styles.cardIcon} ${styles.cardIconSolid}`}><Icon size={21} /></span>
                <span className={styles.eyebrow}>{eyebrow}</span><h2 className={styles.h2}>{title}</h2><p className={styles.cardText}>{body}</p>
                <ul className={styles.priceList}>{points.map((point) => <li key={point}><Check size={15} />{point}</li>)}</ul>
                <Link className={styles.btnGhost} href={href}>{cta} <ArrowRight size={15} /></Link>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className={styles.deepBand}><div className={`${styles.shell} ${styles.deepInner} ${styles.reveal}`}><span className={styles.eyebrow}>Start with the real need</span><h2 className={styles.deepTitle}>One service or both. Only what makes sense.</h2><p className={styles.deepSub}>We&apos;ll help define whether software, a website, or a phased combination is the right next step.</p><div className={styles.deepCtas}><Link className={`${styles.btnPrimary} ${styles.btnOnDeep}`} href="/contact">Start a conversation <ArrowRight size={16} /></Link></div></div></section>
    </>
  );
}
