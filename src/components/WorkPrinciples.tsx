import styles from './WorkPrinciples.module.css';

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
      data-scene="principles"
      aria-labelledby="principles-heading"
    >
      <div className={styles.header}>
        <p aria-hidden="true">02 /</p>
        <h2 id="principles-heading">{content.heading}</h2>
      </div>
      <ol className={styles.list}>
        {content.items.map((item, index) => (
          <li
            key={item}
            data-scene-line
            style={{ '--line-index': index } as React.CSSProperties}
          >
            {item}
          </li>
        ))}
      </ol>
    </section>
  );
}
