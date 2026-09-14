import type { Locale } from '../content';
import { trackAnalyticsEvent } from '../lib/analytics';
import { setPreferredLocale } from '../lib/locale';

interface LocaleLinksProps {
  locale: Locale;
  className?: string;
}

/** The language switch, rendered in both the header and the footer. */
export function LocaleLinks({ locale, className }: LocaleLinksProps) {
  const label = locale === 'ru' ? 'Выбор языка' : 'Language selection';

  const activate =
    (next: Locale) => (event: React.MouseEvent<HTMLAnchorElement>) => {
      if (next !== locale) {
        trackAnalyticsEvent({
          name: 'language_changed',
          properties: { from: locale, to: next },
        });
      }
      setPreferredLocale(next);

      // Carry the section being read across the switch, so the other language
      // opens where the visitor left off rather than at the top.
      if (window.location.hash) {
        event.currentTarget.setAttribute(
          'href',
          `/${next}/${window.location.hash}`,
        );
      }
    };

  return (
    <nav className={className} aria-label={label}>
      <a
        href="/en/"
        hrefLang="en"
        lang="en"
        aria-current={locale === 'en' ? 'page' : undefined}
        onClick={activate('en')}
      >
        English
      </a>
      <span aria-hidden="true">/</span>
      <a
        href="/ru/"
        hrefLang="ru"
        lang="ru"
        aria-current={locale === 'ru' ? 'page' : undefined}
        onClick={activate('ru')}
      >
        Русский
      </a>
    </nav>
  );
}
