import type { Locale, ProjectSlug } from '../content';

export type ViewportClass = 'mobile' | 'tablet' | 'desktop';
export type ReferrerCategory =
  'instagram' | 'search' | 'social' | 'direct' | 'other';
export type ContactChannel = 'telegram' | 'email';
export type ContactSection = 'hero' | 'contact' | 'footer';

export type AnalyticsEvent =
  | {
      name: 'landing_viewed';
      properties: {
        locale: Locale;
        viewport: ViewportClass;
        referrer: ReferrerCategory;
      };
    }
  | {
      name: 'language_changed';
      properties: { from: Locale; to: Locale };
    }
  | {
      name: 'project_viewed';
      properties: { slug: ProjectSlug; locale: Locale };
    }
  | {
      name: 'contact_clicked';
      properties: {
        channel: ContactChannel;
        section: ContactSection;
        locale: Locale;
      };
    };

type AnalyticsProperties = AnalyticsEvent['properties'];
type ProviderEvent = {
  event: string;
  properties?: Record<string, unknown>;
  [key: string]: unknown;
};

export interface PostHogConfig {
  api_host: string;
  person_profiles: 'identified_only';
  autocapture: false;
  capture_pageview: false;
  capture_pageleave: false;
  disable_session_recording: true;
  capture_heatmaps: false;
  enable_heatmaps: false;
  disable_surveys: true;
  disable_surveys_automatic_display: true;
  advanced_disable_feature_flags: true;
  advanced_disable_feature_flags_on_first_load: true;
  capture_exceptions: false;
  capture_performance: false;
  enable_recording_console_log: false;
  logs: { captureConsoleLogs: false };
  capture_dead_clicks: false;
  rageclick: false;
  disable_product_tours: true;
  disable_persistence: true;
  save_referrer: false;
  disable_capture_url_hashes: true;
  respect_dnt: true;
  request_batching: false;
  get_current_url: () => string;
  before_send: (event: ProviderEvent) => ProviderEvent | null;
}

export interface PostHogCaptureOptions {
  transport: 'sendBeacon';
}

export interface PostHogProvider {
  init(key: string, config: PostHogConfig): PostHogProvider | void;
  capture(
    name: AnalyticsEvent['name'],
    properties: AnalyticsProperties,
    options: PostHogCaptureOptions,
  ): void;
}

export interface AnalyticsAdapter {
  capture(event: unknown): boolean;
}

interface AnalyticsAdapterOptions {
  key?: string;
  host?: string;
  loadProvider?: () => Promise<PostHogProvider>;
  doNotTrack?: boolean;
  currentUrl?: string;
}

interface LandingRuntime {
  requestIdleCallback?: (callback: () => void) => number;
  setTimeout: (callback: () => void, delay: number) => number;
  viewportWidth: () => number;
  referrer: () => string;
}

const euPostHogHost = 'https://eu.i.posthog.com';
const locales = ['en', 'ru'] as const;
const viewportClasses = ['mobile', 'tablet', 'desktop'] as const;
const referrerCategories = [
  'instagram',
  'search',
  'social',
  'direct',
  'other',
] as const;
const projectSlugs = ['tradingview', 'stoic', 'splithub', 'evercity'] as const;
const contactChannels = ['telegram', 'email'] as const;
const contactSections = ['hero', 'contact', 'footer'] as const;
const safeProviderProperties = [
  'token',
  '$lib',
  '$lib_version',
  '$process_person_profile',
  /*
   * PostHog carries the distinct id inside `properties`. Stripping it left
   * every event without one, and the capture endpoint answers HTTP 200 and
   * then discards such events during ingestion — the deployed site recorded
   * nothing. The value is a random id that never leaves the page: persistence
   * is disabled, so it is regenerated on each load and identifies nobody.
   */
  'distinct_id',
] as const;

// Language and contact events fire while the browser is already leaving the
// page, which cancels an in-flight request. A beacon is the only transport the
// browser still delivers after the document unloads.
const navigationSafeTransport: PostHogCaptureOptions = {
  transport: 'sendBeacon',
};

