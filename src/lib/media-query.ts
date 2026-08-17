/**
 * `matchMedia` fails in two different ways: it is absent in some server and
 * test environments, and it throws on a query the browser cannot parse. Both
 * must degrade to "we do not know", never to a crash, because every caller
 * here is deciding whether to add an enhancement.
 */
export function getMediaQuery(query: string): MediaQueryList | null {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return null;
  }

  try {
    return window.matchMedia(query);
  } catch {
    return null;
  }
}

/** Evaluate a query, falling back when it cannot be evaluated at all. */
export function matchesMedia(query: string, fallback: boolean): boolean {
  return getMediaQuery(query)?.matches ?? fallback;
}
