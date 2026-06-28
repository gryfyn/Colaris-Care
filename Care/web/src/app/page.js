'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import {
  Users, ClipboardList, Pill, Briefcase, Calendar, ShieldCheck,
  AlertTriangle, CreditCard, MessageSquare, BarChart2, HeartPulse,
  Sparkles, ArrowRight, ArrowUpRight, Check, Bell, Clock3,
  FileCheck2, LayoutDashboard, Settings, TrendingUp,
  Globe2, MonitorSmartphone, SearchCheck, Palette,
} from 'lucide-react';
import styles from './page.module.css';
import BrandLogo from './(site)/_lib/BrandLogo';

const CAPABILITIES = [
  { Icon: Users,          name: 'Patient Management',           desc: "Every resident's profile, history, and care team in one connected record." },
  { Icon: ClipboardList,  name: 'Care Planning',                desc: 'Build, update, and track individualized care plans as needs change.' },
  { Icon: Pill,           name: 'Medication Administration',    desc: 'Record medications and administration with a clear, auditable trail.' },
  { Icon: Briefcase,      name: 'Workforce Management',         desc: 'Manage staff, roles, and credentials across the whole organization.' },
  { Icon: Calendar,       name: 'Staff Scheduling',             desc: 'Build balanced schedules and fill open shifts without the spreadsheets.' },
  { Icon: ShieldCheck,    name: 'Compliance Tracking',          desc: 'Stay audit-ready with requirements and renewals tracked automatically.' },
  { Icon: AlertTriangle,  name: 'Incident Reporting',           desc: 'Capture, route, and resolve incidents the moment they happen.' },
  { Icon: CreditCard,     name: 'Billing & Financial Ops',      desc: 'Run billing and revenue operations alongside the care you deliver.' },
  { Icon: MessageSquare,  name: 'Communication & Messaging',    desc: 'Keep caregivers, administrators, and families on the same page.' },
  { Icon: BarChart2,      name: 'Analytics & Reporting',        desc: 'Turn day-to-day operations into decisions you can act on.' },
];

const CAPABILITY_GROUPS = [
  { label: 'Deliver better care', range: [0, 3], index: '01' },
  { label: 'Run stronger teams', range: [3, 6], index: '02' },
  { label: 'Stay ahead of risk', range: [6, 10], index: '03' },
];

const SUITE = [
  { Icon: HeartPulse,   lead: 'Care',       desc: 'Patient and care management at the heart of the platform.' },
  { Icon: Users,        lead: 'Workforce',  desc: 'Staff scheduling and workforce optimization.' },
  { Icon: ShieldCheck,  lead: 'Compliance', desc: 'Regulatory compliance and audit readiness.' },
  { Icon: CreditCard,   lead: 'Billing',    desc: 'Healthcare billing and revenue management.' },
  { Icon: BarChart2,    lead: 'Insights',   desc: 'Reporting, dashboards, and analytics.' },
  { Icon: Sparkles,     lead: 'AI',         desc: 'Intelligent automation and decision support.', tag: 'Roadmap' },
];

const AUDIENCE_NOW = [
  'Residential Treatment Facilities',
  'Assisted Living Communities',
  'Long-Term Care Providers',
  'Behavioral Health Organizations',
  'Community Healthcare Providers',
];
const AUDIENCE_SOON = [
  'Clinics',
  'Hospitals',
  'Home Healthcare Agencies',
  'Healthcare Networks',
  'Government Healthcare Programs',
];

const PRINCIPLES = ['Trustworthy', 'Human-Centered', 'Modern', 'Intelligent', 'Simple'];

const DASHBOARD_METRICS = [
  { label: 'Residents', value: '128', note: '+5 this week', Icon: Users },
  { label: 'Medications due', value: '23', note: 'View schedule', Icon: Pill },
  { label: 'Open incidents', value: '7', note: '2 need review', Icon: ShieldCheck },
];

const DASHBOARD_NAV = [
  { label: 'Overview', Icon: LayoutDashboard, active: true },
  { label: 'Residents', Icon: Users },
  { label: 'Care plans', Icon: ClipboardList },
  { label: 'Medications', Icon: Pill },
  { label: 'Reports', Icon: BarChart2 },
];

