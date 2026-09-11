import { useEffect, type RefObject } from 'react';
import { getMediaQuery } from './motion';

/*
 * Every constant below comes from the effect's parameter table (plan §5).
 * Nothing here is tuned by feel: the damping is a time constant, not a
 * per-frame fraction, so the lens travels at the same speed on a 60 Hz and a
 * 120 Hz display.
 */
const dampingTimeConstantMs = 70;
const maximumFrameDeltaMs = 32;
const settleDistancePx = 0.25;
const revealOpacity = 0.38;
const revealDurationMs = 160;
const hideDurationMs = 180;
const wideLensRadiusPx = 160;
const narrowLensRadiusPx = 130;
const narrowHeroWidthPx = 1000;

const hoverQuery = '(hover: hover) and (pointer: fine)';
const reducedMotionQuery = '(prefers-reduced-motion: reduce)';
const lensProperties = [
  '--lens-x',
  '--lens-y',
  '--lens-opacity',
  '--lens-fade',
  '--lens-radius',
] as const;

function supportsMask() {
  return (
    typeof CSS !== 'undefined' &&
    typeof CSS.supports === 'function' &&
    CSS.supports('mask-image', 'radial-gradient(black, transparent)')
  );
}

function subscribeToMediaQuery(
  mediaQuery: MediaQueryList,
  onChange: () => void,
) {
  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }

  if (typeof mediaQuery.addListener === 'function') {
    mediaQuery.addListener(onChange);
    return () => mediaQuery.removeListener(onChange);
  }

  return () => undefined;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * Drives the hero's engineering lens (plan §5).
 *
 * The pointer position never becomes React state — a state update per pointer
 * move would re-render the whole hero on every frame. Coordinates live in
 * closure variables and reach CSS as the custom properties `--lens-x`,
 * `--lens-y`, `--lens-opacity`, `--lens-fade` and `--lens-radius`, written on
 * the hero host element.
 *
 * `enabled` is the boolean from the application's single
 * `useMotionEnhancementGate()`; this hook never mutates the document root, so
 * there is exactly one root-mutating gate on the page.
 *
 * Everything that touches `window`, `document` or `CSS` happens inside the
 * effect, so the server render and the first client render are identical.
 */
