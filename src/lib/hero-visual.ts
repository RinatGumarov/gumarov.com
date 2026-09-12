import { useEffect, useState, type RefObject } from 'react';
import type { RibbonRenderer } from './hero-ribbon-gl';
import { getMediaQuery } from './motion';

const hoverQuery = '(hover: hover) and (pointer: fine)';
const reducedMotionQuery = '(prefers-reduced-motion: reduce)';

/**
 * The properties the CSS layer reads. They are written straight onto the host
 * element, never held in React state: a state update per pointer move would
 * re-render the hero on every frame, and the heading, the paragraph and both
 * calls to action are supposed to be motionless.
 */
const pointerProperties = [
  '--hero-tilt-x',
  '--hero-tilt-y',
  '--hero-shift-x',
  '--hero-shift-y',
  '--hero-light-x',
  '--hero-light-y',
] as const;

/*
 * The whole pointer budget, in one place. Rotation stays inside ±4° and the
 * shift inside ±8px; the damping is a CSS transition rather than a JavaScript
 * loop, so the SVG layer costs no frames at all.
 */
const maximumTiltDegrees = 4;
const maximumShiftPx = 8;

export type HeroVisualState = 'static' | 'enhanced';

function subscribeToMediaQuery(query: MediaQueryList, onChange: () => void) {
  if (typeof query.addEventListener === 'function') {
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }
  if (typeof query.addListener === 'function') {
    query.addListener(onChange);
    return () => query.removeListener(onChange);
  }
  return () => undefined;
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

function supportsWebGl() {
  if (typeof document === 'undefined') return false;
  try {
    const probe = document.createElement('canvas');
    const context =
      probe.getContext('webgl') ?? probe.getContext('experimental-webgl');
    if (!context) return false;
    (context as WebGLRenderingContext)
      .getExtension('WEBGL_lose_context')
      ?.loseContext();
    return true;
  } catch {
    return false;
  }
}

interface HeroVisualOptions {
  /** The element the pointer is measured against and the properties land on. */
  hostRef: RefObject<HTMLElement | null>;
  /** The canvas the enhancement draws into; may never be used. */
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /**
   * The boolean from the application's single `useMotionEnhancementGate()`.
   * This hook never mutates the document root, so there is exactly one
   * root-mutating gate on the page.
   */
  enabled: boolean;
}

/**
 * Drives the hero ribbon's optional behaviour and reports which layer is live.
 *
 * Three things are deliberately separate here. The *composition* is the SVG and
 * needs nothing from this hook. The *pointer response* is six custom properties
 * and a CSS transition, which run wherever a fine pointer and motion are
 * allowed. The *refraction* is WebGL, imported lazily and only once everything
 * else has passed, and it is the only part that can fail — when it does, or
 * when the context is later lost, the state falls back to `static` and the SVG
 * is simply still there.
 *
 * Everything that touches `window`, `document` or `CSS` happens inside the
 * effect, so the server render and the first client render are identical.
 */
export function useHeroVisual({
  hostRef,
  canvasRef,
  enabled,
}: HeroVisualOptions): HeroVisualState {
  const [state, setState] = useState<HeroVisualState>('static');

  useEffect(() => {
    if (!enabled) return;

    const host = hostRef.current;
    if (!host) return;

    const hoverMedia = getMediaQuery(hoverQuery);
    const reducedMedia = getMediaQuery(reducedMotionQuery);
    if (!hoverMedia || !reducedMedia) return;
    if (typeof window.IntersectionObserver !== 'function') return;

    let allowed = hoverMedia.matches && !reducedMedia.matches;
    let onScreen = false;
    let rect: DOMRect | null = null;
    let renderer: RibbonRenderer | null = null;
    let cancelled = false;
    let requested = false;

    const writeRest = () => {
      host.style.setProperty('--hero-tilt-x', '0deg');
      host.style.setProperty('--hero-tilt-y', '0deg');
      host.style.setProperty('--hero-shift-x', '0px');
      host.style.setProperty('--hero-shift-y', '0px');
      host.style.setProperty('--hero-light-x', '50%');
      host.style.setProperty('--hero-light-y', '42%');
      renderer?.setPointer(0, 0);
    };

    const measure = () => {
      rect = host.getBoundingClientRect();
    };

    /*
     * The cached rect holds a viewport position, so anything that moves the
     * hero invalidates it. Scroll and resize drop it and park the visual at
     * rest; the next pointer move re-measures, which for a mouse is the next
     * few milliseconds.
     */
    const invalidate = () => {
      rect = null;
    };

    const handlePointer = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
      if (!allowed || !onScreen || document.visibilityState === 'hidden') {
        writeRest();
        return;
      }

      if (!rect) measure();
      if (!rect || rect.width <= 0 || rect.height <= 0) return;

      // -1..1 across the host, clamped: a pointer entering at speed can report
      // a position a hair outside the box.
      const x = Math.max(
        -1,
        Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1),
      );
      const y = Math.max(
        -1,
        Math.min(1, ((event.clientY - rect.top) / rect.height) * 2 - 1),
      );

      host.style.setProperty(
        '--hero-tilt-x',
        `${round(-y * maximumTiltDegrees)}deg`,
      );
      host.style.setProperty(
        '--hero-tilt-y',
        `${round(x * maximumTiltDegrees)}deg`,
      );
      host.style.setProperty(
        '--hero-shift-x',
        `${round(x * maximumShiftPx)}px`,
      );
      host.style.setProperty(
        '--hero-shift-y',
        `${round(y * maximumShiftPx * 0.5)}px`,
      );
      host.style.setProperty('--hero-light-x', `${round(50 + x * 26)}%`);
      host.style.setProperty('--hero-light-y', `${round(42 + y * 22)}%`);

      renderer?.setPointer(x, y);
      requestEnhancement();
    };

    const handleRelease = () => writeRest();

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') writeRest();
      else renderer?.wake();
    };

    const handleResize = () => {
      invalidate();
      writeRest();
      renderer?.resize();
    };

    const handleMediaChange = () => {
      allowed = hoverMedia.matches && !reducedMedia.matches;
      if (!allowed) {
        writeRest();
        renderer?.dispose();
        renderer = null;
        setState('static');
      }
    };

    /*
     * The enhancement is requested once, on the first real interaction inside a
     * visible hero — not at mount. A visitor who reads the heading and scrolls
     * past never downloads or compiles it.
     */
    function requestEnhancement() {
      if (requested || cancelled || !allowed || !onScreen) return;
      const canvas = canvasRef.current;
      if (!canvas || !supportsWebGl()) return;
      requested = true;

      void import('./hero-ribbon-gl')
        .then(({ createRibbonRenderer }) => {
          if (cancelled || !allowed) return;
          const live = canvasRef.current;
          if (!live) return;

          renderer = createRibbonRenderer(
            live,
            () => {
              if (!cancelled) setState('enhanced');
            },
            () => {
              // Context loss is not an error path with a different outcome:
              // the SVG underneath is the composition, so drop back to it.
              renderer = null;
              if (!cancelled) setState('static');
            },
          );

          if (!renderer) return;
          renderer.resize();
        })
        .catch(() => {
          // A chunk that fails to load leaves the static composition alone.
        });
    }

    const intersectionObserver = new window.IntersectionObserver((entries) => {
      onScreen = entries.some((entry) => entry.isIntersecting);
      if (!onScreen) writeRest();
    });
    intersectionObserver.observe(host);

    const unsubscribeHover = subscribeToMediaQuery(
      hoverMedia,
      handleMediaChange,
    );
    const unsubscribeReduced = subscribeToMediaQuery(
      reducedMedia,
      handleMediaChange,
    );

    host.addEventListener('pointerenter', handlePointer);
    host.addEventListener('pointermove', handlePointer);
    host.addEventListener('pointerleave', handleRelease);
    host.addEventListener('pointercancel', handleRelease);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('scroll', invalidate, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });

    return () => {
      cancelled = true;
      host.removeEventListener('pointerenter', handlePointer);
      host.removeEventListener('pointermove', handlePointer);
      host.removeEventListener('pointerleave', handleRelease);
      host.removeEventListener('pointercancel', handleRelease);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('scroll', invalidate);
      window.removeEventListener('resize', handleResize);
      unsubscribeHover();
      unsubscribeReduced();
      intersectionObserver.disconnect();
      renderer?.dispose();
      renderer = null;
      for (const property of pointerProperties) {
        host.style.removeProperty(property);
      }
    };
  }, [canvasRef, enabled, hostRef]);

  return state;
}
