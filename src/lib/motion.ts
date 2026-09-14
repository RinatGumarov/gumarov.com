import {
  useCallback,
  useEffect,
  useRef,
  useSyncExternalStore,
  type PointerEventHandler,
  type RefObject,
} from 'react';

const reducedMotionQuery = '(prefers-reduced-motion: reduce)';
const motionEnhancementQuery = '(prefers-reduced-motion: no-preference)';
const coarsePointerQuery = '(pointer: coarse)';
const maximumParallax = 4;

/**
 * A media query, or `null` when the environment cannot answer one — during a
 * server render, or in a browser without `matchMedia`. Every caller treats
 * `null` the same way: no query, no enhancement.
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

export function subscribeToMediaQuery(
  mediaQuery: MediaQueryList,
  onChange: () => void,
) {
  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }

  // Safari before 14 only has the deprecated listener API.
  mediaQuery.addListener(onChange);
  return () => mediaQuery.removeListener(onChange);
}

function subscribeToQuery(query: string) {
  return (onChange: () => void) => {
    const mediaQuery = getMediaQuery(query);
    return mediaQuery
      ? subscribeToMediaQuery(mediaQuery, onChange)
      : () => undefined;
  };
}

/*
 * The two gates are separate queries, not one negated: a browser that cannot
 * answer either should still assume reduced motion and offer no enhancement.
 */
const subscribeToReducedMotion = subscribeToQuery(reducedMotionQuery);
const subscribeToMotionEnhancements = subscribeToQuery(motionEnhancementQuery);

function getReducedMotionSnapshot() {
  return getMediaQuery(reducedMotionQuery)?.matches ?? true;
}

function getMotionEnhancementSnapshot() {
  return getMediaQuery(motionEnhancementQuery)?.matches === true;
}

export function useReducedMotion() {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    () => true,
  );
}

export function useMotionEnhancementGate() {
  const enabled = useSyncExternalStore(
    subscribeToMotionEnhancements,
    getMotionEnhancementSnapshot,
    () => false,
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    if (!enabled) {
      root.removeAttribute('data-motion-state');
      return;
    }

    root.setAttribute('data-motion-state', 'enabled');
    return () => root.removeAttribute('data-motion-state');
  }, [enabled]);

  return enabled;
}

function setParallax(element: HTMLElement | null, x: number, y: number) {
  if (!element) return;
  element.style.setProperty('--motion-parallax-x', `${x}px`);
  element.style.setProperty('--motion-parallax-y', `${y}px`);
}

function supportsPointerParallax(reducedMotion: boolean) {
  if (
    reducedMotion ||
    typeof window === 'undefined' ||
    typeof window.PointerEvent !== 'function' ||
    typeof document === 'undefined' ||
    document.visibilityState !== 'visible'
  ) {
    return false;
  }

  return getMediaQuery(coarsePointerQuery)?.matches === false;
}

export function usePointerParallax<T extends HTMLElement>(): {
  ref: RefObject<T | null>;
  onPointerMove: PointerEventHandler<T>;
  onPointerLeave: PointerEventHandler<T>;
} {
  const ref = useRef<T>(null);
  const reducedMotion = useReducedMotion();
  const reset = useCallback(() => setParallax(ref.current, 0, 0), []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') reset();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      reset();
    };
  }, [reset]);

  const onPointerMove = useCallback<PointerEventHandler<T>>(
    (event) => {
      const element = ref.current;
      if (!supportsPointerParallax(reducedMotion)) {
        reset();
        return;
      }

      const bounds = element?.getBoundingClientRect();
      if (!element || !bounds || bounds.width <= 0 || bounds.height <= 0) {
        reset();
        return;
      }

      const x = clamp(
        (((event.clientX - bounds.left) / bounds.width) * 2 - 1) *
          maximumParallax,
      );
      const y = clamp(
        (((event.clientY - bounds.top) / bounds.height) * 2 - 1) *
          maximumParallax,
      );
      setParallax(element, x, y);
    },
    [reducedMotion, reset],
  );

  return { ref, onPointerMove, onPointerLeave: reset };
}

function clamp(value: number) {
  return Math.max(-maximumParallax, Math.min(maximumParallax, value));
}