const WEBSITE_FEATURES = [
  { Icon: Palette, title: 'Built around your identity', text: 'A distinctive site shaped around your facility, services, and community.' },
  { Icon: MonitorSmartphone, title: 'Designed for every screen', text: 'Fast, accessible experiences for families, referral partners, and applicants.' },
  { Icon: SearchCheck, title: 'Ready to be discovered', text: 'Clear structure, local search foundations, analytics, and conversion paths.' },
];

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const year = new Date().getFullYear();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const els = document.querySelectorAll(`.${styles.reveal}`);
    if (!els.length) return;

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || !('IntersectionObserver' in window)) return; // leave content visible

    // Arm (hide) then reveal on scroll. Anything already on screen reveals immediately.
    els.forEach((el) => el.classList.add(styles.armed));
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add(styles.revealIn);
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className={styles.page}>
      {/* ── Nav ─────────────────────────────────────────────── */}
      <header className={`${styles.nav} ${scrolled ? styles.navScrolled : ''}`}>
        <div className={`${styles.shell} ${styles.navInner}`}>
          <a className={styles.brand} href="#top">
            <BrandLogo />
          </a>
          <nav className={styles.navLinks}>
            <a className={styles.navLink} href="/care">Colaris Care</a>
            <a className={styles.navLink} href="/solutions">Solutions</a>
            <a className={styles.navLink} href="/websites">Websites</a>
            <a className={styles.navLink} href="/pricing">Pricing</a>
            <a className={styles.navLink} href="/about">Company</a>
          </nav>
          <div className={styles.navActions}>
            <a className={styles.navSignin} href="/login">Client sign in</a>
            <a className={styles.btnPrimary} href="/care">
              Open Colaris Care <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </header>

      <main id="top">
        {/* ── Hero ──────────────────────────────────────────── */}
        <section className={styles.hero}>
          <div className={`${styles.shell} ${styles.heroGrid}`}>
            <div>
              <span className={styles.eyebrow}>Healthcare technology &amp; web studio</span>
              <h1 className={styles.h1}>
                Better digital experiences.<br />Built <em>for care.</em>
              </h1>
              <p className={styles.heroSub}>
                Colaris creates modern healthcare software and independent websites for care
                organizations, helping teams operate clearly and helping families find the
                right care with confidence.
              </p>
              <div className={styles.heroCtas}>
                <a className={styles.btnPrimary} href="/care">
                  Explore Colaris Care <ArrowRight size={16} />
                </a>
                <a className={styles.btnGhost} href="/login">Sign in to your workspace</a>
              </div>
              <div className={styles.heroMeta}>
                <span className={styles.heroMetaItem}><Check size={15} /> Healthcare software</span>
                <span className={styles.heroMetaItem}><Check size={15} /> Independent websites</span>
                <span className={styles.heroMetaItem}><Check size={15} /> Built for care organizations</span>
              </div>
            </div>

            <div className={styles.productStage} role="img" aria-label="Preview of the Colaris operations dashboard">
              <div className={styles.productGlow} aria-hidden="true" />
              <div className={styles.dashboardFrame}>
                <aside className={styles.dashboardRail} aria-hidden="true">
                  <div className={styles.railBrand}><Image src="/colarislogo.png" alt="" width={20} height={20} /><span>Colaris</span></div>
                  <div className={styles.railNav}>
                    {DASHBOARD_NAV.map(({ label, Icon, active }) => (
                      <span key={label} className={active ? styles.railItemActive : styles.railItem}>
                        <Icon size={14} /> {label}
                      </span>
                    ))}
                  </div>
                  <span className={styles.railItem}><Settings size={14} /> Settings</span>
                </aside>
                <div className={styles.dashboardMain}>
                  <div className={styles.dashboardTop}>
                    <div>
                      <p>Good morning, Sarah</p>
                      <span>Here&apos;s what needs your attention today.</span>
                    </div>
                    <span className={styles.notification}><Bell size={15} /><i /></span>
                  </div>
                  <div className={styles.metricGrid}>
                    {DASHBOARD_METRICS.map(({ label, value, note, Icon }) => (
                      <div className={styles.metricCard} key={label}>
                        <span className={styles.metricIcon}><Icon size={15} /></span>
                        <small>{label}</small>
                        <strong>{value}</strong>
                        <em>{note}</em>
                      </div>
                    ))}
                  </div>
                  <div className={styles.dashboardLower}>
                    <div className={styles.scheduleCard}>
                      <div className={styles.cardHeading}><span>Today&apos;s schedule</span><Clock3 size={15} /></div>
                      {['8:00  Medication pass', '9:30  Care team huddle', '11:00  Individual therapy'].map((item) => (
                        <p key={item}>{item}</p>
                      ))}
                    </div>
                    <div className={styles.progressCard}>
                      <div className={styles.cardHeading}><span>Care plan progress</span><TrendingUp size={15} /></div>
                      <div className={styles.progressVisual}>
                        <div className={styles.progressRing}><span>82%</span></div>
                        <p><b>On track</b><span>18 active plans</span></p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className={styles.statusFloat} aria-hidden="true">
                <span><FileCheck2 size={17} /></span>
                <p><b>Documentation complete</b><small>All required fields verified</small></p>
                <Check size={15} />
              </div>
            </div>
          </div>
        </section>

        {/* ── Value band ────────────────────────────────────── */}
        <section className={styles.valueBand}>
          <div className={`${styles.shell} ${styles.valueGrid} ${styles.reveal}`}>
            <div className={styles.valueItem}>
              <h3>Healthcare Focus</h3>
              <p>Digital work grounded in the realities of care organizations, families, and teams.</p>
            </div>
            <div className={styles.valueItem}>
              <h3>Two Clear Services</h3>
              <p>Operational software and independent facility websites, scoped separately.</p>
            </div>
            <div className={styles.valueItem}>
              <h3>Built for Trust</h3>
              <p>Accessible, secure-minded experiences with clarity over unnecessary complexity.</p>
            </div>
          </div>
        </section>

        {/* ── Platform capabilities ─────────────────────────── */}
        <section id="platform" className={styles.section}>
          <div className={styles.shell}>
            <div className={`${styles.sectionHead} ${styles.platformHead} ${styles.reveal}`}>
              <span className={styles.eyebrow}>Colaris Care software</span>
              <h2 className={styles.h2}>Everything care delivery needs, connected.</h2>
              <p className={styles.lead}>
                Traditional systems isolate workflows. Colaris brings them into one ecosystem,
                so every team works from the same source of truth.
              </p>
            </div>
            <div className={`${styles.platformVisual} ${styles.reveal}`}>
              <div className={styles.platformBrowserBar} aria-hidden="true">
                <span /><span /><span />
                <p>One connected workspace for every care team</p>
              </div>
              <Image
                className={styles.platformImage}
                src="/images/colaris-platform-dashboard.png"
                alt="Colaris healthcare operations dashboard showing resident care, scheduling, compliance, staff, and reporting workflows"
                width={1536}
                height={1024}
                sizes="(max-width: 1180px) 100vw, 1132px"
              />
              <div className={styles.platformProof}>
                <span><Check size={14} /> Shared resident record</span>
                <span><Check size={14} /> Real-time oversight</span>
                <span><Check size={14} /> Audit-ready workflows</span>
              </div>
            </div>
            <div className={`${styles.capGroups} ${styles.reveal}`}>
              {CAPABILITY_GROUPS.map(({ label, range, index }) => (
                <article key={label} className={styles.capGroup}>
                  <header className={styles.capGroupHead}>
                    <span>{index}</span>
                    <h3>{label}</h3>
                  </header>
                  <div className={styles.capGroupItems}>
                    {CAPABILITIES.slice(...range).map(({ Icon, name, desc }) => (
                      <div key={name} className={styles.capFeature}>
                        <span className={styles.capIcon}><Icon size={19} /></span>
                        <div>
                          <h4 className={styles.capName}>{name}</h4>
                          <p className={styles.capDesc}>{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Colaris Suite ─────────────────────────────────── */}
        <section id="websites" className={styles.webSection}>
          <div className={`${styles.shell} ${styles.webGrid}`}>
            <div className={`${styles.webCopy} ${styles.reveal}`}>
              <span className={styles.eyebrow}><Globe2 size={14} /> Independent facility websites</span>
              <h2 className={styles.webTitle}>Your website should make choosing care feel clearer.</h2>
              <p className={styles.webLead}>
                We design and build independent websites for healthcare facilities — separate
                from the Colaris software — with the trust, accessibility, and clarity families
                need when making important decisions.
              </p>
              <div className={styles.webFeatures}>
                {WEBSITE_FEATURES.map(({ Icon, title, text }) => (
                  <div className={styles.webFeature} key={title}>
                    <span><Icon size={18} /></span>
                    <p><strong>{title}</strong><small>{text}</small></p>
                  </div>
                ))}
              </div>
              <a className={styles.btnLight} href="/websites">Explore healthcare websites <ArrowRight size={16} /></a>
            </div>

            <div className={`${styles.websiteMockup} ${styles.reveal}`} aria-label="Example healthcare facility website design">
              <div className={styles.mockBrowser}><i /><i /><i /><span>dependablecare.org</span></div>
              <div className={styles.mockSiteNav}><b>Dependable Care</b><span>About&nbsp;&nbsp; Services&nbsp;&nbsp; Admissions</span><em>Schedule a visit</em></div>
              <div className={styles.mockSiteHero}>
                <div><small>Compassionate residential care</small><strong>A place to feel supported, seen, and at home.</strong><span>Explore our approach&nbsp; →</span></div>
                <div className={styles.mockPortrait}><i /><i /></div>
              </div>
              <div className={styles.mockStats}><span><b>24/7</b> support</span><span><b>4.9</b> family rating</span><span><b>12+</b> care programs</span></div>
            </div>
          </div>
        </section>

        <section id="suite" className={`${styles.section} ${styles.suiteSection}`}>
          <div className={styles.shell}>
            <div className={`${styles.sectionHead} ${styles.reveal}`}>
              <span className={styles.eyebrow}>The Colaris suite</span>
              <h2 className={styles.h2}>A family of products, one ecosystem.</h2>
              <p className={styles.lead}>
                Adopt what you need today and grow into the rest. Every Colaris product shares
                the same data, identity, and experience.
              </p>
            </div>
            <div className={`${styles.suiteGrid} ${styles.reveal}`}>
              {SUITE.map(({ Icon, lead, desc, tag }) => (
                <article key={lead} className={styles.suiteCard}>
                  <div className={styles.suiteTop}>
                    <span className={styles.suiteIcon}><Icon size={20} /></span>
                    <h3 className={styles.suiteName}><span>Colaris</span> {lead}</h3>
                  </div>
                  <p className={styles.suiteDesc}>{desc}</p>
                  {tag && <span className={styles.suiteTag}>{tag}</span>}
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Who it's for ──────────────────────────────────── */}
        <section id="audience" className={styles.section}>
          <div className={styles.shell}>
            <div className={`${styles.sectionHead} ${styles.reveal}`}>
              <span className={styles.eyebrow}>Who it&apos;s for</span>
              <h2 className={styles.h2}>Built for the organizations delivering care.</h2>
            </div>
            <div className={`${styles.audGrid} ${styles.reveal}`}>
              <div className={`${styles.audCol} ${styles.audColLive}`}>
                <h3>Serving today</h3>
                <ul className={styles.audList}>
                  {AUDIENCE_NOW.map((a) => (
                    <li key={a} className={styles.audItem}>
                      <span className={styles.audMark}><Check size={13} /></span>{a}
                    </li>
                  ))}
                </ul>
              </div>
              <div className={`${styles.audCol} ${styles.audColSoon}`}>
                <h3>Expanding to</h3>
                <ul className={styles.audList}>
                  {AUDIENCE_SOON.map((a) => (
                    <li key={a} className={styles.audItem}>
                      <span className={styles.audMark}><ArrowUpRight size={13} /></span>{a}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── Vision / Mission ──────────────────────────────── */}
        <section id="vision" className={`${styles.section} ${styles.visionSection}`}>
          <div className={styles.shell}>
            <div className={`${styles.visionGrid} ${styles.reveal}`}>
              <div className={styles.visionCell}>
                <span className={styles.eyebrow}>Vision</span>
                <p className={styles.visionStmt}>
                  To become the <span>operating system</span> powering the future of healthcare.
                </p>
              </div>
              <div className={styles.visionCell}>
                <span className={styles.eyebrow}>Mission</span>
                <p className={styles.visionStmt}>
                  To simplify healthcare operations through a connected platform that improves
                  efficiency, enhances collaboration, and <span>elevates outcomes</span>.
                </p>
              </div>
            </div>
            <div className={`${styles.principles} ${styles.reveal}`}>
              {PRINCIPLES.map((p) => (
                <span key={p} className={styles.principle}><b>·</b>{p}</span>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA ─────────────────────────────────────── */}
        <section className={styles.ctaSection}>
          <div className={`${styles.shell} ${styles.reveal}`}>
            <p className={styles.ctaTag}>Build what care <span>needs next.</span></p>
            <p className={styles.ctaSub}>
              Whether you need better internal software or a better public website, we&apos;ll help
              define the right digital path for your organization.
            </p>
            <div className={styles.ctaButtons}>
              <a className={styles.btnPrimary} href="/contact">Start a conversation <ArrowRight size={16} /></a>
              <a className={styles.btnGhost} href="/pricing">View pricing</a>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className={styles.footer}>
        <div className={styles.shell}>
          <div className={styles.footTop}>
            <div className={styles.footBrand}>
              <span className={styles.brand}>
                <BrandLogo tone="light" size={46} />
              </span>
              <p className={styles.footTagline}>
                Digital products and independent websites for healthcare organizations,
                built by Glass Inc Technologies.
              </p>
            </div>
            <div className={styles.footCols}>
              <div className={styles.footCol}>
                <h4>Solutions</h4>
                <a href="/suite">Colaris Care</a>
                <a href="/websites">Facility websites</a>
                <a href="/pricing">Pricing</a>
                <a href="/who-its-for">Who it&apos;s for</a>
              </div>
              <div className={styles.footCol}>
                <h4>Company</h4>
                <a href="/about">About</a>
                <a href="/vision">Vision &amp; mission</a>
                <a href="/contact">Contact</a>
                <a href="/request-demo">Start a conversation</a>
                <a href="/login">Client sign in</a>
              </div>
              <div className={styles.footCol}>
                <h4>Legal</h4>
                <a href="/privacy">Privacy</a>
                <a href="/terms">Terms</a>
              </div>
            </div>
          </div>
          <div className={styles.footBottom}>
            <span>© {year} Glass Inc Technologies · Colaris</span>
            <span>Technology and websites, built for care.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
