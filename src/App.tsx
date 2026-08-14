export type Locale = 'en' | 'ru';

export function App({ locale }: { locale: Locale }) {
  return <main data-locale={locale} />;
}
