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
  | { name: 'language_changed'; properties: { from: Locale; to: Locale } }
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

interface ProviderEvent {
  event: string;
  properties?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface PostHogProvider {
  init(
    key: string,
    config: ReturnType<typeof createPostHogConfig>,
  ): PostHogProvider | void;
  capture(
    name: AnalyticsEvent['name'],
    properties: AnalyticsEvent['properties'],
    options: { transport: 'sendBeacon' },
  ): void;
}

export interface AnalyticsAdapter {
  capture(event: AnalyticsEvent): void;
}

const euPostHogHost = 'https://eu.i.posthog.com';

/**
 * The privacy contract: the only properties allowed to leave the browser.
 * `before_send` rebuilds every outgoing event from this list, so a property the
 * SDK starts adding — or one added to an event by mistake — is dropped rather
 * than sent. `tests/e2e/analytics.spec.ts` decodes the real payloads and holds
 * them to the same list.
 */
const allowedEventProperties: Record<
  AnalyticsEvent['name'],
  readonly string[]
> = {
  landing_viewed: ['locale', 'viewport', 'referrer'],
  language_changed: ['from', 'to'],
  project_viewed: ['slug', 'locale'],
  contact_clicked: ['channel', 'section', 'locale'],
};

const allowedProviderProperties = [
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
const navigationSafeTransport = { transport: 'sendBeacon' } as const;

export function createAnalyticsAdapter({
  key,
  host,
  loadProvider = loadPostHog,
}: {
  key?: string;
  host?: string;
  loadProvider?: () => Promise<PostHogProvider>;
}): AnalyticsAdapter {
  const normalizedKey = key?.trim();
  const normalizedHost = normalizeHost(host);
  const enabled =
    Boolean(normalizedKey) &&
    normalizedHost === euPostHogHost &&
    !browserDoNotTrack();
  let providerPromise: Promise<PostHogProvider | null> | undefined;

  const getProvider = () => {
    providerPromise ??= loadProvider()
      .then((provider) => {
        const initialized = provider.init(
          normalizedKey ?? '',
          createPostHogConfig(normalizedHost, browserLocation()),
        );
        return initialized ?? provider;
      })
      .catch(() => null);

    return providerPromise;
  };

  return {
    capture(event) {
      if (!enabled) return;

      void getProvider()
        .then((provider) => {
          try {
            provider?.capture(
              event.name,
              event.properties,
              navigationSafeTransport,
            );
          } catch {
            // Analytics is optional and must never affect the visitor journey.
          }
        })
        .catch(() => undefined);
    },
  };
}

export function createPostHogConfig(host: string, currentUrl: string) {
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
    before_send: (event: ProviderEvent) =>
      sanitizeProviderEvent(event, safeCurrentUrl),
  } as const;
}

/** Strips the query and the hash: a page URL, never what was typed into it. */
export function sanitizeLocation(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return `${url.origin}${url.pathname}`;
  } catch {
    return '';
  }
}

/** A referrer becomes one of five buckets; the URL itself is never sent. */
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

export function observeProjectViewOnce(
  element: Element,
  event: Extract<AnalyticsEvent, { name: 'project_viewed' }>,
  adapter: AnalyticsAdapter = browserAnalytics,
): () => void {
  if (typeof window.IntersectionObserver !== 'function') {
    return () => undefined;
  }

  const observer = new window.IntersectionObserver(
    (entries) => {
      if (
        !entries.some(
          (entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5,
        )
      ) {
        return;
      }

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

export function trackAnalyticsEvent(event: AnalyticsEvent): void {
  try {
    browserAnalytics.capture(event);
  } catch {
    // Keep every render and navigation path independent from analytics.
  }
}

/**
 * The root bootstrap in `index.html` sends Russian visitors on with
 * `location.replace`, which makes the root page itself their referrer. It
 * leaves the real referrer's origin here first; the landing reads it once.
 */
export const rootReferrerStorageKey = 'landing-referrer';

/**
 * The referrer a landing is attributed to, or `null` when the page was reached
 * from the site itself: a language switch is reported as `language_changed`,
 * not as a second arrival.
 */
export function landingReferrer(): string | null {
  const referrer = takeSessionItem(rootReferrerStorageKey) ?? document.referrer;
  return isSameOrigin(referrer) ? null : referrer;
}

let landingViewScheduled = false;

/** Reported once per arrival, off the critical path. */
export function scheduleLandingViewed(locale: Locale): void {
  if (landingViewScheduled) return;
  landingViewScheduled = true;

  const referrer = landingReferrer();
  if (referrer === null) return;

  const capture = () =>
    trackAnalyticsEvent({
      name: 'landing_viewed',
      properties: {
        locale,
        viewport: getViewportClass(window.innerWidth),
        referrer: categorizeReferrer(referrer),
      },
    });

  try {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(capture, { timeout: 2000 });
    } else {
      window.setTimeout(capture, 1);
    }
  } catch {
    // Keep hydration independent from analytics and scheduling APIs.
  }
}

function sanitizeProviderEvent(
  event: ProviderEvent,
  safeCurrentUrl: string,
): ProviderEvent | null {
  const allowed = allowedEventProperties[event.event as AnalyticsEvent['name']];
  if (!allowed || !event.properties) return null;

  const properties: Record<string, unknown> = { $current_url: safeCurrentUrl };
  for (const key of [...allowed, ...allowedProviderProperties]) {
    if (key in event.properties) properties[key] = event.properties[key];
  }

  return { event: event.event, properties };
}

function takeSessionItem(key: string): string | null {
  try {
    const value = window.sessionStorage.getItem(key);
    if (value !== null) window.sessionStorage.removeItem(key);
    return value;
  } catch {
    return null;
  }
}

function isSameOrigin(value: string): boolean {
  try {
    return new URL(value).origin === window.location.origin;
  } catch {
    return false;
  }
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
  return typeof navigator !== 'undefined' && navigator.doNotTrack === '1';
}

function browserLocation(): string {
  return typeof window === 'undefined' ? '' : window.location.href;
}

async function loadPostHog(): Promise<PostHogProvider> {
  const module = await import('posthog-js/dist/module.slim');
  return module.default as unknown as PostHogProvider;
}
