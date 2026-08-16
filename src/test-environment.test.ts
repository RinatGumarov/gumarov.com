import { describe, expect, it } from 'vitest';

// Newer Node versions define their own global localStorage, which Vitest leaves
// in place instead of jsdom's — see the exec argv note in vite.config.ts. This
// fails first and by name when that happens, rather than leaving a component
// test to report a bare `localStorage.clear is not a function`.
describe('test environment', () => {
  it('hands tests the jsdom Storage rather than a Node global', () => {
    expect(window.localStorage).toBeInstanceOf(Storage);
    expect(window.sessionStorage).toBeInstanceOf(Storage);
  });

  it('round-trips values through window.localStorage', () => {
    window.localStorage.setItem('preferred-locale', 'ru');

    expect(window.localStorage.getItem('preferred-locale')).toBe('ru');

    window.localStorage.clear();

    expect(window.localStorage.getItem('preferred-locale')).toBeNull();
  });
});
