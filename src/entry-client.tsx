import { hydrateRoot } from 'react-dom/client';
import { App, type Locale } from './App';
import { scheduleLandingViewed } from './lib/analytics';
import { scheduleBrandFonts } from './lib/brand-fonts';
import './styles/global.css';

scheduleBrandFonts();

const rootElement = document.getElementById('root');

if (rootElement?.hasChildNodes()) {
  const locale: Locale = document.documentElement.lang
    .toLowerCase()
    .startsWith('ru')
    ? 'ru'
    : 'en';
  scheduleLandingViewed(locale);

  const serverMarkup = rootElement.innerHTML;
  let hydrationRoot: ReturnType<typeof hydrateRoot> | undefined;
  let restored = false;

  /*
   * The page is complete before React runs, so a failed hydration should leave
   * the visitor with the served markup rather than whatever React managed to
   * write. Restoring happens in a microtask because React is still unwinding
   * when the error callback fires.
   */
  const restoreServerMarkup = (error: unknown) => {
    if (import.meta.env.DEV) {
      console.error('Unable to hydrate the landing page.', error);
    }
    if (restored) return;

    queueMicrotask(() => {
      if (restored) return;
      restored = true;

      try {
        hydrationRoot?.unmount();
      } catch {
        // React may still be unwinding; the static page is restored regardless.
      }

      rootElement.innerHTML = serverMarkup;
    });
  };

  try {
    hydrationRoot = hydrateRoot(rootElement, <App locale={locale} />, {
      onUncaughtError: restoreServerMarkup,
      onRecoverableError: restoreServerMarkup,
    });
  } catch (error) {
    restoreServerMarkup(error);
  }
}
