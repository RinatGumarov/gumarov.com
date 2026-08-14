import type { Contact as ContactContent } from '../content';
import styles from './Contact.module.css';

interface ContactProps {
  content: ContactContent;
}

export function Contact(_props: ContactProps) {
  const { content } = _props;

  return (
    <section
      className={styles.contact}
      id="contact"
      aria-labelledby="contact-heading"
    >
      <div className={styles.headingBlock}>
        <p className={styles.index} aria-hidden="true">
          04 / Contact
        </p>
        <h2 id="contact-heading">{content.heading}</h2>
        <p className={styles.invitation}>{content.body}</p>
      </div>

      <address className={styles.channels}>
        <a
          href={content.telegramHref}
          aria-label={`${content.telegramLabel}: ${content.telegramHandle}`}
        >
          <span>{content.telegramLabel}</span>
          <strong>{content.telegramHandle}</strong>
          <span className={styles.arrow} aria-hidden="true">
            ↗
          </span>
        </a>
        <a
          href={content.emailHref}
          aria-label={`${content.emailLabel}: ${content.emailAddress}`}
        >
          <span>{content.emailLabel}</span>
          <strong>{content.emailAddress}</strong>
          <span className={styles.arrow} aria-hidden="true">
            ↗
          </span>
        </a>
      </address>
    </section>
  );
}
