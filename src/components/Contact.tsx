import type { Contact as ContactContent, Locale } from '../content';
import { trackAnalyticsEvent, type ContactChannel } from '../lib/analytics';
import { revealIndex } from '../lib/motion';
import { useViewedOnce } from '../lib/useViewedOnce';
import styles from './Contact.module.css';

interface ContactProps {
  content: ContactContent;
  locale: Locale;
}

export function Contact({ content, locale }: ContactProps) {
  const { observed, ref, scoped } = useViewedOnce<HTMLElement>();
  const captureContact = (channel: ContactChannel) => () => {
    trackAnalyticsEvent({
      name: 'contact_clicked',
      properties: { channel, section: 'contact', locale },
    });
  };

  return (
    <section
      ref={ref}
      className={styles.contact}
      id="contact"
      aria-labelledby="contact-heading"
      data-motion-scope={scoped ? 'contact' : undefined}
      data-motion-viewed={observed ? 'true' : undefined}
    >
      {/*
       * The invitation arrives as one block — its label, heading and sentence
       * are one thought — and the two channels follow it a step later.
       */}
      <div
        className={styles.headingBlock}
        data-motion-reveal="copy"
        style={revealIndex(0)}
      >
        <p className={styles.index} aria-hidden="true">
          {`04 / ${content.indexLabel}`}
        </p>
        <h2 id="contact-heading">{content.heading}</h2>
        <p className={styles.invitation}>{content.body}</p>
      </div>

      <address
        className={styles.channels}
        data-motion-reveal="copy"
        style={revealIndex(1)}
      >
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
