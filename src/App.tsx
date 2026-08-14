import type { Locale } from './content';

export type { Locale } from './content';

export function App({ locale }: { locale: Locale }) {
  return <main data-locale={locale} />;
}
