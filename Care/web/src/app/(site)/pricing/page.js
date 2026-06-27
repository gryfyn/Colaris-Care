import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import styles from '../site.module.css';

export const metadata = {
  title: 'Pricing — Colaris',
  description: 'Understand how Colaris prices healthcare software, independent facility websites, and combined digital engagements.',
};

const OPTIONS = [
  { name: 'Colaris Care', label: 'Software', value: 'Tailored', suffix: 'subscription', body: 'For facilities replacing disconnected care and administration workflows with one platform.', items: ['Scope based on facility size and modules', 'Guided setup and organization configuration', 'Role-based staff access', 'Ongoing product updates and support'], cta: 'Request software pricing', href: '/request-demo' },
  { name: 'Facility Website', label: 'Independent website', value: 'Fixed scope', suffix: 'project', body: 'For healthcare organizations that need a modern, credible, independently owned web presence.', items: ['Discovery and content architecture', 'Custom responsive design', 'Development and launch', 'Accessibility, analytics, and search foundations'], cta: 'Plan my website', href: '/contact', featured: true },
  { name: 'Digital Partnership', label: 'Combined engagement', value: 'Custom', suffix: 'engagement', body: 'For organizations aligning their public website and internal digital operations with one partner.', items: ['Website and software roadmap', 'Coordinated rollout planning', 'Shared brand and experience direction', 'Ongoing optimization options'], cta: 'Talk to our team', href: '/contact' },
];

const FAQ = [
  { q: 'Why are exact prices not listed?', a: 'Facility size, selected software modules, website content, and integration needs materially change scope. We quote the defined work rather than hiding variables in a generic package.' },
  { q: 'Is the website tied to Colaris software?', a: 'No. Facility websites are independent projects and can be created whether or not your organization uses Colaris Care.' },
  { q: 'Who owns the facility website?', a: 'Your organization owns its website content and project deliverables under the terms agreed for the engagement.' },
  { q: 'Can we begin with one service?', a: 'Yes. Start with software or a website, then expand only when it supports your organization’s goals.' },
];

export default function PricingPage() {
  return (
    <>
      <section className={styles.pageHero}>
        <div className={styles.shell}><div className={styles.pageHeroInner}><span className={styles.eyebrow}>Pricing</span><h1 className={styles.h1}>Clear scope. The right engagement.</h1><p className={styles.heroLead}>Software subscriptions and website projects are priced differently because they solve different problems. We define the work first, then provide a clear proposal.</p></div></div>
      </section>
      <section className={styles.section}>
        <div className={styles.shell}>
          <div className={`${styles.pricingGrid} ${styles.reveal}`}>
            {OPTIONS.map(({ name, label, value, suffix, body, items, cta, href, featured }) => (
              <article className={`${styles.priceCard} ${featured ? styles.priceCardFeatured : ''}`} key={name}>
                {featured && <span className={styles.priceBadge}>Most requested</span>}
                <span className={styles.eyebrow}>{label}</span><h2>{name}</h2><p>{body}</p><div className={styles.priceValue}>{value} <small>{suffix}</small></div>
                <ul className={styles.priceList}>{items.map((item) => <li key={item}><Check size={15} />{item}</li>)}</ul>
                <Link className={featured ? styles.btnPrimary : styles.btnGhost} href={href}>{cta} <ArrowRight size={15} /></Link>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className={`${styles.section} ${styles.sectionPaper}`}>
        <div className={styles.shell}><div className={`${styles.sectionHead} ${styles.reveal}`}><span className={styles.eyebrow}>Common questions</span><h2 className={styles.h2}>What to expect before a proposal.</h2></div><div className={`${styles.cardGrid} ${styles.cardGrid2} ${styles.reveal}`}>{FAQ.map(({q,a}) => <article className={styles.card} key={q}><h3 className={styles.cardTitle}>{q}</h3><p className={styles.cardText}>{a}</p></article>)}</div></div>
      </section>
      <section className={styles.deepBand}><div className={`${styles.shell} ${styles.deepInner} ${styles.reveal}`}><span className={styles.eyebrow}>Start with clarity</span><h2 className={styles.deepTitle}>Tell us what you are trying to improve.</h2><p className={styles.deepSub}>We&apos;ll recommend the smallest sensible engagement and explain what drives the scope.</p><div className={styles.deepCtas}><Link className={`${styles.btnPrimary} ${styles.btnOnDeep}`} href="/contact">Discuss your project <ArrowRight size={16} /></Link></div></div></section>
    </>
  );
}
