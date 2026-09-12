import type { LandingContent } from '../content';
import styles from './PerformanceLab.module.css';

interface PerformanceLabProps {
  content: LandingContent['performanceLab'];
}

/**
 * The Frontend Performance Lab block, which replaces the old three
 * engineering cards.
 *
 * It is a set of links and nothing else. The lab itself is a separate
 * open-source application with its own deploy: this page neither embeds it in
 * an iframe nor imports its bundle nor mirrors its controls, so a visitor who
 * wants to compare Baseline and Optimized goes to the real demo, where the
 * real switches are. That keeps the portfolio's own weight unchanged and means
 * an outage over there cannot break anything here.
 *
 * Both links leave the site, so both carry `rel="noopener noreferrer"` and an
 * accessible new-tab notice; neither is instrumented, because opening a demo is
 * not a contact.
 */
export function PerformanceLab({ content }: PerformanceLabProps) {
  return (
    <section
      className={styles.lab}
      aria-labelledby="lab-heading"
      data-section="performance-lab"
    >
      <div className={styles.intro}>
        <p className={styles.index} aria-hidden="true">
          02 /
        </p>
        <p className={styles.eyebrow}>{content.eyebrow}</p>
        <h2 className={styles.name} id="lab-heading">
          {content.name}
        </h2>
        <p className={styles.thesis}>{content.thesis}</p>
      </div>

      <div className={styles.detail}>
        <p className={styles.description}>{content.description}</p>
        <p className={styles.note}>{content.note}</p>
        <div className={styles.actions}>
          <a
            className={styles.primaryAction}
            href={content.demoHref}
            target="_blank"
            rel="noopener noreferrer"
          >
            {content.demoCta}
            <span aria-hidden="true">↗</span>
            <span
              className={styles.newTabHint}
            >{` (${content.newTabHint})`}</span>
          </a>
          <a
            className={styles.secondaryAction}
            href={content.sourceHref}
            target="_blank"
            rel="noopener noreferrer"
          >
            {content.sourceCta}
            <span aria-hidden="true">↗</span>
            <span
              className={styles.newTabHint}
            >{` (${content.newTabHint})`}</span>
          </a>
        </div>
      </div>
    </section>
  );
}
