import type { Contact, Locale } from '../content';
import { trackAnalyticsEvent, type ContactChannel } from '../lib/analytics';
import { setPreferredLocale } from '../lib/locale';
import styles from './Footer.module.css';

interface FooterProps {
  locale: Locale;
  contact: Contact;
  privacy: string;
}

export function Footer(_props: FooterProps) {
  const { locale, contact, privacy } = _props;
  const year = new Date().getUTCFullYear();
  const localeLabel = locale === 'ru' ? 'Выбор языка' : 'Language selection';

  const activateLocale =
    (nextLocale: Locale) => (event: React.MouseEvent<HTMLAnchorElement>) => {
      if (nextLocale !== locale) {
        trackAnalyticsEvent({
          name: 'language_changed',
          properties: { from: locale, to: nextLocale },
        });
      }
      setPreferredLocale(nextLocale);

      if (window.location.hash) {
        event.currentTarget.setAttribute(
          'href',
          `/${nextLocale}/${window.location.hash}`,
        );
      }
    };
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

        <nav className={styles.locales} aria-label={localeLabel}>
          <a
            href="/en/"
            hrefLang="en"
            lang="en"
            aria-current={locale === 'en' ? 'page' : undefined}
            onClick={activateLocale('en')}
          >
            English
          </a>
          <span aria-hidden="true">/</span>
          <a
            href="/ru/"
            hrefLang="ru"
            lang="ru"
            aria-current={locale === 'ru' ? 'page' : undefined}
            onClick={activateLocale('ru')}
          >
            Русский
          </a>
        </nav>

        <p className={styles.privacy}>{privacy}</p>
      </div>
    </footer>
  );
}
