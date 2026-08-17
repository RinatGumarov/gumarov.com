import { afterEach, describe, expect, it, vi } from 'vitest';
import { magneticOffset } from './magnetic';

const { quickTo, quickToSetter } = vi.hoisted(() => {
  const quickToSetter = vi.fn();
  return { quickToSetter, quickTo: vi.fn(() => quickToSetter) };
});

vi.mock('gsap', () => ({
  default: { quickTo },
  gsap: { quickTo },
}));

const originalMatchMedia = window.matchMedia;

function setPointer(fine: boolean) {
  window.matchMedia = vi.fn(
    (query: string) =>
      ({
        matches: query.includes('pointer: fine') ? fine : !fine,
      }) as MediaQueryList,
  ) as unknown as typeof window.matchMedia;
}

// jsdom 26 has no PointerEvent constructor.
function pointer(type: string, init: MouseEventInit = {}) {
  return new MouseEvent(type, init);
}

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  document.body.innerHTML = '';
  quickTo.mockClear();
  quickToSetter.mockClear();
  vi.restoreAllMocks();
});

describe('magneticOffset', () => {
  const bounds = { left: 100, top: 100, width: 200, height: 100 };

  it('reports no pull from the centre', () => {
    expect(magneticOffset(200, 150, bounds, 0.3)).toEqual({ x: 0, y: 0 });
  });

  it('pulls toward the pointer, scaled by strength', () => {
    const offset = magneticOffset(300, 150, bounds, 0.3);

    expect(offset.x).toBeCloseTo(30, 6);
    expect(offset.y).toBeCloseTo(0, 6);
  });

  it('never pulls further than the element half-size', () => {
    // Beyond that the label detaches from its own background and the control
    // stops looking like a button.
    const offset = magneticOffset(10_000, 10_000, bounds, 5);

    expect(Math.abs(offset.x)).toBeLessThanOrEqual(bounds.width / 2);
    expect(Math.abs(offset.y)).toBeLessThanOrEqual(bounds.height / 2);
  });

  it('reports no pull for a collapsed element', () => {
    expect(
      magneticOffset(0, 0, { left: 0, top: 0, width: 0, height: 0 }, 0.3),
    ).toEqual({ x: 0, y: 0 });
  });
});

describe('startMagnetic', () => {
  it('binds every marked control for a fine pointer', async () => {
    setPointer(true);
    document.body.innerHTML =
      '<a href="#work" data-magnetic>Work</a><a href="#contact" data-magnetic>Contact</a>';
    const { startMagnetic } = await import('./magnetic');

    const stop = startMagnetic();

    // Two elements, an x and a y setter each.
    expect(quickTo).toHaveBeenCalledTimes(4);

    stop();
  });

  it('binds nothing for a coarse pointer', async () => {
    // A tap would jerk the control out from under the finger that pressed it.
    setPointer(false);
    document.body.innerHTML = '<a href="#work" data-magnetic>Work</a>';
    const { startMagnetic } = await import('./magnetic');

    const stop = startMagnetic();

    expect(quickTo).not.toHaveBeenCalled();
    expect(() => stop()).not.toThrow();
  });

  it('returns the control to rest when the pointer leaves', async () => {
    setPointer(true);
    document.body.innerHTML = '<a href="#work" id="cta" data-magnetic>Work</a>';
    const { startMagnetic } = await import('./magnetic');
    const stop = startMagnetic();
    quickToSetter.mockClear();

    document.getElementById('cta')?.dispatchEvent(pointer('pointerleave'));

    expect(quickToSetter).toHaveBeenCalledWith(0);

    stop();
  });

  it('returns the control to rest when it takes keyboard focus', async () => {
    // The focus ring is drawn where the element really is, so a displaced
    // control would show its outline offset from the label.
    setPointer(true);
    document.body.innerHTML = '<a href="#work" id="cta" data-magnetic>Work</a>';
    const { startMagnetic } = await import('./magnetic');
    const stop = startMagnetic();
    quickToSetter.mockClear();

    document
      .getElementById('cta')
      ?.dispatchEvent(new FocusEvent('blur', { bubbles: false }));

    expect(quickToSetter).toHaveBeenCalledWith(0);

    stop();
  });

  it('leaves no control displaced after teardown', async () => {
    setPointer(true);
    document.body.innerHTML = '<a href="#work" id="cta" data-magnetic>Work</a>';
    const { startMagnetic } = await import('./magnetic');
    const stop = startMagnetic();
    quickToSetter.mockClear();

    stop();

    expect(quickToSetter).toHaveBeenCalledWith(0);
  });
});
