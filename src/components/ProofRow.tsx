import type { ProofPoint } from '../content';
import styles from './ProofRow.module.css';

interface ProofRowProps {
  points: readonly ProofPoint[];
  className?: string;
}

/** Labeled facts as a definition list. Static: no animated counters. */
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
