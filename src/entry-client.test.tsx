import type { HydrationOptions, Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { hydrateRootMock, scheduleLandingViewedMock } = vi.hoisted(() => ({
  hydrateRootMock: vi.fn(),
  scheduleLandingViewedMock: vi.fn(),
}));

vi.mock('react-dom/client', () => ({ hydrateRoot: hydrateRootMock }));
vi.mock('./lib/analytics', () => ({
  scheduleLandingViewed: scheduleLandingViewedMock,
}));

describe('client hydration fallback', () => {
  beforeEach(() => {
    vi.resetModules();
    hydrateRootMock.mockReset();
    scheduleLandingViewedMock.mockReset();
    document.documentElement.lang = 'en';
    document.body.innerHTML =
      '<div id="root"><main><a href="mailto:hi@gumarov.com">Email</a></main></div>';
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it.each(['onRecoverableError', 'onUncaughtError'] as const)(
    'restores the server markup after %s while React unwinds',
    async (callbackName) => {
      const unmount = vi.fn();
      hydrateRootMock.mockImplementation(
        (
          container: Element | Document,
          _children,
          options?: HydrationOptions,
        ) => {
          const element = container as HTMLElement;
          element.innerHTML = '<p>Hydration mutation before callback</p>';
          options?.[callbackName]?.(new Error('Hydration failed'), {
            componentStack: '',
          });
          options?.[callbackName]?.(new Error('Repeated hydration failure'), {
            componentStack: '',
          });
          element.innerHTML = '<p>Hydration mutation after callback</p>';
          return { render: vi.fn(), unmount } satisfies Root;
        },
      );

      await import('./entry-client');
      await settleMicrotasks();

      expect(document.getElementById('root')).toHaveTextContent('Email');
      expect(unmount).toHaveBeenCalledTimes(1);
    },
  );

  it('restores the server markup after a synchronous hydration failure unwinds', async () => {
    hydrateRootMock.mockImplementation((container: Element | Document) => {
      const element = container as HTMLElement;
      element.innerHTML = '<p>Hydration mutation before throw</p>';
      queueMicrotask(() => {
        element.innerHTML = '<p>Hydration mutation after throw</p>';
      });
      throw new Error('Synchronous hydration failure');
    });

    await import('./entry-client');
    await settleMicrotasks();

    expect(document.getElementById('root')).toHaveTextContent('Email');
  });

  it('schedules one localized landing view after hydration starts', async () => {
    hydrateRootMock.mockReturnValue({
      render: vi.fn(),
      unmount: vi.fn(),
    } satisfies Root);
    document.documentElement.lang = 'ru';

    await import('./entry-client');

    expect(scheduleLandingViewedMock).toHaveBeenCalledTimes(1);
    expect(scheduleLandingViewedMock).toHaveBeenCalledWith('ru');
  });
});

async function settleMicrotasks() {
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  await new Promise<void>((resolve) => queueMicrotask(resolve));
}
