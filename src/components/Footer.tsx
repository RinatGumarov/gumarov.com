import type { Contact, Locale } from '../content';
import { trackAnalyticsEvent, type ContactChannel } from '../lib/analytics';
import { LocaleLinks } from './LocaleLinks';
import styles from './Footer.module.css';

interface FooterProps {
  locale: Locale;
  contact: Contact;
  privacy: string;
}

export function Footer({ locale, contact, privacy }: FooterProps) {
  const year = new Date().getUTCFullYear();
  const captureContact = (channel: ContactChannel) => () => {
    trackAnalyticsEvent({
      name: 'contact_clicked',
      properties: { channel, section: 'footer', locale },
    });
  };

  return (
    <footer className={styles.footer}>
      <div className={styles.frame}>
        <div className={styles.identity}>
          <a href={`/${locale}/`}>Rinat Gumarov</a>
          <span>© {year}</span>
          <span>Senior Frontend Engineer</span>
        </div>

        <address className={styles.contact}>
          <a
            href={contact.telegramHref}
            aria-label={`${contact.telegramLabel}: ${contact.telegramHandle}`}
            onClick={captureContact('telegram')}
          >
            <span>{contact.telegramLabel}</span>
            <strong>{contact.telegramHandle}</strong>
          </a>
          <a
            href={contact.emailHref}
            aria-label={`${contact.emailLabel}: ${contact.emailAddress}`}
            onClick={captureContact('email')}
          >
            <span>{contact.emailLabel}</span>
            <strong>{contact.emailAddress}</strong>
          </a>
        </address>

        <LocaleLinks locale={locale} className={styles.locales} />

        <p className={styles.privacy}>{privacy}</p>
      </div>
    </footer>
  );
}
