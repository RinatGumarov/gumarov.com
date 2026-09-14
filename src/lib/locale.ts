import type { Locale } from '../content';

export const preferredLocaleStorageKey = 'preferred-locale';

/**
 * Remembers an explicit language choice. It is read back by the inline
 * bootstrap in `index.html`, which runs on `/` before any bundle loads.
 */
export function setPreferredLocale(locale: Locale): void {
  try {
    window.localStorage.setItem(preferredLocaleStorageKey, locale);
  } catch {
    // Blocked or full storage: the choice is simply not remembered.
  }
}
