import { useEffect, useRef, useState } from 'react';

interface ViewedOnceOptions {
  rootMargin?: string;
  threshold?: number;
}

function canObserveIntersections() {
  return (
    typeof window !== 'undefined' &&
    typeof window.IntersectionObserver === 'function'
  );
}

export function useViewedOnce<T extends Element>({
  rootMargin = '0px 0px -12%',
  threshold = 0.18,
}: ViewedOnceOptions = {}) {
  const ref = useRef<T>(null);
  const [observed, setObserved] = useState(false);
  const [viewed, setViewed] = useState(() => !canObserveIntersections());

  useEffect(() => {
    if (viewed) return;

    if (!ref.current || !canObserveIntersections()) return;

    // Setting `viewed` re-runs this effect, and its cleanup is what
    // disconnects; the callback does not need to do it a second time.
    const observer = new window.IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setObserved(true);
        setViewed(true);
      },
      { rootMargin, threshold },
    );
    observer.observe(ref.current);

    return () => observer.disconnect();
  }, [rootMargin, threshold, viewed]);

  return { observed, ref, viewed };
}