export function createAnalyticsAdapter({
  key,
  host,
  loadProvider = loadPostHog,
  doNotTrack = browserDoNotTrack(),
  currentUrl = browserLocation(),
}: AnalyticsAdapterOptions): AnalyticsAdapter {
  const normalizedKey = key?.trim();
  const normalizedHost = normalizeHost(host);
  const enabled =
    Boolean(normalizedKey) && normalizedHost === euPostHogHost && !doNotTrack;
  let providerPromise: Promise<PostHogProvider | null> | undefined;

  const getProvider = () => {
    providerPromise ??= loadProvider()
      .then((provider) => {
        const initialized = provider.init(
          normalizedKey ?? '',
          createPostHogConfig(normalizedHost, currentUrl),
        );
        return initialized ?? provider;
      })
      .catch(() => null);

    return providerPromise;
  };

  return {
    capture(event: unknown) {
      if (!isAnalyticsEvent(event)) return false;
      if (!enabled) return true;

      const payload = cloneEvent(event);
      void getProvider()
        .then((provider) => {
          if (!provider) return;
          try {
            provider.capture(
              payload.name,
              payload.properties,
              navigationSafeTransport,
            );
          } catch {
            // Analytics is optional and must never affect the visitor journey.
          }
        })
        .catch(() => undefined);

      return true;
    },
  };
}

export function createPostHogConfig(
  host: string,
  currentUrl: string,
): PostHogConfig {
  const safeCurrentUrl = sanitizeLocation(currentUrl);

  return {
    api_host: normalizeHost(host),
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
    /*
     * `advanced_disable_decide` and `advanced_disable_flags` are deliberately
     * absent: they stop the SDK fetching its remote config, and without that
     * fetch it delivers no events at all. Flag evaluation stays disabled
     * through the two options above and through the project settings.
     */
    capture_exceptions: false,
    capture_performance: false,
    enable_recording_console_log: false,
    logs: { captureConsoleLogs: false },
    capture_dead_clicks: false,
    rageclick: false,
    disable_product_tours: true,
    disable_persistence: true,
    save_referrer: false,
    disable_capture_url_hashes: true,
    respect_dnt: true,
    request_batching: false,
    get_current_url: () => safeCurrentUrl,
    before_send: (event) => sanitizeProviderEvent(event, safeCurrentUrl),
  };
}

export function sanitizeLocation(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return `${url.origin}${url.pathname}`;
  } catch {
    return '';
  }
}

export function categorizeReferrer(value: string): ReferrerCategory {
  if (!value.trim()) return 'direct';

  try {
    const hostname = new URL(value).hostname.toLowerCase();
    if (matchesDomain(hostname, ['instagram.com'])) return 'instagram';
    if (
      matchesDomain(hostname, [
        'google.com',
        'bing.com',
        'yandex.ru',
        'yandex.com',
        'duckduckgo.com',
        'search.yahoo.com',
        'baidu.com',
      ])
    ) {
      return 'search';
    }
    if (
      matchesDomain(hostname, [
        't.co',
        'twitter.com',
        'x.com',
        'facebook.com',
        'linkedin.com',
        'vk.com',
        'telegram.org',
        't.me',
      ])
    ) {
      return 'social';
    }
  } catch {
    return 'other';
  }

  return 'other';
}

