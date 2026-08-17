import { afterEach, describe, expect, it, vi } from 'vitest';

// vi.hoisted, not a plain const: vi.mock is hoisted above module scope, so a
// factory closing over an ordinary variable throws "cannot access before
// initialization".
const { startRuntime } = vi.hoisted(() => ({
  startRuntime: vi.fn(() => () => undefined),
}));

vi.mock('./runtime', () => ({ startRuntime }));

const originalMatchMedia = window.matchMedia;

function setReducedMotion(reduce: boolean) {
  window.matchMedia = vi.fn(
    (query: string) =>
      ({
        matches: query.includes('prefers-reduced-motion: reduce')
          ? reduce
          : !reduce,
      }) as MediaQueryList,
  ) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  startRuntime.mockClear();
  vi.restoreAllMocks();
});

describe('bootMotion', () => {
  it('loads the runtime when motion is allowed', async () => {
    setReducedMotion(false);
    const { bootMotion } = await import('./boot');

    await bootMotion();

    expect(startRuntime).toHaveBeenCalledTimes(1);
  });

  it('never loads the runtime under reduced motion', async () => {
    setReducedMotion(true);
    const { bootMotion } = await import('./boot');

    await bootMotion();

    // The point of the gate: these visitors must not download gsap or lenis
    // at all, not merely leave them idle.
    expect(startRuntime).not.toHaveBeenCalled();
  });

  it('leaves the page working when the runtime chunk fails to load', async () => {
    setReducedMotion(false);
    startRuntime.mockImplementationOnce(() => {
      throw new Error('chunk unavailable');
    });
    const { bootMotion } = await import('./boot');

    await expect(bootMotion()).resolves.toBeUndefined();
  });
});
