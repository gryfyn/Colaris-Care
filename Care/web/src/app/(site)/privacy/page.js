import styles from '../site.module.css';

export const metadata = {
  title: 'Privacy — Colaris',
  description: 'How Colaris and Glass Inc Technologies handle personal information across the platform and marketing site.',
};

export default function PrivacyPage() {
  return (
    <>
      <section className={styles.pageHero}>
        <div className={styles.shell}>
          <div className={styles.pageHeroInner}>
            <span className={styles.eyebrow}>Legal</span>
            <h1 className={styles.h1}>Privacy</h1>
            <p className={styles.heroLead}>How we handle personal information across Colaris and this website.</p>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.shell}>
          <div className={styles.prose}>
            <p className={styles.muted}>Last updated: June 2026</p>
            <p>
              This page summarizes how Glass Inc Technologies (&ldquo;we&rdquo;) handles personal
              information in connection with the Colaris platform and this marketing site. It is a
              starting template and should be reviewed by legal counsel before launch.
            </p>

            <h2>Information we collect</h2>
            <ul>
              <li><strong>Information you provide</strong> — such as your name, work email, organization, and message when you request a demo or contact us.</li>
              <li><strong>Platform data</strong> — information your organization manages within Colaris, handled on your behalf as described in your service agreement.</li>
              <li><strong>Usage data</strong> — basic technical information needed to operate and secure the site.</li>
            </ul>

            <h2>How we use information</h2>
            <ul>
              <li>To respond to demo and contact requests.</li>
              <li>To provide, secure, and improve the Colaris platform.</li>
              <li>To meet legal, regulatory, and contractual obligations.</li>
            </ul>

            <h2>Protected health information</h2>
            <p>
              Colaris is designed for healthcare organizations. Protected health information handled
              within the platform is isolated per facility and governed by the agreements between
              your organization and Glass Inc Technologies, including any applicable Business
              Associate Agreement.
            </p>

            <h2>Your choices</h2>
            <p>
              You can request access to or deletion of the personal information you have submitted
              through this site by contacting us.
            </p>

            <h2>Contact</h2>
            <p>Questions about privacy? Email <a href="mailto:privacy@colaris.com">privacy@colaris.com</a>.</p>
          </div>
        </div>
      </section>
    </>
  );
}
