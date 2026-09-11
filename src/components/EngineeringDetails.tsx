import type { LandingContent } from '../content';
import styles from './EngineeringDetails.module.css';

interface EngineeringDetailsProps {
  content: LandingContent['engineering'];
}

export function EngineeringDetails({ content }: EngineeringDetailsProps) {
  return (
    <section
      className={styles.engineering}
      aria-labelledby="engineering-heading"
    >
      <div className={styles.header}>
        <p aria-hidden="true">02 /</p>
        <h2 id="engineering-heading">{content.heading}</h2>
      </div>
      <ol className={styles.list}>
        {content.items.map((item) => (
          <li key={item.title}>
            <h3>{item.title}</h3>
            <p>{item.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
