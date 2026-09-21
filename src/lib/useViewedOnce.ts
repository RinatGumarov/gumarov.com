import { useEffect, useRef, useState } from 'react';

interface ViewedOnceOptions {
  /**
   * For a section that can be taller than a phone screen. Such a section can
   * never show the ordinary fraction of itself at once, so it asks for a
   * smaller one — see the thresholds below.
   */
  tall?: boolean;
}

/*
 * The bottom eighth of the viewport does not count as seen: a block that is
 * only just clearing the edge of the screen is still arriving, and starting its
 * reveal there means it finishes while it is still at the very bottom.
 */
const rootMargin = '0px 0px -12%';
/*
 * How much of a section has to be inside that window. A fifth of an ordinary
 * section is a comfortable amount of screen; a fifth of a section twice the
 * height of the screen is not, and waiting for it would leave the top of that
 * section sitting blank well after it arrived. A twelfth of the tall ones works
 * out to about the same amount of screen.
 */
const ordinaryThreshold = 0.18;
const tallThreshold = 0.08;

function canObserveIntersections() {
  return (
    typeof window !== 'undefined' &&
    typeof window.IntersectionObserver === 'function'
  );
}

/**
 * Marks a section the first time it is scrolled into view, and never again.
 *
 * `scoped` is the section's side of the bargain: the stylesheet holds a scope's
 * blocks back until the scope says it has been viewed, so a browser that cannot
 * report intersections has to be able to say that there is no scope here at
 * all. It starts out `true` on the server and on the hydrating render — the
 * markup has to match — and the effect below is the only place it is withdrawn.
 */
export function useViewedOnce<T extends Element>({
  tall = false,
}: ViewedOnceOptions = {}) {
  const ref = useRef<T>(null);
  const [observed, setObserved] = useState(false);
  const [scoped, setScoped] = useState(true);

  useEffect(() => {
    if (!canObserveIntersections()) {
      setScoped(false);
      return;
    }

    if (observed || !ref.current) return;

    // Setting `observed` re-runs this effect, and its cleanup is what
    // disconnects; the callback does not need to do it a second time.
    const observer = new window.IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setObserved(true);
      },
      {
        rootMargin,
        threshold: tall ? tallThreshold : ordinaryThreshold,
      },
    );
    observer.observe(ref.current);

    return () => observer.disconnect();
  }, [observed, tall]);

  return { observed, ref, scoped };
}
