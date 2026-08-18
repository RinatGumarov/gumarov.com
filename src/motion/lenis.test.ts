import { afterEach, describe, expect, it, vi } from 'vitest';
import { startConductor } from './conductor';
import { startSmoothScroll } from './lenis';

const { destroy, raf, LenisMock } = vi.hoisted(() => {
  const destroy = vi.fn();
  const raf = vi.fn();
  return { destroy, raf, LenisMock: vi.fn(() => ({ destroy, raf })) };
});

vi.mock('lenis', () => ({ default: LenisMock }));

const originalMatchMedia = window.matchMedia;
let stopConductor: (() => void) | undefined;

function setPointer(fine: boolean) {
  window.matchMedia = vi.fn(
    (query: string) =>
      ({
        matches: query.includes('pointer: fine') ? fine : !fine,
      }) as MediaQueryList,
  ) as unknown as typeof window.matchMedia;
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

afterEach(() => {
  stopConductor?.();
  stopConductor = undefined;
  window.matchMedia = originalMatchMedia;
  LenisMock.mockClear();
  destroy.mockClear();
  raf.mockClear();
  vi.restoreAllMocks();
});

describe('startSmoothScroll', () => {
  it('smooths scrolling for a fine pointer', () => {
    setPointer(true);

    const stop = startSmoothScroll();

    expect(LenisMock).toHaveBeenCalledTimes(1);

    stop();
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('leaves touch scrolling to the platform', () => {
    // Hijacking touch scroll breaks address-bar collapse and overscroll, and
    // the platform's own smoothing is better than ours.
    setPointer(false);

    const stop = startSmoothScroll();

    expect(LenisMock).not.toHaveBeenCalled();
    expect(() => stop()).not.toThrow();
  });

  it('is driven by the conductor rather than a second loop', async () => {
    setPointer(true);
    stopConductor = startConductor();

    const stop = startSmoothScroll();
    await nextFrame();
    await nextFrame();

    expect(raf.mock.calls.length).toBeGreaterThan(0);

    stop();
  });

  it('does nothing on its own once the conductor is not running', async () => {
    // Without the conductor there is no loop at all, which is the point: Lenis
    // must never open one of its own.
    setPointer(true);

    const stop = startSmoothScroll();
    await nextFrame();
    await nextFrame();

    expect(raf).not.toHaveBeenCalled();

    stop();
  });

  it('stops being driven after teardown', async () => {
    setPointer(true);
    stopConductor = startConductor();
    const stop = startSmoothScroll();
    await nextFrame();
    await nextFrame();
    const drivenWhileRunning = raf.mock.calls.length;

    stop();
    await nextFrame();
    await nextFrame();

    expect(raf.mock.calls.length).toBe(drivenWhileRunning);
  });
});
