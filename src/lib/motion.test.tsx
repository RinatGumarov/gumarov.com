import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
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

  it('tracks preference changes and removes its listener on cleanup', () => {
    let matches = false;
    let listener: EventListenerOrEventListenerObject | undefined;
    const addEventListener = vi.fn(
      (_type: string, nextListener: EventListenerOrEventListenerObject) => {
        listener = nextListener;
      },
    );
    const removeEventListener = vi.fn();
    const mediaQuery = {
      get matches() {
        return matches;
      },
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addEventListener,
      removeEventListener,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as MediaQueryList;
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => mediaQuery),
    );

    const { result, unmount } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);

    act(() => {
      matches = true;
      if (typeof listener === 'function') {
        listener({ matches: true } as MediaQueryListEvent);
      }
    });

    expect(result.current).toBe(true);
    unmount();
    expect(removeEventListener).toHaveBeenCalledWith('change', listener);
  });
});

describe('useViewedOnce', () => {
  it('uses the visible final state when IntersectionObserver is unavailable', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);

    render(<ViewedProbe />);

    expect(await screen.findByTestId('viewed')).toHaveAttribute(
      'data-viewed',
      'true',
    );
    expect(screen.getByTestId('viewed')).toHaveAttribute(
      'data-observed',
      'false',
    );
  });

  it('becomes viewed only once and disconnects its observer', () => {
    const observer = installIntersectionObserver();
    const { unmount } = render(<ViewedProbe />);
    const target = screen.getByTestId('viewed');

    expect(target).toHaveAttribute('data-viewed', 'false');
    expect(observer.observe).toHaveBeenCalledWith(target);

    act(() => observer.emit(true));
    expect(target).toHaveAttribute('data-viewed', 'true');
    expect(target).toHaveAttribute('data-observed', 'true');

    act(() => {
      observer.emit(false);
      observer.emit(true);
    });
    expect(target).toHaveAttribute('data-viewed', 'true');
    expect(observer.disconnect).toHaveBeenCalledTimes(1);

    unmount();
    expect(observer.disconnect).toHaveBeenCalledTimes(1);
  });

  it('disconnects an active observer when the component unmounts', () => {
    const observer = installIntersectionObserver();
    const { unmount } = render(<ViewedProbe />);

    unmount();

    expect(observer.disconnect).toHaveBeenCalledTimes(1);
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

  it('does not move while the document is hidden', () => {
    installMotionQueries({ coarse: false, reduced: false });
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
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

  it('stays in the final state when PointerEvent is unavailable', () => {
    installMotionQueries({ coarse: false, reduced: false });
    vi.stubGlobal('PointerEvent', undefined);
    render(<ParallaxProbe />);
    const target = screen.getByTestId('parallax');
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(
      rect({ left: 0, top: 0, width: 100, height: 100 }),
    );

    fireEvent.pointerMove(target, { clientX: 100, clientY: 100 });

    expect(target.style.getPropertyValue('--motion-parallax-x')).toBe('0px');
    expect(target.style.getPropertyValue('--motion-parallax-y')).toBe('0px');
  });
});

function ViewedProbe() {
  const { observed, ref, viewed } = useViewedOnce<HTMLDivElement>();

  return (
    <div
      ref={ref}
      data-testid="viewed"
      data-viewed={String(viewed)}
      data-observed={String(observed)}
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
  const observe = vi.fn();
  const disconnect = vi.fn();

  class Observer implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = '0px';
    readonly thresholds = [0.18];

    constructor(nextCallback: IntersectionObserverCallback) {
      callback = nextCallback;
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
