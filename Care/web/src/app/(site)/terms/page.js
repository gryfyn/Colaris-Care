import styles from '../site.module.css';

export const metadata = {
  title: 'Terms — Colaris',
  description: 'The terms that govern use of the Colaris website and platform from Glass Inc Technologies.',
};

export default function TermsPage() {
  return (
    <>
      <section className={styles.pageHero}>
        <div className={styles.shell}>
          <div className={styles.pageHeroInner}>
            <span className={styles.eyebrow}>Legal</span>
            <h1 className={styles.h1}>Terms of Service</h1>
            <p className={styles.heroLead}>The terms that govern your use of this website and the Colaris platform.</p>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.shell}>
          <div className={styles.prose}>
            <p className={styles.muted}>Last updated: June 2026</p>
            <p>
              These terms are a starting template for use of the Colaris website and platform,
              provided by Glass Inc Technologies. They should be reviewed by legal counsel and
              tailored to your offering before launch.
            </p>

            <h2>Use of the site</h2>
            <p>
              This website is provided for informational purposes about Colaris. You agree to use it
              lawfully and not to disrupt or misuse it.
            </p>

            <h2>The platform</h2>
            <p>
              Access to the Colaris platform is governed by the service agreement between your
              organization and Glass Inc Technologies. Those terms control in the event of any
              conflict with this page.
            </p>

            <h2>Intellectual property</h2>
            <p>
              Colaris, the Colaris logo, and related marks are the property of Glass Inc
              Technologies. Content on this site may not be reused without permission.
            </p>

            <h2>Disclaimer</h2>
            <p>
              This site is provided &ldquo;as is&rdquo; without warranties of any kind. We work to
              keep information accurate but do not guarantee it is complete or current.
            </p>

            <h2>Contact</h2>
            <p>Questions about these terms? Email <a href="mailto:legal@colaris.com">legal@colaris.com</a>.</p>
          </div>
        </div>
      </section>
    </>
  );
}
