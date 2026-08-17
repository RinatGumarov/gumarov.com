import { afterEach, describe, expect, it, vi } from 'vitest';

const { destroy, raf, LenisMock } = vi.hoisted(() => {
  const destroy = vi.fn();
  const raf = vi.fn();
  return { destroy, raf, LenisMock: vi.fn(() => ({ destroy, raf })) };
});

vi.mock('lenis', () => ({ default: LenisMock }));

const originalMatchMedia = window.matchMedia;

function setPointer(fine: boolean) {
  window.matchMedia = vi.fn(
    (query: string) =>
      ({
        matches: query.includes('pointer: fine') ? fine : !fine,
      }) as MediaQueryList,
  ) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  LenisMock.mockClear();
  destroy.mockClear();
  raf.mockClear();
  vi.restoreAllMocks();
});

describe('startSmoothScroll', () => {
  it('smooths scrolling for a fine pointer', async () => {
    setPointer(true);
    const { startSmoothScroll } = await import('./lenis');

    const stop = startSmoothScroll();

    expect(LenisMock).toHaveBeenCalledTimes(1);

    stop();
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('leaves touch scrolling to the platform', async () => {
    // Hijacking touch scroll breaks address-bar collapse and overscroll, and
    // the platform's own smoothing is better than ours.
    setPointer(false);
    const { startSmoothScroll } = await import('./lenis');

    const stop = startSmoothScroll();

    expect(LenisMock).not.toHaveBeenCalled();
    expect(() => stop()).not.toThrow();
  });

  it('drives one raf per frame and stops on teardown', async () => {
    setPointer(true);
    const { startSmoothScroll } = await import('./lenis');

    const stop = startSmoothScroll();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const drivenWhileRunning = raf.mock.calls.length;
    expect(drivenWhileRunning).toBeGreaterThan(0);

    stop();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(raf.mock.calls.length).toBe(drivenWhileRunning);
  });
});
