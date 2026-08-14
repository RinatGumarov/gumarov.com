import type { LandingContent, Locale } from '../content';
import { trackAnalyticsEvent } from '../lib/analytics';
import { setPreferredLocale } from '../lib/locale';
import styles from './Navigation.module.css';

interface NavigationProps {
  locale: Locale;
  labels: LandingContent['nav'];
}

export function Navigation(_props: NavigationProps) {
  const { locale, labels } = _props;
  const skipLabel =
    locale === 'ru' ? 'Перейти к содержанию' : 'Skip to content';
  const navigationLabel =
    locale === 'ru' ? 'Основная навигация' : 'Primary navigation';
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

  return (
    <>
      <a className={styles.skipLink} href="#main-content">
        {skipLabel}
      </a>
      <header className={styles.header}>
        <div className={styles.frame}>
          <a
            className={styles.identity}
            href={`/${locale}/`}
            aria-label="Rinat Gumarov — home"
          >
            <span className={styles.monogram} aria-hidden="true">
              RG
            </span>
            <span>Rinat Gumarov</span>
          </a>

          <nav className={styles.primary} aria-label={navigationLabel}>
            <a href="#work">{labels.work}</a>
            <a href="#about">{labels.about}</a>
            <a href="#contact">{labels.contact}</a>
          </nav>

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
        </div>
      </header>
    </>
  );
}
