'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, Menu } from 'lucide-react';
import BrandLogo from './BrandLogo';
import styles from '../site.module.css';

export const NAV_LINKS = [
  { label: 'Solutions', href: '/solutions' },
  { label: 'Websites', href: '/websites' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Company', href: '/about' },
];

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`${styles.nav} ${scrolled ? styles.navScrolled : ''}`}>
      <div className={`${styles.shell} ${styles.navInner}`}>
        <Link className={styles.brand} href="/">
          <BrandLogo />
        </Link>
        <nav className={styles.navLinks}>
          {NAV_LINKS.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className={`${styles.navLink} ${pathname === href ? styles.navLinkActive : ''}`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <details className={styles.mobileMenu}>
          <summary aria-label="Open navigation"><Menu size={20} /></summary>
          <nav className={styles.mobileMenuPanel} aria-label="Mobile navigation">
            {NAV_LINKS.map(({ label, href }) => <Link key={href} href={href}>{label}</Link>)}
            <Link href="/login">Client sign in</Link>
            <Link className={styles.mobileMenuCta} href="/contact">Start a project <ArrowRight size={15} /></Link>
          </nav>
        </details>
        <div className={styles.navActions}>
          <Link className={styles.navSignin} href="/login">Client sign in</Link>
          <Link className={styles.btnPrimary} href="/contact">
            Start a project <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </header>
  );
}

/* Scroll-reveal as progressive enhancement. Content is visible by default; JS
   arms (hides) then reveals on scroll. Re-runs on route change so each page's
   elements get observed. */
export function RevealController() {
  const pathname = usePathname();

  useEffect(() => {
    const els = document.querySelectorAll(`.${styles.reveal}`);
    if (!els.length) return;

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || !('IntersectionObserver' in window)) return;

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
  }, [pathname]);

  return null;
}
