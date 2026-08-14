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

    let active = true;
    if (!ref.current || !canObserveIntersections()) return;

    let disconnected = false;
    const disconnect = () => {
      if (disconnected) return;
      disconnected = true;
      observer.disconnect();
    };
    const observer = new window.IntersectionObserver(
      (entries) => {
        if (!active || !entries.some((entry) => entry.isIntersecting)) return;
        active = false;
        setObserved(true);
        setViewed(true);
        disconnect();
      },
      { rootMargin, threshold },
    );
    observer.observe(ref.current);

    return () => {
      active = false;
      disconnect();
    };
  }, [rootMargin, threshold, viewed]);

  return { observed, ref, viewed };
}
