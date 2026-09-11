import type { ProofPoint } from '../content';
import styles from './ProofRow.module.css';

interface ProofRowProps {
  points: readonly ProofPoint[];
  /** Extra class for placement/sizing at a specific call site (e.g. a compact, inline usage). */
  className?: string;
}

/**
 * A short list of labeled facts rendered as a definition list, with no
 * animated counters. Reused wherever the site needs a small, static trust
 * signal — the hero's three facts today, a project's own metrics later.
 */
export function ProofRow({ points, className }: ProofRowProps) {
  return (
    <dl
      className={
        className ? `${styles.proofRow} ${className}` : styles.proofRow
      }
    >
      {points.map((point) => (
        <div className={styles.item} key={`${point.value}-${point.label}`}>
          <dt className={styles.value}>{point.value}</dt>
          <dd className={styles.label}>{point.label}</dd>
        </div>
      ))}
    </dl>
  );
}
