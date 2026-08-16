import { useEffect } from 'react';

/**
 * Keeps the address bar pointing at the section actually in view.
 *
 * A clicked nav anchor otherwise stayed in the URL forever, so reloading or
 * switching language jumped the visitor back to a section they had long
 * scrolled past. The hash is a convenience: when the browser lacks either
 * IntersectionObserver or `history.replaceState`, nothing happens and every
 * anchor keeps working as a plain link.
 */
export function useSectionHash(sectionIds: readonly string[]): void {
  const key = sectionIds.join(',');

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.IntersectionObserver !== 'function' ||
      typeof window.history?.replaceState !== 'function'
    ) {
      return;
    }

    const elements = key
      .split(',')
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);
    if (elements.length === 0) return;

    const ratios = new Map<string, number>();
    /*
     * A visitor who arrives on `/en/#contact` must keep that anchor. The
     * browser scrolls to it asynchronously, so for a moment no section is in
     * view; clearing the hash then would drop the anchor before the page had
     * settled, and the language switch would carry the visitor to the top.
     * Leave an arriving hash alone until a different section takes over.
     */
    let arrivedHash = window.location.hash;

    const applyHash = () => {
      let activeId: string | null = null;
      let bestRatio = 0;
      for (const [id, ratio] of ratios) {
        if (ratio > bestRatio) {
          bestRatio = ratio;
          activeId = id;
        }
      }

      const nextHash = activeId ? `#${activeId}` : '';
      if (arrivedHash) {
        if (!activeId || nextHash === arrivedHash) return;
        arrivedHash = '';
      }
      if (nextHash === window.location.hash) return;

      try {
        // replaceState, never pushState: scrolling must not fill the history.
        window.history.replaceState(
          window.history.state,
          '',
          `${window.location.pathname}${window.location.search}${nextHash}`,
        );
      } catch {
        // Never let an address-bar nicety interrupt the visitor's journey.
      }
    };

    const observer = new window.IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          ratios.set(
            entry.target.id,
            entry.isIntersecting ? entry.intersectionRatio : 0,
          );
        }
        applyHash();
      },
      {
        threshold: [0, 0.2, 0.4, 0.6, 0.8, 1],
        // Only count a section once it occupies the middle of the viewport, so
        // the hero leaves the hash empty and a reload lands back at the top.
        rootMargin: '-25% 0px -35%',
      },
    );

    for (const element of elements) observer.observe(element);
    return () => observer.disconnect();
  }, [key]);
}
