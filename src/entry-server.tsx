import { renderToString } from 'react-dom/server';
import { App, type Locale } from './App';
import { getContent } from './content';

export function render(locale: Locale): string {
  return renderToString(<App locale={locale} />);
}

export function getPageMeta(locale: Locale) {
  return getContent(locale).meta;
}
