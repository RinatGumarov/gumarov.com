import { render } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useHeroVisual } from './hero-visual';

/**
 * The hook's contract, independent of how the ribbon looks.
 *
 * Three things matter here and none of them is visual: the pointer position
 * never becomes React state, nothing is installed while the gate is closed, and
 * unmounting leaves the document exactly as it was found — no listeners, no
 * observers, no custom properties still written on the host.
 */

interface MediaQueryStub {
  matches: boolean;
  listeners: Set<() => void>;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

const mediaQueries = new Map<string, MediaQueryStub>();

function stubMediaQuery(query: string, matches: boolean) {
  const stub: MediaQueryStub = {
    matches,
    listeners: new Set(),
    addEventListener(_type, listener) {
      this.listeners.add(listener);
    },
    removeEventListener(_type, listener) {
      this.listeners.delete(listener);
    },
  };
  mediaQueries.set(query, stub);
  return stub;
}

function installMatchMedia() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => {
      const existing = mediaQueries.get(query);
      if (existing) return existing;
      return stubMediaQuery(query, false);
    }),
  );
}

class ObserverStub {
  static instances: ObserverStub[] = [];
  disconnected = false;
  observed: Element[] = [];

  constructor(private readonly callback: IntersectionObserverCallback) {
    ObserverStub.instances.push(this);
  }

  observe(element: Element) {
    this.observed.push(element);
  }

  disconnect() {
    this.disconnected = true;
  }

  trigger(isIntersecting: boolean) {
    this.callback(
      [{ isIntersecting } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

/*
 * jsdom has no canvas backend, so `getContext` reports "not implemented" to the
 * virtual console rather than answering. Stubbing it to `null` both silences
 * that and states the case these tests actually run: a browser without WebGL,
 * where the hook must keep the pointer response and never reach for the
 * enhancement chunk.
 */
function stubNoWebGl() {
  vi.stubGlobal('HTMLCanvasElement', window.HTMLCanvasElement);
  vi.spyOn(window.HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    null,
  );
}

function Harness({ enabled }: { enabled: boolean }) {
  const hostRef = { current: null } as { current: HTMLElement | null };
  const canvasRef = { current: null } as { current: HTMLCanvasElement | null };

  return (
    <section
      data-testid="host"
      ref={(element) => {
        hostRef.current = element;
      }}
    >
      <Consumer hostRef={hostRef} canvasRef={canvasRef} enabled={enabled} />
      <canvas
        ref={(element) => {
          canvasRef.current = element;
        }}
      />
    </section>
  );
}

function Consumer({
  hostRef,
  canvasRef,
  enabled,
}: {
  hostRef: { current: HTMLElement | null };
  canvasRef: { current: HTMLCanvasElement | null };
  enabled: boolean;
}) {
  const state = useHeroVisual({ hostRef, canvasRef, enabled });
  return <span data-testid="state">{state}</span>;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  mediaQueries.clear();
  ObserverStub.instances = [];
});

describe('useHeroVisual', () => {
  it('installs nothing while the motion gate is closed', () => {
    installMatchMedia();
    vi.stubGlobal('IntersectionObserver', ObserverStub);
    stubNoWebGl();
    const addEventListener = vi.spyOn(document, 'addEventListener');

    const { getByTestId } = render(<Harness enabled={false} />);

    expect(getByTestId('state').textContent).toBe('static');
    expect(ObserverStub.instances).toHaveLength(0);
    expect(
      addEventListener.mock.calls.filter(
        ([type]) => type === 'visibilitychange',
      ),
    ).toHaveLength(0);
    addEventListener.mockRestore();
  });

  it('stays static and installs nothing without a fine pointer', () => {
    stubMediaQuery('(hover: hover) and (pointer: fine)', false);
    stubMediaQuery('(prefers-reduced-motion: reduce)', false);
    installMatchMedia();
    vi.stubGlobal('IntersectionObserver', ObserverStub);
    stubNoWebGl();

    const { getByTestId } = render(<Harness enabled />);

    // The observer is still attached — visibility is what parks the visual —
    // but the pointer never becomes allowed, so nothing is ever written.
    expect(getByTestId('state').textContent).toBe('static');
    const host = getByTestId('host');
    expect(host.style.getPropertyValue('--hero-tilt-x')).toBe('');
  });

  it('writes the pointer response as custom properties, never as state', () => {
    stubMediaQuery('(hover: hover) and (pointer: fine)', true);
    stubMediaQuery('(prefers-reduced-motion: reduce)', false);
    installMatchMedia();
    vi.stubGlobal('IntersectionObserver', ObserverStub);
    stubNoWebGl();

    const { getByTestId } = render(<Harness enabled />);
    const host = getByTestId('host');
    host.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 1000, height: 500 }) as DOMRect;

    act(() => {
      ObserverStub.instances[0]?.trigger(true);
    });
    act(() => {
      host.dispatchEvent(
        Object.assign(new Event('pointermove', { bubbles: false }), {
          pointerType: 'mouse',
          clientX: 1000,
          clientY: 500,
        }),
      );
    });

    // Bottom-right corner is the extreme of the budget: ±4° and ±8px, no more.
    expect(host.style.getPropertyValue('--hero-tilt-x')).toBe('-4deg');
    expect(host.style.getPropertyValue('--hero-tilt-y')).toBe('4deg');
    expect(host.style.getPropertyValue('--hero-shift-x')).toBe('8px');
    expect(host.style.getPropertyValue('--hero-shift-y')).toBe('4px');
    // A re-render would have reset the state span; it never changed.
    expect(getByTestId('state').textContent).toBe('static');
  });

  it('parks the visual when the pointer leaves and when the hero scrolls away', () => {
    stubMediaQuery('(hover: hover) and (pointer: fine)', true);
    stubMediaQuery('(prefers-reduced-motion: reduce)', false);
    installMatchMedia();
    vi.stubGlobal('IntersectionObserver', ObserverStub);
    stubNoWebGl();

    const { getByTestId } = render(<Harness enabled />);
    const host = getByTestId('host');
    host.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 1000, height: 500 }) as DOMRect;

    act(() => ObserverStub.instances[0]?.trigger(true));
    act(() => {
      host.dispatchEvent(
        Object.assign(new Event('pointermove'), {
          pointerType: 'mouse',
          clientX: 900,
          clientY: 400,
        }),
      );
    });
    expect(host.style.getPropertyValue('--hero-shift-x')).not.toBe('0px');

    act(() => {
      host.dispatchEvent(new Event('pointerleave'));
    });
    expect(host.style.getPropertyValue('--hero-tilt-x')).toBe('0deg');
    expect(host.style.getPropertyValue('--hero-shift-x')).toBe('0px');

    act(() => ObserverStub.instances[0]?.trigger(false));
    expect(host.style.getPropertyValue('--hero-shift-y')).toBe('0px');
  });

