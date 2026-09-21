import type { ReactNode } from 'react';
import type { ProofPoint } from '../content';
import { revealIndex } from '../lib/motion';
import { useViewedOnce } from '../lib/useViewedOnce';
import styles from './ProofRow.module.css';

interface ProofRowProps {
  points: readonly ProofPoint[];
  className?: string;
  /**
   * For the row that stands on its own under the hero: it watches itself and
   * brings its facts in one after another. A row nested inside a project scene
   * leaves this off — there the facts are part of the scene's copy block, which
   * is already revealed as one thing.
   */
  reveals?: boolean;
}

/** Labeled facts as a definition list. Static: no animated counters. */
export function ProofRow({
  points,
  className,
  reveals = false,
}: ProofRowProps) {
  const listClassName = className
    ? `${styles.proofRow} ${className}`
    : styles.proofRow;
  const facts = points.map((point, index) => (
    <div
      className={styles.item}
      key={`${point.value}-${point.label}`}
      data-motion-reveal={reveals ? 'copy' : undefined}
      style={reveals ? revealIndex(index) : undefined}
    >
      <dt className={styles.value}>{point.value}</dt>
      <dd className={styles.label}>{point.label}</dd>
    </div>
  ));

  return reveals ? (
    <ObservedProofRow className={listClassName}>{facts}</ObservedProofRow>
  ) : (
    <dl className={listClassName}>{facts}</dl>
  );
}

/** The same list, as a section that reveals itself the first time it is seen. */
function ObservedProofRow({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const { observed, ref, scoped } = useViewedOnce<HTMLDListElement>();

  return (
    <dl
      ref={ref}
      className={className}
      data-motion-scope={scoped ? 'proof' : undefined}
      data-motion-viewed={observed ? 'true' : undefined}
    >
      {children}
    </dl>
  );
}
