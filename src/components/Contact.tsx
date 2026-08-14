import type { Contact as ContactContent, Locale } from '../content';
import { trackAnalyticsEvent, type ContactChannel } from '../lib/analytics';
import styles from './Contact.module.css';

interface ContactProps {
  content: ContactContent;
  locale: Locale;
}

export function Contact(_props: ContactProps) {
  const { content, locale } = _props;
  const captureContact = (channel: ContactChannel) => () => {
    trackAnalyticsEvent({
      name: 'contact_clicked',
      properties: { channel, section: 'contact', locale },
    });
  };

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
          onClick={captureContact('telegram')}
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
          onClick={captureContact('email')}
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
