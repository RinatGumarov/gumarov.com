import { renderToString } from 'react-dom/server';
import { App, type Locale } from './App';

export { getContent } from './content';

export function render(locale: Locale): string {
  return renderToString(<App locale={locale} />);
}
