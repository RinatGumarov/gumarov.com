import {
  useCallback,
  useEffect,
  useRef,
  useSyncExternalStore,
  type PointerEventHandler,
  type RefObject,
} from 'react';

const reducedMotionQuery = '(prefers-reduced-motion: reduce)';
const coarsePointerQuery = '(pointer: coarse)';
const maximumParallax = 4;

function getMediaQuery(query: string): MediaQueryList | null {
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

function getReducedMotionSnapshot() {
  return getMediaQuery(reducedMotionQuery)?.matches ?? true;
}

function subscribeToReducedMotion(onChange: () => void) {
  const mediaQuery = getMediaQuery(reducedMotionQuery);
  if (!mediaQuery) return () => undefined;

  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }

  mediaQuery.addListener(onChange);
  return () => mediaQuery.removeListener(onChange);
}

export function useReducedMotion() {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    () => true,
  );
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
