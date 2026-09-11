import { fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useHeroLens } from './useHeroLens';

/**
 * The lens is the one piece of this page that runs a frame loop, so these
 * tests are mostly about lifecycle: that a frame is only ever scheduled when
 * there is something to move, and that every path out of the effect —
 * settling, leaving, a hidden tab, a preference change, unmount — leaves no
 * frame and no listener behind.
 */

const heroRect = { left: 100, top: 50, width: 1200, height: 600 };

let frames: Map<number, FrameRequestCallback>;
let nextFrameId: number;
/** Virtual milliseconds, shared by `performance.now()` and rAF timestamps. */
let clock: number;
let cancelledFrames: number[];
let hoverMedia: FakeMediaQuery;
let reducedMedia: FakeMediaQuery;
let intersectionObservers: FakeObserver[];
let resizeObservers: FakeObserver[];
/** Stands in for the FontFaceSet the hook subscribes to. */
let fontFaceSet: EventTarget;

beforeEach(() => {
  installEnvironment();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useHeroLens', () => {
  it('lands on the pointer at first entry instead of flying in from a corner', () => {
    const host = renderLens();

    // Proves the listener recorder actually sees what the hook attaches, so
    // the "attaches nothing" assertions further down are not vacuous.
    expect(hostListenerTypes).toEqual([
      'pointerenter',
      'pointermove',
      'pointerleave',
      'pointercancel',
    ]);

    enter(host, { clientX: 400, clientY: 250 });

    expect(host.style.getPropertyValue('--lens-x')).toBe('300px');
    expect(host.style.getPropertyValue('--lens-y')).toBe('200px');
    expect(host.style.getPropertyValue('--lens-opacity')).toBe('0.38');
    expect(host.style.getPropertyValue('--lens-fade')).toBe('160ms');
    // A first entry is not animated, so it must not open the loop at all.
    expect(frames.size).toBe(0);
  });

  it('sizes the lens from the hero width', () => {
    const host = renderLens({ width: 900 });

    enter(host, { clientX: 400, clientY: 250 });

    expect(host.style.getPropertyValue('--lens-radius')).toBe('130px');
  });

  it('damps toward a new target and stops once it settles', () => {
    const host = renderLens();
    enter(host, { clientX: 400, clientY: 250 });

    fireEvent.pointerMove(host, {
      pointerType: 'mouse',
      clientX: 700,
      clientY: 250,
    });
    expect(frames.size).toBe(1);

    // One 16ms frame of a 70ms time constant covers 1 - e^(-16/70) ≈ 20.5%
    // of the remaining 300px.
    runFrame(16);
    const afterOneFrame = readNumber(host, '--lens-x');
    expect(afterOneFrame).toBeGreaterThan(350);
    expect(afterOneFrame).toBeLessThan(380);

    const framesRun = runUntilSettled();

    expect(readNumber(host, '--lens-x')).toBe(600);
    expect(readNumber(host, '--lens-y')).toBe(200);
    // Settling must not re-arm the loop.
    expect(frames.size).toBe(0);
    expect(framesRun).toBeGreaterThan(5);
    expect(framesRun).toBeLessThan(80);

    // A pointer move that does not actually move must not restart it either.
    fireEvent.pointerMove(host, {
      pointerType: 'mouse',
      clientX: 700,
      clientY: 250,
    });
    expect(frames.size).toBe(0);
  });

  it('travels the same distance per millisecond at 60Hz and at 120Hz', () => {
    const slow = renderLens();
    enter(slow, { clientX: 200, clientY: 250 });
    fireEvent.pointerMove(slow, {
      pointerType: 'mouse',
      clientX: 700,
      clientY: 250,
    });
    for (let index = 0; index < 3; index += 1) runFrame(16);
    const after48msAt60Hz = readNumber(slow, '--lens-x');
    expect(after48msAt60Hz).toBeGreaterThan(100);
    cleanupRender();

    installEnvironment();
    const fast = renderLens();
    enter(fast, { clientX: 200, clientY: 250 });
    fireEvent.pointerMove(fast, {
      pointerType: 'mouse',
      clientX: 700,
      clientY: 250,
    });
    for (let index = 0; index < 6; index += 1) runFrame(8);
    const after48msAt120Hz = readNumber(fast, '--lens-x');

    // Same 48ms of wall clock, twice the frames: the lens must be in the
    // same place, not twice as far along.
    expect(Math.abs(after48msAt120Hz - after48msAt60Hz)).toBeLessThan(1);
  });

  it('reads the hero rect once, not on every frame', () => {
    const host = renderLens();
    const measure = vi.spyOn(host, 'getBoundingClientRect');
    enter(host, { clientX: 400, clientY: 250 });

    fireEvent.pointerMove(host, {
      pointerType: 'mouse',
      clientX: 900,
      clientY: 500,
    });
    runUntilSettled();

    expect(measure).toHaveBeenCalledTimes(1);
  });

  it('drops the cached rect on scroll and measures the next point against a fresh one', () => {
    const host = renderLens();
    enter(host, { clientX: 400, clientY: 250 });
    expect(host.style.getPropertyValue('--lens-opacity')).toBe('0.38');

    setRect(host, { ...heroRect, top: -150 });
    fireEvent.scroll(window);

    expect(host.style.getPropertyValue('--lens-opacity')).toBe('0');
    expect(host.style.getPropertyValue('--lens-fade')).toBe('180ms');

    fireEvent.pointerMove(host, {
      pointerType: 'mouse',
      clientX: 400,
      clientY: 250,
    });

    // Same client point, new rect: 250 - (-150) rather than 250 - 50.
    expect(host.style.getPropertyValue('--lens-y')).toBe('400px');
    expect(host.style.getPropertyValue('--lens-opacity')).toBe('0.38');
  });

  /*
   * Scroll, resize and a ResizeObserver on the hero all miss the same case: a
   * reflow that *moves* the hero without changing its size and without the
   * visitor scrolling. A late webfont reflowing the navigation above the hero
   * does exactly that, and the lens then tracks an offset position.
   */
  it('watches the document box, not only the hero box', () => {
    const host = renderLens();

    expect(resizeObservers).toHaveLength(1);
    expect(resizeObservers[0]?.observe).toHaveBeenCalledWith(host);
    expect(resizeObservers[0]?.observe).toHaveBeenCalledWith(
      document.documentElement,
    );
  });

  it('keeps the lens under the cursor when the page reflows around it', () => {
    const host = renderLens();
    enter(host, { clientX: 400, clientY: 250 });
    expect(host.style.getPropertyValue('--lens-opacity')).toBe('0.38');

    // A reflow the visitor did not cause — the hero's own heading growing a
    // line when Onest lands. It invalidates the measurement, but hiding the
    // lens out from under a cursor that never moved is a visible flinch.
    setRect(host, { ...heroRect, top: 90 });
    resizeObservers[0]?.emit(true);

    expect(host.style.getPropertyValue('--lens-opacity')).toBe('0.38');

    fireEvent.pointerMove(host, {
      pointerType: 'mouse',
      clientX: 400,
      clientY: 250,
    });
    runUntilSettled();

    expect(host.style.getPropertyValue('--lens-y')).toBe('160px');
  });

  it('drops the cached rect once the webfonts have swapped in', () => {
    const host = renderLens();
    enter(host, { clientX: 400, clientY: 250 });
    expect(host.style.getPropertyValue('--lens-y')).toBe('200px');

    // The navigation above the hero grows by 40px when Onest lands, so the
    // hero moves down without resizing and without a scroll event.
    setRect(host, { ...heroRect, top: 90 });
    fontFaceSet.dispatchEvent(new Event('loadingdone'));

    // Nothing the visitor did, so the lens stays where their cursor is rather
    // than flinching away.
    expect(host.style.getPropertyValue('--lens-opacity')).toBe('0.38');

    fireEvent.pointerMove(host, {
      pointerType: 'mouse',
      clientX: 400,
      clientY: 250,
    });
    runUntilSettled();

    // Same client point, new rect: 250 - 90 rather than the stale 250 - 50,
    // which would have left the lens exactly where it already was.
    expect(host.style.getPropertyValue('--lens-y')).toBe('160px');
  });

  it('stops listening for the font swap once the hero unmounts', () => {
    const host = renderLens();
    const measure = vi.spyOn(host, 'getBoundingClientRect');
    enter(host, { clientX: 400, clientY: 250 });
    cleanupRender();
    measure.mockClear();

    fontFaceSet.dispatchEvent(new Event('loadingdone'));

    // A late font swap must not reach a detached hero at all.
    expect(measure).not.toHaveBeenCalled();
    expect(host.style.getPropertyValue('--lens-opacity')).toBe('');
  });

  it('cancels the pending frame on unmount and removes every listener', () => {
    const host = renderLens();
    const removeHostListener = vi.spyOn(host, 'removeEventListener');
    const removeDocumentListener = vi.spyOn(document, 'removeEventListener');
    const removeWindowListener = vi.spyOn(window, 'removeEventListener');
    enter(host, { clientX: 400, clientY: 250 });
    fireEvent.pointerMove(host, {
      pointerType: 'mouse',
      clientX: 900,
      clientY: 250,
    });
    const pendingFrame = [...frames.keys()][0];
    expect(pendingFrame).toBeDefined();

    cleanupRender();

    expect(cancelledFrames).toContain(pendingFrame);
    for (const type of [
      'pointerenter',
      'pointermove',
      'pointerleave',
      'pointercancel',
    ]) {
      expect(removeHostListener).toHaveBeenCalledWith(
        type,
        expect.any(Function),
      );
    }
    expect(removeDocumentListener).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function),
    );
    expect(removeWindowListener).toHaveBeenCalledWith(
      'scroll',
      expect.any(Function),
    );
    expect(removeWindowListener).toHaveBeenCalledWith(
      'resize',
      expect.any(Function),
    );
    expect(hoverMedia.removeEventListener).toHaveBeenCalled();
    expect(reducedMedia.removeEventListener).toHaveBeenCalled();
    expect(intersectionObservers[0]?.disconnect).toHaveBeenCalledTimes(1);
    expect(resizeObservers[0]?.disconnect).toHaveBeenCalledTimes(1);
    expect(host.style.getPropertyValue('--lens-opacity')).toBe('');
    expect(host.style.getPropertyValue('--lens-x')).toBe('');
  });

  it('stops the loop when the tab is hidden and does not restart it there', () => {
    const host = renderLens();
    enter(host, { clientX: 400, clientY: 250 });
    fireEvent.pointerMove(host, {
      pointerType: 'mouse',
      clientX: 900,
      clientY: 250,
    });
    const pendingFrame = [...frames.keys()][0];

    const visibility = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('hidden');
    fireEvent(document, new Event('visibilitychange'));

    expect(cancelledFrames).toContain(pendingFrame);
    expect(frames.size).toBe(0);
    expect(host.style.getPropertyValue('--lens-opacity')).toBe('0');

    fireEvent.pointerMove(host, {
      pointerType: 'mouse',
      clientX: 500,
      clientY: 250,
    });
    expect(frames.size).toBe(0);

    visibility.mockReturnValue('visible');
  });

  it('stops when the hero scrolls out of view', () => {
    const host = renderLens();
    enter(host, { clientX: 400, clientY: 250 });
    fireEvent.pointerMove(host, {
      pointerType: 'mouse',
      clientX: 900,
      clientY: 250,
    });

    intersectionObservers[0]?.emit(false);

    expect(frames.size).toBe(0);
    expect(host.style.getPropertyValue('--lens-opacity')).toBe('0');
  });

  it('gives up the lens when reduced motion is switched on mid-session', () => {
    const host = renderLens();
    enter(host, { clientX: 400, clientY: 250 });
    fireEvent.pointerMove(host, {
      pointerType: 'mouse',
      clientX: 900,
      clientY: 250,
    });
    expect(frames.size).toBe(1);

    reducedMedia.set(true);

    expect(frames.size).toBe(0);
    expect(host.style.getPropertyValue('--lens-opacity')).toBe('0');

    fireEvent.pointerMove(host, {
      pointerType: 'mouse',
      clientX: 500,
      clientY: 300,
    });
    expect(frames.size).toBe(0);
    expect(host.style.getPropertyValue('--lens-opacity')).toBe('0');
  });

  it.each(['pointerleave', 'pointercancel'] as const)(
    'hides the lens and cancels the frame on %s',
    (eventType) => {
      const host = renderLens();
      enter(host, { clientX: 400, clientY: 250 });
      fireEvent.pointerMove(host, {
        pointerType: 'mouse',
        clientX: 900,
        clientY: 250,
      });
      const pendingFrame = [...frames.keys()][0];

      fireEvent(host, new Event(eventType, { bubbles: false }));

      expect(cancelledFrames).toContain(pendingFrame);
      expect(frames.size).toBe(0);
      expect(host.style.getPropertyValue('--lens-opacity')).toBe('0');
      expect(host.style.getPropertyValue('--lens-fade')).toBe('180ms');

      // Re-entering starts from the new pointer, not from the stale position.
      fireEvent.pointerEnter(host, {
        pointerType: 'mouse',
        clientX: 200,
        clientY: 150,
      });
      expect(host.style.getPropertyValue('--lens-x')).toBe('100px');
      expect(frames.size).toBe(0);
    },
  );

  it('ignores touch pointers entirely', () => {
    const host = renderLens();

    fireEvent.pointerEnter(host, {
      pointerType: 'touch',
      clientX: 400,
      clientY: 250,
    });
    fireEvent.pointerMove(host, {
      pointerType: 'touch',
      clientX: 500,
      clientY: 250,
    });

    expect(host.style.getPropertyValue('--lens-opacity')).toBe('');
    expect(host.style.getPropertyValue('--lens-x')).toBe('');
    expect(frames.size).toBe(0);
  });

  it('attaches nothing at all while the motion gate is off', () => {
    const host = renderLens({ enabled: false });

    enter(host, { clientX: 400, clientY: 250 });

    // The gate is checked before anything is wired up, so a gated-off hero
    // carries no listener and no observer whatsoever.
    expect(hostListenerTypes).toEqual([]);
    expect(intersectionObservers).toHaveLength(0);
    expect(resizeObservers).toHaveLength(0);
    expect(host.style.getPropertyValue('--lens-opacity')).toBe('');
    expect(frames.size).toBe(0);
  });

  it.each([
    { label: 'a device without hover', prepare: () => hoverMedia.set(false) },
    { label: 'reduced motion at mount', prepare: () => reducedMedia.set(true) },
  ])('stays inert on $label', ({ prepare }) => {
    prepare();
    const host = renderLens();

    enter(host, { clientX: 400, clientY: 250 });

    // These two are runtime conditions, not capability gaps: the listeners are
    // attached and simply decline to do anything, so the lens can come back if
    // the preference changes without remounting the hero.
    expect(hostListenerTypes).toContain('pointermove');
    expect(host.style.getPropertyValue('--lens-opacity')).toBe('');
    expect(host.style.getPropertyValue('--lens-x')).toBe('');
    expect(frames.size).toBe(0);
  });

  it.each([
    {
      label: 'matchMedia',
      break: () => vi.stubGlobal('matchMedia', undefined),
    },
    {
      label: 'IntersectionObserver',
      break: () => vi.stubGlobal('IntersectionObserver', undefined),
    },
    {
      label: 'ResizeObserver',
      break: () => vi.stubGlobal('ResizeObserver', undefined),
    },
    {
      label: 'mask support',
      break: () => vi.stubGlobal('CSS', { supports: () => false }),
    },
    {
      label: 'CSS.supports',
      break: () => vi.stubGlobal('CSS', undefined),
    },
  ])('stays inert without $label, and attaches no listeners', (scenario) => {
    scenario.break();
    const host = renderLens();

    enter(host, { clientX: 400, clientY: 250 });

    // A missing capability is permanent, so the hook wires up nothing at all
    // rather than attaching listeners that could never do anything.
    expect(hostListenerTypes).toEqual([]);
    expect(intersectionObservers).toHaveLength(0);
    expect(resizeObservers).toHaveLength(0);
    expect(host.style.getPropertyValue('--lens-opacity')).toBe('');
    expect(host.style.getPropertyValue('--lens-x')).toBe('');
    expect(frames.size).toBe(0);
  });
});

