import { isMotionAllowed } from './capabilities';

/**
 * The only eager motion code. It answers one question — should this visitor
 * get the motion layer at all — and if so pulls the runtime in as a separate
 * chunk. A visitor who asked for reduced motion downloads none of it.
 */
export async function bootMotion(): Promise<void> {
  if (!isMotionAllowed()) return;

  try {
    const { startRuntime } = await import('./runtime');
    startRuntime();
  } catch {
    // A failed chunk must cost the visitor nothing: the prerendered page and
    // the existing CSS motion keep working exactly as they do without it.
  }
}

/** Defer to idle so the layer never competes with first paint. */
export function scheduleMotion(): void {
  if (typeof window === 'undefined') return;

  const run = () => {
    void bootMotion();
  };

  const schedule = () => {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(run, { timeout: 2000 });
      return;
    }

    setTimeout(run, 1);
  };

  if (document.readyState === 'complete') {
    schedule();
    return;
  }

  window.addEventListener('load', schedule, { once: true });
}
