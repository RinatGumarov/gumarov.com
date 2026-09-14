import type { LandingContent, Locale } from '../content';
import { LocaleLinks } from './LocaleLinks';
import styles from './Navigation.module.css';

interface NavigationProps {
  locale: Locale;
  labels: LandingContent['nav'];
}

export function Navigation({ locale, labels }: NavigationProps) {
  const skipLabel =
    locale === 'ru' ? 'Перейти к содержанию' : 'Skip to content';
  const navigationLabel =
    locale === 'ru' ? 'Основная навигация' : 'Primary navigation';

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

          <LocaleLinks locale={locale} className={styles.locales} />
        </div>
      </header>
    </>
  );
}
