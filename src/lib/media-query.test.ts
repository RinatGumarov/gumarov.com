import { afterEach, describe, expect, it, vi } from 'vitest';
import { getMediaQuery, matchesMedia } from './media-query';

const originalMatchMedia = window.matchMedia;

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  vi.restoreAllMocks();
});

describe('getMediaQuery', () => {
  it('returns null when matchMedia is unavailable', () => {
    Reflect.deleteProperty(window, 'matchMedia');

    expect(getMediaQuery('(min-width: 40rem)')).toBeNull();
  });

  it('returns null when matchMedia throws on an unsupported query', () => {
    window.matchMedia = vi.fn(() => {
      throw new SyntaxError('unsupported');
    }) as unknown as typeof window.matchMedia;

    expect(getMediaQuery('(unsupported: yes)')).toBeNull();
  });

  it('returns the list when the query is supported', () => {
    const list = { matches: true } as MediaQueryList;
    window.matchMedia = vi.fn(
      () => list,
    ) as unknown as typeof window.matchMedia;

    expect(getMediaQuery('(min-width: 40rem)')).toBe(list);
  });
});

describe('matchesMedia', () => {
  it('reports the fallback when the query cannot be evaluated', () => {
    Reflect.deleteProperty(window, 'matchMedia');

    expect(matchesMedia('(pointer: fine)', true)).toBe(true);
    expect(matchesMedia('(pointer: fine)', false)).toBe(false);
  });

  it('reports the query result when it can be evaluated', () => {
    window.matchMedia = vi.fn(
      () => ({ matches: false }) as MediaQueryList,
    ) as unknown as typeof window.matchMedia;

    expect(matchesMedia('(pointer: fine)', true)).toBe(false);
  });
});
