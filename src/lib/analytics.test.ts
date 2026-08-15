import { describe, expect, it, vi } from 'vitest';
import {
  categorizeReferrer,
  createAnalyticsAdapter,
  createLandingViewScheduler,
  createPostHogConfig,
  getViewportClass,
  observeProjectViewOnce,
  sanitizeLocation,
  type AnalyticsEvent,
  type PostHogProvider,
} from './analytics';

const allowedEvents: readonly AnalyticsEvent[] = [
  {
    name: 'landing_viewed',
    properties: { locale: 'en', viewport: 'mobile', referrer: 'instagram' },
  },
  {
    name: 'language_changed',
    properties: { from: 'en', to: 'ru' },
  },
  {
    name: 'project_viewed',
    properties: { slug: 'tradingview', locale: 'en' },
  },
  {
    name: 'contact_clicked',
    properties: { channel: 'telegram', section: 'contact', locale: 'en' },
  },
];

describe('privacy-first analytics adapter', () => {
  it('survives the installed PostHog before_send required-property gate', async () => {
    const { PostHog } = await import('posthog-js/dist/module.slim');
    const provider = new PostHog();
    const capturedEvents = vi.fn();
    provider.init(
      'phc_public_transport_token',
      createPostHogConfig(
        'https://eu.i.posthog.com',
        'https://gumarov.com/en/?secret=1#contact',
      ) as never,
    );
    provider.on('eventCaptured', capturedEvents);

    const captured = provider.capture('landing_viewed', {
      locale: 'en',
      viewport: 'desktop',
      referrer: 'direct',
    });

    expect(capturedEvents).toHaveBeenCalledTimes(1);
    expect(captured).toEqual(capturedEvents.mock.calls[0]?.[0]);
    expect(capturedEvents.mock.calls[0]?.[0]).toEqual({
      event: 'landing_viewed',
      properties: {
        locale: 'en',
        viewport: 'desktop',
        referrer: 'direct',
        token: 'phc_public_transport_token',
        $current_url: 'https://gumarov.com/en/',
        $lib: 'web',
        $lib_version: expect.any(String),
        $process_person_profile: false,
        $cookieless_mode: true,
      },
      uuid: expect.any(String),
    });
  });

  it('lazily initializes once and sends only exact allowlisted payloads', async () => {
    const provider = createProvider();
    const loadProvider = vi.fn(async () => provider);
    const adapter = createAnalyticsAdapter({
      key: 'phc_public_test',
      host: 'https://eu.i.posthog.com',
      loadProvider,
      doNotTrack: false,
      currentUrl: 'https://gumarov.com/en/?campaign=private#contact',
    });

    expect(loadProvider).not.toHaveBeenCalled();

    for (const event of allowedEvents) {
      expect(adapter.capture(event)).toBe(true);
    }

    await vi.waitFor(() => expect(provider.capture).toHaveBeenCalledTimes(4));
    expect(loadProvider).toHaveBeenCalledTimes(1);
    expect(provider.init).toHaveBeenCalledTimes(1);
    expect(provider.init).toHaveBeenCalledWith(
      'phc_public_test',
      expect.objectContaining({
        api_host: 'https://eu.i.posthog.com',
        cookieless_mode: 'always',
        person_profiles: 'identified_only',
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        disable_session_recording: true,
        capture_heatmaps: false,
        enable_heatmaps: false,
        disable_surveys: true,
        disable_surveys_automatic_display: true,
        advanced_disable_feature_flags: true,
        advanced_disable_feature_flags_on_first_load: true,
        advanced_disable_flags: true,
        advanced_disable_decide: true,
        capture_exceptions: false,
        capture_performance: false,
        enable_recording_console_log: false,
        logs: { captureConsoleLogs: false },
        disable_persistence: true,
        save_referrer: false,
        respect_dnt: true,
        request_batching: false,
      }),
    );
    expect(provider.capture.mock.calls).toEqual(
      allowedEvents.map((event) => [
        event.name,
        event.properties,
        { transport: 'sendBeacon' },
      ]),
    );
    expect(provider.identify).not.toHaveBeenCalled();
  });

  it('sends every event through a transport that survives navigation', async () => {
    const provider = createProvider();
    const adapter = createAnalyticsAdapter({
      key: 'phc_public_test',
      host: 'https://eu.i.posthog.com',
      loadProvider: async () => provider,
      doNotTrack: false,
      currentUrl: 'https://gumarov.com/en/',
    });

    adapter.capture({
      name: 'language_changed',
      properties: { from: 'en', to: 'ru' },
    });

    await vi.waitFor(() => expect(provider.capture).toHaveBeenCalledTimes(1));
    expect(provider.capture).toHaveBeenCalledWith(
      'language_changed',
      { from: 'en', to: 'ru' },
      { transport: 'sendBeacon' },
    );
  });

  it.each([
    {
      name: 'landing_viewed',
      properties: {
        locale: 'en',
        viewport: 'mobile',
        referrer: 'direct',
        email: 'hi@gumarov.com',
      },
    },
    {
      name: 'project_viewed',
      properties: { slug: 'unknown', locale: 'en' },
    },
    {
      name: 'contact_clicked',
      properties: { channel: 'telegram', section: 'unknown', locale: 'en' },
    },
    { name: 'pageview', properties: {} },
    null,
  ])('rejects malformed or expanded payload %#', async (event) => {
    const provider = createProvider();
    const adapter = createAnalyticsAdapter({
      key: 'phc_public_test',
      host: 'https://eu.i.posthog.com',
      loadProvider: async () => provider,
      doNotTrack: false,
      currentUrl: 'https://gumarov.com/en/',
    });

    expect(adapter.capture(event)).toBe(false);
    await Promise.resolve();
    expect(provider.init).not.toHaveBeenCalled();
    expect(provider.capture).not.toHaveBeenCalled();
  });

  it.each([
    { key: undefined, host: 'https://eu.i.posthog.com' },
    { key: 'phc_public_test', host: undefined },
    { key: '', host: 'https://eu.i.posthog.com' },
    { key: 'phc_public_test', host: 'https://us.i.posthog.com' },
  ])('stays inert for absent or non-EU configuration %#', async (config) => {
    const provider = createProvider();
    const loadProvider = vi.fn(async () => provider);
    const adapter = createAnalyticsAdapter({
      ...config,
      loadProvider,
      doNotTrack: false,
      currentUrl: 'https://gumarov.com/en/',
    });

    expect(adapter.capture(allowedEvents[0])).toBe(true);
    await Promise.resolve();
    expect(loadProvider).not.toHaveBeenCalled();
  });

  it('respects Do Not Track before loading the provider', async () => {
    const provider = createProvider();
    const loadProvider = vi.fn(async () => provider);
    const adapter = createAnalyticsAdapter({
      key: 'phc_public_test',
      host: 'https://eu.i.posthog.com',
      loadProvider,
      doNotTrack: true,
      currentUrl: 'https://gumarov.com/en/',
    });

    expect(adapter.capture(allowedEvents[0])).toBe(true);
    await Promise.resolve();
    expect(loadProvider).not.toHaveBeenCalled();
  });

  it('contains initialization and capture failures', async () => {
    const initFailure = createProvider();
    initFailure.init.mockImplementation(() => {
      throw new Error('blocked during init');
    });
    const captureFailure = createProvider();
    captureFailure.capture.mockImplementation(() => {
      throw new Error('blocked during capture');
    });

    const initAdapter = createAnalyticsAdapter({
      key: 'phc_public_test',
      host: 'https://eu.i.posthog.com',
      loadProvider: async () => initFailure,
      doNotTrack: false,
      currentUrl: 'https://gumarov.com/en/',
    });
    const captureAdapter = createAnalyticsAdapter({
      key: 'phc_public_test',
      host: 'https://eu.i.posthog.com',
      loadProvider: async () => captureFailure,
      doNotTrack: false,
      currentUrl: 'https://gumarov.com/en/',
    });

    expect(() => initAdapter.capture(allowedEvents[0])).not.toThrow();
    expect(() => captureAdapter.capture(allowedEvents[0])).not.toThrow();
    await vi.waitFor(() =>
      expect(captureFailure.capture).toHaveBeenCalledTimes(1),
    );
  });
});