function LensProbe({ enabled }: { enabled: boolean }) {
  const ref = useRef<HTMLElement>(null);
  useHeroLens(ref, enabled);

  return (
    <section
      ref={(element) => {
        ref.current = element;
        // A ref callback runs before effects, so this records the listeners
        // the hook itself attaches. Spying after `render` returns would be far
        // too late — Testing Library flushes effects synchronously inside
        // `render`, so such a spy can never observe anything and any
        // "attaches no listeners" assertion built on it passes unconditionally.
        if (element) recordHostListeners(element);
      }}
      data-testid="hero"
    />
  );
}

/** Event types passed to the host's `addEventListener` since the last render. */
let hostListenerTypes: string[] = [];

function recordHostListeners(host: HTMLElement) {
  hostListenerTypes = [];
  const attach = host.addEventListener.bind(host);
  host.addEventListener = ((
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) => {
    hostListenerTypes.push(type);
    attach(type, listener, options);
  }) as typeof host.addEventListener;
}

let activeRender: { unmount: () => void } | null = null;

function renderLens({
  enabled = true,
  width = heroRect.width,
}: { enabled?: boolean; width?: number } = {}) {
  activeRender = render(<LensProbe enabled={enabled} />);
  const host = screen.getByTestId('hero');
  setRect(host, { ...heroRect, width });

  // The hook measures on the first pointer event, which every test sends
  // after this point, so the rect installed here is the one it reads.
  return host;
}

