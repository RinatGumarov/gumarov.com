import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  revealIndex,
  useMotionEnhancementGate,
  usePointerParallax,
  useReducedMotion,
} from './motion';
import { useViewedOnce } from './useViewedOnce';

afterEach(() => {
  document.documentElement.removeAttribute('data-motion-state');
  vi.unstubAllGlobals();
});

describe('useMotionEnhancementGate', () => {
  it('keeps the application in its final state when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined);

    renderHook(() => useMotionEnhancementGate());

    expect(document.documentElement).not.toHaveAttribute('data-motion-state');
  });

  it('enables enhancements only after a successful no-preference query and cleans up', () => {
    installMotionQueries({ coarse: false, reduced: false });

    const { unmount } = renderHook(() => useMotionEnhancementGate());

    expect(document.documentElement).toHaveAttribute(
      'data-motion-state',
      'enabled',
    );
    unmount();
    expect(document.documentElement).not.toHaveAttribute('data-motion-state');
  });
});

describe('useReducedMotion', () => {
  it('defaults to reduced motion when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined);

    const { result } = renderHook(() => useReducedMotion());

    expect(result.current).toBe(true);
  });
});

describe('useViewedOnce', () => {
  /*
   * The scope is what holds a section's blocks back until they are scrolled to.
   * A browser that cannot tell us when that happens would hold them back
   * forever, so it is told there is no scope here and the section is simply
   * part of the page.
   */
  it('opens no scope when IntersectionObserver is unavailable', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);

    render(<ViewedProbe />);

    expect(await screen.findByTestId('viewed')).not.toHaveAttribute(
      'data-motion-scope',
    );
  });

  it('becomes viewed only once and disconnects its observer', () => {
    const observer = installIntersectionObserver();
    const { unmount } = render(<ViewedProbe />);
    const target = screen.getByTestId('viewed');

    expect(target).toHaveAttribute('data-motion-scope', 'probe');
    expect(target).not.toHaveAttribute('data-motion-viewed');
    expect(observer.observe).toHaveBeenCalledWith(target);

    act(() => observer.emit(true));
    expect(target).toHaveAttribute('data-motion-viewed', 'true');

    act(() => {
      observer.emit(false);
      observer.emit(true);
    });
    expect(target).toHaveAttribute('data-motion-viewed', 'true');
    expect(observer.disconnect).toHaveBeenCalledTimes(1);

    unmount();
    expect(observer.disconnect).toHaveBeenCalledTimes(1);
  });

  /*
   * A section taller than the screen can never show a fifth of itself at once
   * on a phone, so asking for one would either reveal it far too late or not at
   * all. It asks for a twelfth instead, which is a comparable amount of the
   * screen rather than of the section.
   */
  it('waits for a fifth of an ordinary section and a twelfth of a tall one', () => {
    const observer = installIntersectionObserver();

    const { rerender } = render(<ViewedProbe />);
    expect(observer.options.at(-1)).toMatchObject({ threshold: 0.18 });

    rerender(<ViewedProbe tall />);
    expect(observer.options.at(-1)).toMatchObject({ threshold: 0.08 });
  });
});

describe('revealIndex', () => {
  it('numbers the blocks of a section and stops counting at the fourth', () => {
    expect([0, 1, 2, 3, 4, 9].map(revealIndex)).toEqual([
      { '--reveal-index': '0' },
      { '--reveal-index': '1' },
      { '--reveal-index': '2' },
      { '--reveal-index': '3' },
      { '--reveal-index': '3' },
      { '--reveal-index': '3' },
    ]);
  });
});

