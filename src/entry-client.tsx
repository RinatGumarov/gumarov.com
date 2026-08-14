import { hydrateRoot } from 'react-dom/client';
import { App, type Locale } from './App';

const rootElement = document.getElementById('root');

function getDocumentLocale(): Locale {
  return document.documentElement.lang.toLowerCase().startsWith('ru')
    ? 'ru'
    : 'en';
}

if (rootElement?.hasChildNodes()) {
  const serverMarkup = rootElement.innerHTML;
  const restoreServerMarkup = (error: unknown) => {
    rootElement.innerHTML = serverMarkup;

    if (import.meta.env.DEV) {
      console.error('Unable to hydrate the landing page.', error);
    }
  };

  try {
    hydrateRoot(rootElement, <App locale={getDocumentLocale()} />, {
      onUncaughtError: restoreServerMarkup,
      onRecoverableError(error) {
        if (import.meta.env.DEV) {
          console.error('The landing page recovered during hydration.', error);
        }
      },
    });
  } catch (error) {
    restoreServerMarkup(error);
  }
}
