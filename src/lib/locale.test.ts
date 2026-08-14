import { describe, expect, it } from 'vitest';
import {
  readPreferredLocale,
  resolveLocale,
  setPreferredLocale,
} from './locale';

describe('resolveLocale', () => {
  it('uses a valid stored preference on the root path before browser languages', () => {
    expect(
      resolveLocale({ pathname: '/', stored: 'en', languages: ['ru-RU'] }),
    ).toBe('en');
  });

  it.each([
    ['/ru/', 'en', 'en', 'ru'],
    ['/en/', 'ru', 'ru', 'en'],
  ] as const)(
    'uses the locale path before other preferences',
    (pathname, stored, language, expected) => {
      expect(resolveLocale({ pathname, stored, languages: [language] })).toBe(
        expected,
      );
    },
  );

  it('selects Russian for a Russian browser language on the root path', () => {
    expect(
      resolveLocale({ pathname: '/', stored: null, languages: ['ru-RU'] }),
    ).toBe('ru');
  });

  it('falls back to English on an unsupported non-root path', () => {
    expect(
      resolveLocale({ pathname: '/work', stored: 'ru', languages: ['ru-RU'] }),
    ).toBe('en');
  });

  it('falls back to English for unsupported or malformed inputs', () => {
    expect(
      resolveLocale({ pathname: '/', stored: 'invalid', languages: ['de'] }),
    ).toBe('en');
    expect(
      resolveLocale({ pathname: null, stored: null, languages: null }),
    ).toBe('en');
  });

  it('uses only its input when browser storage access fails', () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');

    try {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get: () => {
          throw new Error('Storage is unavailable');
        },
      });

      expect(
        resolveLocale({ pathname: '/', stored: null, languages: ['ru'] }),
      ).toBe('ru');
    } finally {
      if (descriptor) {
        Object.defineProperty(window, 'localStorage', descriptor);
      }
    }
  });
});

describe('preferred locale storage', () => {
  it('reads only valid stored locale values', () => {
    const storage = {
      getItem: () => 'ru',
      setItem: () => undefined,
    };

    expect(readPreferredLocale(storage)).toBe('ru');
  });

  it('silently tolerates unavailable storage', () => {
    const unavailableStorage = {
      getItem: () => {
        throw new Error('Storage is unavailable');
      },
      setItem: () => {
        throw new Error('Storage is unavailable');
      },
    };

    expect(readPreferredLocale(unavailableStorage)).toBeNull();
    expect(() => setPreferredLocale('ru', unavailableStorage)).not.toThrow();
  });

  it('persists a valid explicit locale when storage works', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    setPreferredLocale('ru', storage);

    expect(readPreferredLocale(storage)).toBe('ru');
  });
});
