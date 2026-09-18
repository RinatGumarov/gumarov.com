import type { LandingContent } from '../content';
import styles from './PerformanceLab.module.css';

interface PerformanceLabProps {
  content: LandingContent['performanceLab'];
}

/**
 * Links out to the Performance Lab, and nothing more: it is a separate
 * deployed application, so nothing here embeds it, bundles it or mirrors its
 * controls. The portfolio's weight is unchanged and an outage over there
 * cannot break anything here.
 */
export function PerformanceLab({ content }: PerformanceLabProps) {
  return (
    <section
      className={styles.lab}
      aria-labelledby="lab-heading"
      data-section="performance-lab"
    >
      <div className={styles.intro}>
        <div className={styles.kicker}>
          <p className={styles.index} aria-hidden="true">
            02 /
          </p>
          <h2 className={styles.name} id="lab-heading">
            {content.name}
          </h2>
        </div>
        <p className={styles.thesis}>{content.thesis}</p>
      </div>

      <div className={styles.detail}>
        <p className={styles.description}>{content.description}</p>
        <p className={styles.note}>{content.note}</p>
        <p className={styles.tags}>
          <span aria-hidden="true">//</span>
          {content.eyebrow}
        </p>
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