describe('privacy sanitizers', () => {
  it.each([
    [
      'https://gumarov.com/en/?utm_source=private#contact',
      'https://gumarov.com/en/',
    ],
    ['https://gumarov.com/ru#email', 'https://gumarov.com/ru'],
    ['not a URL', ''],
  ])('reduces locations to origin plus pathname', (input, expected) => {
    expect(sanitizeLocation(input)).toBe(expected);
  });

  it.each([
    ['', 'direct'],
    ['https://l.instagram.com/?u=https%3A%2F%2Fgumarov.com', 'instagram'],
    ['https://www.google.com/search?q=rinat+email', 'search'],
    ['https://yandex.ru/search/?text=rinat', 'search'],
    ['https://t.co/private-path', 'social'],
    ['https://vk.com/id123', 'social'],
    ['https://example.com/users/rinat', 'other'],
    ['not a URL', 'other'],
  ] as const)('maps referrers to a closed category', (input, expected) => {
    expect(categorizeReferrer(input)).toBe(expected);
  });

  it.each([
    [390, 'mobile'],
    [767, 'mobile'],
    [768, 'tablet'],
    [1023, 'tablet'],
    [1024, 'desktop'],
  ] as const)('maps viewport width %s to %s', (width, expected) => {
    expect(getViewportClass(width)).toBe(expected);
  });

  it('drops non-allowlisted provider events and strips URL/referrer details', () => {
    const config = createPostHogConfig(
      'https://eu.i.posthog.com',
      'https://gumarov.com/en/?email=private%40example.com#telegram',
    );
    const beforeSend = config.before_send;
    if (typeof beforeSend !== 'function') {
      throw new Error('Expected a single before_send privacy gate');
    }

    expect(
      beforeSend({
        event: '$pageview',
        properties: { $current_url: 'https://gumarov.com/en/?secret=1' },
      }),
    ).toBeNull();
    expect(
      beforeSend({
        event: 'landing_viewed',
        distinct_id: 'top-level-visitor-id',
        properties: {
          locale: 'en',
          viewport: 'desktop',
          referrer: 'search',
          token: 'phc_public_transport_token',
          $current_url: 'https://gumarov.com/en/?secret=1#email',
          $referrer: 'https://www.google.com/search?q=rinat+email',
          distinct_id: 'visitor-id',
          $lib: 'web',
          $lib_version: '1.0.0',
          $process_person_profile: false,
        },
      }),
    ).toEqual({
      event: 'landing_viewed',
      properties: {
        locale: 'en',
        viewport: 'desktop',
        referrer: 'search',
        token: 'phc_public_transport_token',
        $current_url: 'https://gumarov.com/en/',
        $lib: 'web',
        $lib_version: '1.0.0',
        $process_person_profile: false,
      },
    });
  });
});

