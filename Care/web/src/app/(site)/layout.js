import Link from 'next/link';
import { SiteNav, RevealController } from './_lib/chrome';
import BrandLogo from './_lib/BrandLogo';
import styles from './site.module.css';

export default function SiteLayout({ children }) {
  const year = new Date().getFullYear();

  return (
    <div className={styles.site}>
      <SiteNav />
      <RevealController />
      <main>{children}</main>

      <footer className={styles.footer}>
        <div className={styles.shell}>
          <div className={styles.footTop}>
            <div className={styles.footBrand}>
              <Link className={styles.brand} href="/">
                <BrandLogo tone="light" size={46} />
              </Link>
              <p className={styles.footTagline}>
                Digital products and independent websites for healthcare organizations.
                Built by Glass Inc Technologies with care, clarity, and modern infrastructure.
              </p>
            </div>
            <div className={styles.footCols}>
              <div className={styles.footCol}>
                <h4>Solutions</h4>
                <Link href="/suite">Colaris Care</Link>
                <Link href="/websites">Facility websites</Link>
                <Link href="/pricing">Pricing</Link>
                <Link href="/who-its-for">Who it&apos;s for</Link>
              </div>
              <div className={styles.footCol}>
                <h4>Company</h4>
                <Link href="/about">About</Link>
                <Link href="/vision">Vision &amp; mission</Link>
                <Link href="/contact">Contact</Link>
                <Link href="/request-demo">Start a conversation</Link>
                <Link href="/login">Client sign in</Link>
              </div>
              <div className={styles.footCol}>
                <h4>Legal</h4>
                <Link href="/privacy">Privacy</Link>
                <Link href="/terms">Terms</Link>
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