export function useHeroLens(
  hostRef: RefObject<HTMLElement | null>,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return;

    const host = hostRef.current;
    if (!host) return;

    const hoverMedia = getMediaQuery(hoverQuery);
    const reducedMedia = getMediaQuery(reducedMotionQuery);
    if (!hoverMedia || !reducedMedia) return;
    if (
      typeof window.IntersectionObserver !== 'function' ||
      typeof window.ResizeObserver !== 'function' ||
      !supportsMask()
    ) {
      return;
    }

    let allowed = hoverMedia.matches && !reducedMedia.matches;
    let onScreen = true;
    let entered = false;
    let frame = 0;
    // The clock the damping runs against. `null` rather than 0, because a real
    // rAF timestamp can legitimately be small and this has to mean "the loop
    // is idle", not "the last frame was at time 0". It is seeded from
    // `performance.now()` when the loop starts, which shares rAF's time
    // origin, so the first frame of a burst measures a real elapsed time
    // instead of guessing one.
    let lastTimestamp: number | null = null;
    let rect: DOMRect | null = null;
    let currentX = 0;
    let currentY = 0;
    let targetX = 0;
    let targetY = 0;

    const writePosition = () => {
      host.style.setProperty('--lens-x', `${round(currentX)}px`);
      host.style.setProperty('--lens-y', `${round(currentY)}px`);
    };

    const distanceToTarget = () =>
      Math.hypot(targetX - currentX, targetY - currentY);

    const cancelFrame = () => {
      if (!frame) return;
      window.cancelAnimationFrame(frame);
      frame = 0;
    };

    const frameStep = (timestamp: number) => {
      frame = 0;
      const delta = Math.max(
        0,
        Math.min(timestamp - (lastTimestamp ?? timestamp), maximumFrameDeltaMs),
      );
      lastTimestamp = timestamp;

      const alpha = 1 - Math.exp(-delta / dampingTimeConstantMs);
      currentX += (targetX - currentX) * alpha;
      currentY += (targetY - currentY) * alpha;

      if (distanceToTarget() < settleDistancePx) {
        // Land exactly on the target and stop. The remaining error is well
        // under a pixel, and settling exactly keeps the loop from restarting
        // on its own.
        currentX = targetX;
        currentY = targetY;
        lastTimestamp = null;
        writePosition();
        return;
      }

      writePosition();
      frame = window.requestAnimationFrame(frameStep);
    };

    // At most one frame is ever in flight for this hero.
    const scheduleFrame = () => {
      if (frame || distanceToTarget() < settleDistancePx) return;
      if (lastTimestamp === null) lastTimestamp = performance.now();
      frame = window.requestAnimationFrame(frameStep);
    };

    const reveal = () => {
      host.style.setProperty('--lens-fade', `${revealDurationMs}ms`);
      host.style.setProperty('--lens-opacity', String(revealOpacity));
    };

    const hide = () => {
      cancelFrame();
      entered = false;
      lastTimestamp = null;
      host.style.setProperty('--lens-fade', `${hideDurationMs}ms`);
      host.style.setProperty('--lens-opacity', '0');
    };

    // The rect is read on entry and after an invalidation, never inside the
    // frame loop: a layout read per frame would force a synchronous layout on
    // every pointer move.
    const measure = () => {
      rect = host.getBoundingClientRect();
      host.style.setProperty(
        '--lens-radius',
        `${rect.width < narrowHeroWidthPx ? narrowLensRadiusPx : wideLensRadiusPx}px`,
      );
    };

    // Scroll and resize move the hero under the pointer, so the lens would be
    // drawn against a rect that no longer describes it: drop the measurement
    // and take the lens down until the next pointer event re-establishes both.
    const invalidate = () => {
      rect = null;
      if (entered || frame) hide();
    };

    /*
     * A softer invalidation for reflows the visitor did not cause — a lazy
     * image settling, the hero's own heading reflowing when Onest swaps in
     * (plan §7). These move the hero, so the measurement has to go, but they
     * are not the visitor's doing and taking the lens out from under their
     * cursor for them is a visible flinch. The next pointer move re-measures,
     * which for a mouse is the next few milliseconds.
     */
    const dropRect = () => {
      rect = null;
    };

    const handlePointer = (event: PointerEvent) => {
      // Touch never activates the lens, and the hook subscribes to no touch
      // events of its own.
      if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;

      if (!allowed || !onScreen || document.visibilityState === 'hidden') {
        if (entered || frame) hide();
        return;
      }

      if (!rect) measure();
      if (!rect || rect.width <= 0 || rect.height <= 0) return;

      targetX = event.clientX - rect.left;
      targetY = event.clientY - rect.top;

      if (!entered) {
        // First entry lands on the pointer immediately: the lens never flies
        // in from a corner or from wherever it was last hidden.
        entered = true;
        currentX = targetX;
        currentY = targetY;
        lastTimestamp = null;
        writePosition();
        reveal();
        return;
      }

      scheduleFrame();
    };

    const handleRelease = () => {
      // A finger's own pointercancel must not write lens properties onto a
      // hero that never revealed one.
      if (!entered && !frame) return;
      hide();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') hide();
    };

    const handleMediaChange = () => {
      allowed = hoverMedia.matches && !reducedMedia.matches;
      if (!allowed) hide();
    };

    const intersectionObserver = new window.IntersectionObserver((entries) => {
      onScreen = entries.some((entry) => entry.isIntersecting);
      if (!onScreen) hide();
    });
    intersectionObserver.observe(host);

    /*
     * The hero's own box is not enough. The cached rect holds a viewport
     * position, so anything that *moves* the hero without resizing it and
     * without a scroll — the navigation above it reflowing when the deferred
     * brand stylesheet lands, a lazy image settling — leaves `rect.top` stale
     * and the lens tracking a position the hero no longer occupies. Observing
     * the document element catches those: its box changes whenever the page's
     * height does.
     *
     * Both targets take the soft path. A viewport resize is the one resize the
     * visitor performs, and the `resize` listener below already drops the lens
     * for it; everything else these observers see is the page settling around
     * a cursor that has not moved.
     */
    const resizeObserver = new window.ResizeObserver(dropRect);
    resizeObserver.observe(host);
    resizeObserver.observe(document.documentElement);

    /*
     * And the font swap specifically, because a reflow that moves the hero
     * without changing the document's height resizes nothing at all. This is
     * the `loadingdone` event rather than the `ready` promise: `ready` settles
     * once for the fonts pending when it is read, and the brand faces are
     * requested long after this effect runs, so the promise would resolve
     * before the swap it exists to catch.
     */
    const fonts = document.fonts as FontFaceSet | undefined;
    const watchesFonts = typeof fonts?.addEventListener === 'function';
    if (watchesFonts) fonts.addEventListener('loadingdone', dropRect);

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
    // Scrolling only drops the cached rect and hides the lens; it never
    // synthesises a pointer position of its own.
    window.addEventListener('scroll', invalidate, { passive: true });
    window.addEventListener('resize', invalidate, { passive: true });

    return () => {
      if (watchesFonts) fonts.removeEventListener('loadingdone', dropRect);
      cancelFrame();
      host.removeEventListener('pointerenter', handlePointer);
      host.removeEventListener('pointermove', handlePointer);
      host.removeEventListener('pointerleave', handleRelease);
      host.removeEventListener('pointercancel', handleRelease);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('scroll', invalidate);
      window.removeEventListener('resize', invalidate);
      unsubscribeHover();
      unsubscribeReduced();
      intersectionObserver.disconnect();
      resizeObserver.disconnect();
      for (const property of lensProperties) {
        host.style.removeProperty(property);
      }
    };
  }, [enabled, hostRef]);
}
