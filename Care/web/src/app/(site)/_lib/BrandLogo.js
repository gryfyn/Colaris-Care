import Image from 'next/image';
import styles from './BrandLogo.module.css';

export default function BrandLogo({ size = 42, tone = 'dark', className = '' }) {
  const classes = [styles.logo, tone === 'light' ? styles.light : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <span
      className={classes}
      style={{ '--brand-logo-size': `${size}px` }}
      aria-label="Colaris - Care Simplified"
    >
      <Image className={styles.mark} src="/colarislogo.png" alt="" width={128} height={128} priority />
      <span className={styles.name} aria-hidden="true">Colaris</span>
      <span className={styles.tagline} aria-hidden="true">Care Simplified</span>
    </span>
  );
}
