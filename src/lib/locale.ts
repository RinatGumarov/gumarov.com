import type { Locale } from '../content';

export const preferredLocaleStorageKey = 'preferred-locale';

export interface LocaleResolutionInput {
  pathname: unknown;
  stored: unknown;
  languages: unknown;
}

export interface LocaleStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function resolveLocale(input: LocaleResolutionInput): Locale {
  try {
    if (hasLocalePath(input.pathname, 'ru')) {
      return 'ru';
    }

    if (hasLocalePath(input.pathname, 'en')) {
      return 'en';
    }

    if (isLocale(input.stored)) {
      return input.stored;
    }

    if (hasRussianBrowserLanguage(input.languages)) {
      return 'ru';
    }
  } catch {
    return 'en';
  }

  return 'en';
}

export function readPreferredLocale(
  storage?: LocaleStorage | null,
): Locale | null {
  try {
    const preferredLocale = resolveStorage(storage)?.getItem(
      preferredLocaleStorageKey,
    );

    return isLocale(preferredLocale) ? preferredLocale : null;
  } catch {
    return null;
  }
}

export function setPreferredLocale(
  locale: Locale,
  storage?: LocaleStorage | null,
): void {
  try {
    resolveStorage(storage)?.setItem(preferredLocaleStorageKey, locale);
  } catch {
    // Locale persistence is optional.
  }
}

function hasLocalePath(pathname: unknown, locale: Locale): boolean {
  return (
    typeof pathname === 'string' &&
    (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`))
  );
}

function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'ru';
}

function hasRussianBrowserLanguage(languages: unknown): boolean {
  return (
    Array.isArray(languages) &&
    languages.some(
      (language) =>
        typeof language === 'string' && language.toLowerCase().startsWith('ru'),
    )
  );
}

function resolveStorage(
  storage: LocaleStorage | null | undefined,
): LocaleStorage | null {
  if (storage !== undefined) {
    return storage;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
}
