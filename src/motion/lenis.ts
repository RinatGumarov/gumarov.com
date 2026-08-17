import Lenis from 'lenis';
import { matchesMedia } from '../lib/media-query';

/**
 * Smooth the real scroll position rather than translating a container, so
 * `window.scrollY`, anchor links, `scroll-margin` and the section observer all
 * keep working untouched — and the conductor needs no knowledge of Lenis.
 */
export function startSmoothScroll(): () => void {
  if (typeof window === 'undefined') return () => undefined;
  if (!matchesMedia('(pointer: fine)', false)) return () => undefined;

  const lenis = new Lenis({
    // Slightly longer than the default: the scenes are tall and a fast decay
    // makes long sections feel choppy rather than cinematic.
    lerp: 0.09,
    wheelMultiplier: 1,
    touchMultiplier: 1,
  });

  let running = true;
  let handle = 0;

  const frame = (time: number) => {
    if (!running) return;
    lenis.raf(time);
    handle = window.requestAnimationFrame(frame);
  };

  handle = window.requestAnimationFrame(frame);

  return () => {
    if (!running) return;
    running = false;
    window.cancelAnimationFrame(handle);
    lenis.destroy();
  };
}