describe('usePointerParallax', () => {
  it('caps pointer offsets to four pixels and resets them on pointer leave', () => {
    installMotionQueries({ coarse: false, reduced: false });
    render(<ParallaxProbe />);
    const target = screen.getByTestId('parallax');
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(
      rect({ left: 20, top: 40, width: 100, height: 80 }),
    );

    fireEvent.pointerMove(target, { clientX: 1000, clientY: -1000 });

    expect(target.style.getPropertyValue('--motion-parallax-x')).toBe('4px');
    expect(target.style.getPropertyValue('--motion-parallax-y')).toBe('-4px');

    fireEvent.pointerLeave(target);
    expect(target.style.getPropertyValue('--motion-parallax-x')).toBe('0px');
    expect(target.style.getPropertyValue('--motion-parallax-y')).toBe('0px');
  });

  /*
   * A pointer produces offsets to as many decimal places as the arithmetic
   * happens to give, and every one of them is written into the inline style the
   * compositor reads. A tenth of a pixel is already finer than the screen can
   * show, so anything past it is work for a movement nobody can see.
   */
  it('rounds pointer offsets to a tenth of a pixel', () => {
    installMotionQueries({ coarse: false, reduced: false });
    render(<ParallaxProbe />);
    const target = screen.getByTestId('parallax');
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(
      rect({ left: 20, top: 40, width: 100, height: 80 }),
    );

    fireEvent.pointerMove(target, { clientX: 71, clientY: 83 });

    expect(target.style.getPropertyValue('--motion-parallax-x')).toBe('0.1px');
    expect(target.style.getPropertyValue('--motion-parallax-y')).toBe('0.3px');
  });

  it.each([
    { label: 'coarse pointers', coarse: true, reduced: false },
    { label: 'reduced motion', coarse: false, reduced: true },
  ])('does not move for $label', ({ coarse, reduced }) => {
    installMotionQueries({ coarse, reduced });
    render(<ParallaxProbe />);
    const target = screen.getByTestId('parallax');
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(
      rect({ left: 0, top: 0, width: 100, height: 100 }),
    );

    fireEvent.pointerMove(target, { clientX: 100, clientY: 100 });

    expect(target.style.getPropertyValue('--motion-parallax-x')).toBe('0px');
    expect(target.style.getPropertyValue('--motion-parallax-y')).toBe('0px');
  });

  it('resets active parallax when the tab moves to the background', () => {
    installMotionQueries({ coarse: false, reduced: false });
    const visibility = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('visible');
    render(<ParallaxProbe />);
    const target = screen.getByTestId('parallax');
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(
      rect({ left: 0, top: 0, width: 100, height: 100 }),
    );
    fireEvent.pointerMove(target, { clientX: 100, clientY: 100 });
    expect(target.style.getPropertyValue('--motion-parallax-x')).toBe('4px');

    visibility.mockReturnValue('hidden');
    fireEvent(document, new Event('visibilitychange'));

    expect(target.style.getPropertyValue('--motion-parallax-x')).toBe('0px');
    expect(target.style.getPropertyValue('--motion-parallax-y')).toBe('0px');
  });
});

function ViewedProbe({ tall = false }: { tall?: boolean }) {
  const { observed, ref, scoped } = useViewedOnce<HTMLDivElement>({ tall });

  return (
    <div
      ref={ref}
      data-testid="viewed"
      data-motion-scope={scoped ? 'probe' : undefined}
      data-motion-viewed={observed ? 'true' : undefined}
    />
  );
}

function ParallaxProbe() {
  const bindings = usePointerParallax<HTMLDivElement>();

  return (
    <div
      ref={bindings.ref}
      data-testid="parallax"
      onPointerMove={bindings.onPointerMove}
      onPointerLeave={bindings.onPointerLeave}
    />
  );
}

function installMotionQueries({
  coarse,
  reduced,
}: {
  coarse: boolean;
  reduced: boolean;
}) {
  vi.stubGlobal('PointerEvent', MouseEvent);
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches:
        query === '(pointer: coarse)'
          ? coarse
          : query === '(prefers-reduced-motion: no-preference)'
            ? !reduced
            : reduced,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

function installIntersectionObserver() {
  let callback: IntersectionObserverCallback | undefined;
  const options: IntersectionObserverInit[] = [];
  const observe = vi.fn();
  const disconnect = vi.fn();

  class Observer implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = '0px';
    readonly thresholds = [0.18];

    constructor(
      nextCallback: IntersectionObserverCallback,
      nextOptions: IntersectionObserverInit = {},
    ) {
      callback = nextCallback;
      options.push(nextOptions);
    }

    observe = observe;
    disconnect = disconnect;
    takeRecords = () => [];
    unobserve = vi.fn();
  }

  vi.stubGlobal('IntersectionObserver', Observer);

  return {
    observe,
    disconnect,
    options,
    emit(isIntersecting: boolean) {
      callback?.(
        [{ isIntersecting } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    },
  };
}

function rect({
  left,
  top,
  width,
  height,
}: {
  left: number;
  top: number;
  width: number;
  height: number;
}): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  };
}