  it('leaves no listeners, observers or properties behind on unmount', () => {
    const hover = stubMediaQuery('(hover: hover) and (pointer: fine)', true);
    const reduced = stubMediaQuery('(prefers-reduced-motion: reduce)', false);
    installMatchMedia();
    vi.stubGlobal('IntersectionObserver', ObserverStub);
    stubNoWebGl();
    const addDocument = vi.spyOn(document, 'addEventListener');
    const removeDocument = vi.spyOn(document, 'removeEventListener');
    const addWindow = vi.spyOn(window, 'addEventListener');
    const removeWindow = vi.spyOn(window, 'removeEventListener');

    const { getByTestId, unmount } = render(<Harness enabled />);
    const host = getByTestId('host');
    host.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 1000, height: 500 }) as DOMRect;

    act(() => ObserverStub.instances[0]?.trigger(true));
    act(() => {
      host.dispatchEvent(
        Object.assign(new Event('pointermove'), {
          pointerType: 'mouse',
          clientX: 700,
          clientY: 300,
        }),
      );
    });
    expect(host.style.getPropertyValue('--hero-tilt-x')).not.toBe('');

    unmount();

    const counted = (
      spy: ReturnType<typeof vi.spyOn>,
      types: readonly string[],
    ) =>
      spy.mock.calls.filter(([type]) => types.includes(type as string)).length;

    expect(counted(addDocument, ['visibilitychange'])).toBe(
      counted(removeDocument, ['visibilitychange']),
    );
    expect(counted(addWindow, ['scroll', 'resize'])).toBe(
      counted(removeWindow, ['scroll', 'resize']),
    );
    expect(hover.listeners.size).toBe(0);
    expect(reduced.listeners.size).toBe(0);
    expect(ObserverStub.instances[0]?.disconnected).toBe(true);
    for (const property of [
      '--hero-tilt-x',
      '--hero-tilt-y',
      '--hero-shift-x',
      '--hero-shift-y',
      '--hero-light-x',
      '--hero-light-y',
    ]) {
      expect(host.style.getPropertyValue(property)).toBe('');
    }

    addDocument.mockRestore();
    removeDocument.mockRestore();
    addWindow.mockRestore();
    removeWindow.mockRestore();
  });
});