export function getViewportClass(width: number): ViewportClass {
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

export function createLandingViewScheduler(
  adapter: AnalyticsAdapter,
  runtime: LandingRuntime,
) {
  let scheduled = false;

  return (locale: Locale) => {
    if (scheduled) return;
    scheduled = true;
    const capture = () => {
      adapter.capture({
        name: 'landing_viewed',
        properties: {
          locale,
          viewport: getViewportClass(runtime.viewportWidth()),
          referrer: categorizeReferrer(runtime.referrer()),
        },
      });
    };

    try {
      if (runtime.requestIdleCallback) {
        runtime.requestIdleCallback(capture);
      } else {
        runtime.setTimeout(capture, 1);
      }
    } catch {
      // A broken scheduling API must not affect hydration or static content.
    }
  };
}

export function observeProjectViewOnce(
  element: Element,
  event: Extract<AnalyticsEvent, { name: 'project_viewed' }>,
  adapter: AnalyticsAdapter = browserAnalytics,
): () => void {
  if (
    typeof window === 'undefined' ||
    typeof window.IntersectionObserver !== 'function'
  ) {
    return () => undefined;
  }

  let captured = false;
  const observer = new window.IntersectionObserver(
    (entries) => {
      if (
        captured ||
        !entries.some(
          (entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5,
        )
      ) {
        return;
      }

      captured = true;
      adapter.capture(event);
      observer.disconnect();
    },
    { threshold: 0.5 },
  );
  observer.observe(element);

  return () => observer.disconnect();
}

const browserAnalytics = createAnalyticsAdapter({
  key: import.meta.env.VITE_POSTHOG_KEY,
  host: import.meta.env.VITE_POSTHOG_HOST,
});

const scheduleBrowserLandingView = createLandingViewScheduler(
  browserAnalytics,
  {
    requestIdleCallback:
      typeof window === 'undefined'
        ? undefined
        : window.requestIdleCallback?.bind(window),
    setTimeout: (callback, delay) => window.setTimeout(callback, delay),
    viewportWidth: () => window.innerWidth,
    referrer: () => document.referrer,
  },
);

export function trackAnalyticsEvent(event: AnalyticsEvent): void {
  try {
    browserAnalytics.capture(event);
  } catch {
    // Keep every render and navigation path independent from analytics.
  }
}

export function scheduleLandingViewed(locale: Locale): void {
  try {
    scheduleBrowserLandingView(locale);
  } catch {
    // Keep hydration independent from analytics and scheduling APIs.
  }
}

function sanitizeProviderEvent(
  event: ProviderEvent,
  safeCurrentUrl: string,
): ProviderEvent | null {
  const applicationProperties = pickApplicationProperties(
    event.event,
    event.properties,
  );
  if (!applicationProperties) return null;

  const providerProperties: Record<string, unknown> = {};
  for (const property of safeProviderProperties) {
    if (event.properties && property in event.properties) {
      providerProperties[property] = event.properties[property];
    }
  }

  return {
    event: event.event,
    properties: {
      ...applicationProperties,
      $current_url: safeCurrentUrl,
      ...providerProperties,
    },
  };
}

function pickApplicationProperties(
  name: string,
  properties: Record<string, unknown> | undefined,
): AnalyticsProperties | null {
  if (!properties) return null;

  const keysByEvent: Record<AnalyticsEvent['name'], readonly string[]> = {
    landing_viewed: ['locale', 'viewport', 'referrer'],
    language_changed: ['from', 'to'],
    project_viewed: ['slug', 'locale'],
    contact_clicked: ['channel', 'section', 'locale'],
  };
  if (!(name in keysByEvent)) return null;

  const eventName = name as AnalyticsEvent['name'];
  const picked = Object.fromEntries(
    keysByEvent[eventName].map((key) => [key, properties[key]]),
  );
  const candidate = { name: eventName, properties: picked };
  return isAnalyticsEvent(candidate) ? candidate.properties : null;
}

function isAnalyticsEvent(value: unknown): value is AnalyticsEvent {
  if (!isRecord(value) || typeof value.name !== 'string') return false;
  if (!isRecord(value.properties)) return false;

  switch (value.name) {
    case 'landing_viewed':
      return (
        hasExactKeys(value.properties, ['locale', 'viewport', 'referrer']) &&
        includes(locales, value.properties.locale) &&
        includes(viewportClasses, value.properties.viewport) &&
        includes(referrerCategories, value.properties.referrer)
      );
    case 'language_changed':
      return (
        hasExactKeys(value.properties, ['from', 'to']) &&
        includes(locales, value.properties.from) &&
        includes(locales, value.properties.to)
      );
    case 'project_viewed':
      return (
        hasExactKeys(value.properties, ['slug', 'locale']) &&
        includes(projectSlugs, value.properties.slug) &&
        includes(locales, value.properties.locale)
      );
    case 'contact_clicked':
      return (
        hasExactKeys(value.properties, ['channel', 'section', 'locale']) &&
        includes(contactChannels, value.properties.channel) &&
        includes(contactSections, value.properties.section) &&
        includes(locales, value.properties.locale)
      );
    default:
      return false;
  }
}

function cloneEvent(event: AnalyticsEvent): AnalyticsEvent {
  return {
    ...event,
    properties: { ...event.properties },
  } as AnalyticsEvent;
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index])
  );
}

function includes<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return typeof value === 'string' && values.includes(value as T);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function matchesDomain(hostname: string, domains: readonly string[]): boolean {
  return domains.some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
  );
}

function normalizeHost(host: string | undefined): string {
  return host?.trim().replace(/\/+$/u, '') ?? '';
}

function browserDoNotTrack(): boolean {
  if (typeof navigator === 'undefined') return false;
  return navigator.doNotTrack === '1';
}

function browserLocation(): string {
  return typeof window === 'undefined' ? '' : window.location.href;
}

async function loadPostHog(): Promise<PostHogProvider> {
  const module = await import('posthog-js/dist/module.slim');
  return module.default as unknown as PostHogProvider;
}