describe('analytics triggers', () => {
  it('captures one landing view only after the browser becomes idle', () => {
    let idleCallback: (() => void) | undefined;
    const adapter = { capture: vi.fn(() => true) };
    const schedule = createLandingViewScheduler(adapter, {
      requestIdleCallback: (callback) => {
        idleCallback = callback;
        return 1;
      },
      setTimeout: vi.fn(() => 1),
      viewportWidth: () => 390,
      referrer: () => 'https://l.instagram.com/private?campaign=secret',
    });

    schedule('en');
    schedule('en');

    expect(adapter.capture).not.toHaveBeenCalled();
    idleCallback?.();
    expect(adapter.capture).toHaveBeenCalledTimes(1);
    expect(adapter.capture).toHaveBeenCalledWith({
      name: 'landing_viewed',
      properties: {
        locale: 'en',
        viewport: 'mobile',
        referrer: 'instagram',
      },
    });
  });

  it('uses a non-blocking timer when idle callbacks are unavailable', () => {
    let timerCallback: (() => void) | undefined;
    const adapter = { capture: vi.fn(() => true) };
    const schedule = createLandingViewScheduler(adapter, {
      setTimeout: (callback) => {
        timerCallback = callback;
        return 1;
      },
      viewportWidth: () => 1280,
      referrer: () => '',
    });

    schedule('ru');
    expect(adapter.capture).not.toHaveBeenCalled();
    timerCallback?.();
    expect(adapter.capture).toHaveBeenCalledWith({
      name: 'landing_viewed',
      properties: {
        locale: 'ru',
        viewport: 'desktop',
        referrer: 'direct',
      },
    });
  });

  it('captures a project once only after at least 50% visibility', () => {
    const observer = installIntersectionObserver();
    const adapter = { capture: vi.fn(() => true) };
    const element = document.createElement('article');
    const disconnect = observeProjectViewOnce(
      element,
      {
        name: 'project_viewed',
        properties: { slug: 'splithub', locale: 'ru' },
      },
      adapter,
    );

    expect(observer.options).toEqual({ threshold: 0.5 });
    expect(observer.observe).toHaveBeenCalledWith(element);
    observer.emit(0.49);
    expect(adapter.capture).not.toHaveBeenCalled();
    observer.emit(0.5);
    observer.emit(1);
    expect(adapter.capture).toHaveBeenCalledTimes(1);
    expect(adapter.capture).toHaveBeenCalledWith({
      name: 'project_viewed',
      properties: { slug: 'splithub', locale: 'ru' },
    });
    expect(observer.disconnect).toHaveBeenCalledTimes(1);

    disconnect();
    expect(observer.disconnect).toHaveBeenCalledTimes(2);
  });

  it('does not infer a project view when IntersectionObserver is unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const adapter = { capture: vi.fn(() => true) };

    expect(() =>
      observeProjectViewOnce(
        document.createElement('article'),
        {
          name: 'project_viewed',
          properties: { slug: 'stoic', locale: 'en' },
        },
        adapter,
      ),
    ).not.toThrow();
    expect(adapter.capture).not.toHaveBeenCalled();
  });
});

function createProvider() {
  return {
    init: vi.fn<PostHogProvider['init']>(),
    capture: vi.fn<PostHogProvider['capture']>(),
    identify: vi.fn(),
  };
}

function installIntersectionObserver() {
  let callback: IntersectionObserverCallback | undefined;
  let options: IntersectionObserverInit | undefined;
  const observe = vi.fn();
  const disconnect = vi.fn();

  class Observer implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = '0px';
    readonly thresholds = [0.5];

    constructor(
      nextCallback: IntersectionObserverCallback,
      nextOptions?: IntersectionObserverInit,
    ) {
      callback = nextCallback;
      options = nextOptions;
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
    get options() {
      return options;
    },
    emit(intersectionRatio: number) {
      callback?.(
        [
          {
            isIntersecting: intersectionRatio > 0,
            intersectionRatio,
          } as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      );
    },
  };
}
