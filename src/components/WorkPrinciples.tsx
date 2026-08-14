interface WorkPrinciplesProps {
  content: {
    heading: string;
    items: readonly string[];
  };
}

export function WorkPrinciples({ content }: WorkPrinciplesProps) {
  return (
    <section
      className={styles.principles}
      id="about"
      aria-labelledby="principles-heading"
    >
      <div className={styles.header}>
        <p aria-hidden="true">02 /</p>
        <h2 id="principles-heading">{content.heading}</h2>
      </div>
      <ol className={styles.list}>
        {content.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
    </section>
  );
}
import styles from './WorkPrinciples.module.css';