function cleanupRender() {
  activeRender?.unmount();
  activeRender = null;
}

function setRect(
  host: HTMLElement,
  { left, top, width, height }: typeof heroRect,
) {
  vi.spyOn(host, 'getBoundingClientRect').mockReturnValue({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect);
}

function enter(host: HTMLElement, point: { clientX: number; clientY: number }) {
  fireEvent.pointerEnter(host, { pointerType: 'mouse', ...point });
}

function readNumber(host: HTMLElement, property: string) {
  return Number.parseFloat(host.style.getPropertyValue(property));
}

/** Advances the virtual clock by `deltaMs` and runs the pending frame. */
function runFrame(deltaMs: number) {
  const [id, callback] = [...frames.entries()][0] ?? [];
  if (id === undefined || !callback) throw new Error('no frame was scheduled');
  frames.delete(id);
  clock += deltaMs;
  callback(clock);
}

function runUntilSettled(deltaMs = 16) {
  let count = 0;
  while (frames.size > 0) {
    if (count > 500) throw new Error('the lens loop never settled');
    runFrame(deltaMs);
    count += 1;
  }
  return count;
}

class FakePointerEvent extends MouseEvent {
  readonly pointerType: string;

  constructor(type: string, init: MouseEventInit & { pointerType?: string }) {
    super(type, init);
    this.pointerType = init?.pointerType ?? '';
  }
}

class FakeMediaQuery {
  matches: boolean;
  readonly media: string;
  onchange = null;
  readonly addEventListener = vi.fn(
    (_type: string, listener: () => void) => void this.listeners.add(listener),
  );
  readonly removeEventListener = vi.fn(
    (_type: string, listener: () => void) =>
      void this.listeners.delete(listener),
  );
  readonly addListener = vi.fn();
  readonly removeListener = vi.fn();
  readonly dispatchEvent = vi.fn();
  private readonly listeners = new Set<() => void>();

  constructor(media: string, matches: boolean) {
    this.media = media;
    this.matches = matches;
  }

  set(matches: boolean) {
    this.matches = matches;
    for (const listener of this.listeners) listener();
  }
}

interface FakeObserver {
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  emit: (isIntersecting: boolean) => void;
}

function installEnvironment() {
  frames = new Map();
  nextFrameId = 1;
  clock = 0;
  cancelledFrames = [];
  intersectionObservers = [];
  resizeObservers = [];

  // The hook seeds its damping clock from `performance.now()` and then reads
  // rAF timestamps, so both have to come from the same virtual clock or the
  // first frame of every burst would measure a nonsense delta.
  vi.spyOn(performance, 'now').mockImplementation(() => clock);

  // jsdom has no PointerEvent, so without this every dispatched event loses
  // its `pointerType` and the hook could never tell a mouse from a finger.
  vi.stubGlobal('PointerEvent', FakePointerEvent);

  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = nextFrameId++;
    frames.set(id, callback);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    cancelledFrames.push(id);
    frames.delete(id);
  });

  hoverMedia = new FakeMediaQuery('(hover: hover) and (pointer: fine)', true);
  reducedMedia = new FakeMediaQuery('(prefers-reduced-motion: reduce)', false);
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) =>
      query.includes('reduced-motion') ? reducedMedia : hoverMedia,
    ),
  );

  // jsdom ships no FontFaceSet, so without this the hook's `loadingdone`
  // subscription would be feature-detected away and the font-swap test would
  // pass without ever exercising it.
  vi.stubGlobal('CSS', { supports: () => true });
  fontFaceSet = new EventTarget();
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: fontFaceSet,
  });
  vi.stubGlobal(
    'IntersectionObserver',
    makeObserverClass(intersectionObservers),
  );
  vi.stubGlobal('ResizeObserver', makeObserverClass(resizeObservers));
}

function makeObserverClass(registry: FakeObserver[]) {
  return class {
    readonly observe = vi.fn();
    readonly unobserve = vi.fn();
    readonly disconnect = vi.fn();
    readonly takeRecords = vi.fn(() => []);

    constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
      registry.push({
        observe: this.observe,
        disconnect: this.disconnect,
        emit: (isIntersecting: boolean) => callback([{ isIntersecting }]),
      });
    }
  };
}
