import { hydrateRoot } from 'react-dom/client';
import { App, type Locale } from './App';
import { scheduleLandingViewed } from './lib/analytics';
import { scheduleBrandFonts } from './lib/brand-fonts';
import { scheduleMotion } from './motion/boot';
import './styles/global.css';

scheduleBrandFonts();
scheduleMotion();

const rootElement = document.getElementById('root');

function getDocumentLocale(): Locale {
  return document.documentElement.lang.toLowerCase().startsWith('ru')
    ? 'ru'
    : 'en';
}

if (rootElement?.hasChildNodes()) {
  const locale = getDocumentLocale();
  scheduleLandingViewed(locale);
  const serverMarkup = rootElement.innerHTML;
  let hydrationRoot: ReturnType<typeof hydrateRoot> | undefined;
  let restorationScheduled = false;
  let serverMarkupRestored = false;
  const restoreServerMarkup = (error: unknown) => {
    if (import.meta.env.DEV) {
      console.error('Unable to hydrate the landing page.', error);
    }

    if (restorationScheduled || serverMarkupRestored) return;
    restorationScheduled = true;

    queueMicrotask(() => {
      restorationScheduled = false;
      if (serverMarkupRestored) return;

      try {
        hydrationRoot?.unmount();
      } catch {
        // React may still be unwinding; restoring the static page remains safe.
      }

      rootElement.innerHTML = serverMarkup;
      serverMarkupRestored = true;
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
