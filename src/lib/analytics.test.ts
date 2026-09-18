import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  categorizeReferrer,
  createAnalyticsAdapter,
  createPostHogConfig,
  getViewportClass,
  landingReferrer,
  rootReferrerStorageKey,
  sanitizeLocation,
  type PostHogProvider,
} from './analytics';

const euHost = 'https://eu.i.posthog.com';

function providerSpy() {
  const capture = vi.fn();
  const init = vi.fn();
  const provider = { init, capture } as unknown as PostHogProvider;
  return { capture, init, provider };
}

function setDoNotTrack(value: string | null) {
  Object.defineProperty(navigator, 'doNotTrack', {
    configurable: true,
    get: () => value,
  });
}

function setReferrer(value: string) {
  Object.defineProperty(document, 'referrer', {
    configurable: true,
    get: () => value,
  });
}

afterEach(() => {
  setDoNotTrack(null);
  setReferrer('');
  window.sessionStorage.clear();
});

/*
 * `before_send` is the last thing that runs before an event leaves the
 * browser, and it rebuilds the event from an allowlist. Everything the SDK
 * might otherwise attach — session and device ids, referrers, autocaptured
 * element data — has to be gone by the time it returns.
 */
describe('before_send', () => {
  const send = (event: {
    event: string;
    properties?: Record<string, unknown>;
  }) =>
    createPostHogConfig(
      euHost,
      'https://gumarov.com/en/?utm=x#work',
    ).before_send(event);

  it('keeps only the declared properties of a known event', () => {
    expect(
      send({
        event: 'contact_clicked',
        properties: {
          channel: 'telegram',
          section: 'contact',
          locale: 'en',
          token: 'phc_test',
          distinct_id: 'abc',
          $session_id: 'session',
          $device_id: 'device',
          $referrer: 'https://l.instagram.com/private',
          $ip: '203.0.113.1',
        },
      }),
    ).toEqual({
      event: 'contact_clicked',
      properties: {
        channel: 'telegram',
        section: 'contact',
        locale: 'en',
        token: 'phc_test',
        distinct_id: 'abc',
        $current_url: 'https://gumarov.com/en/',
      },
    });
  });

  it('drops an event the page never declared', () => {
    expect(
      send({ event: '$autocapture', properties: { $el_text: 'Email' } }),
    ).toBeNull();
    expect(send({ event: '$pageview', properties: {} })).toBeNull();
  });
});

describe('analytics transport', () => {
  it('sends through a beacon so an unloading page still reports', async () => {
    const { capture, provider } = providerSpy();
    const adapter = createAnalyticsAdapter({
      key: 'phc_test',
      host: euHost,
      loadProvider: () => Promise.resolve(provider),
    });

    adapter.capture({
      name: 'language_changed',
      properties: { from: 'en', to: 'ru' },
    });
    await vi.waitFor(() => expect(capture).toHaveBeenCalledTimes(1));

    expect(capture).toHaveBeenCalledWith(
      'language_changed',
      { from: 'en', to: 'ru' },
      { transport: 'sendBeacon' },
    );
  });

  it.each([
    ['no key', { key: '', host: euHost }],
    [
      'a host outside the EU region',
      { key: 'phc_test', host: 'https://us.i.posthog.com' },
    ],
  ])('loads no provider with %s', async (_label, options) => {
    const loadProvider = vi.fn(() => Promise.resolve(providerSpy().provider));
    const adapter = createAnalyticsAdapter({ ...options, loadProvider });

    adapter.capture({
      name: 'project_viewed',
      properties: { slug: 'stoic', locale: 'en' },
    });
    await Promise.resolve();

    expect(loadProvider).not.toHaveBeenCalled();
  });

  it('loads no provider when the visitor sends Do Not Track', async () => {
    setDoNotTrack('1');
    const loadProvider = vi.fn(() => Promise.resolve(providerSpy().provider));
    const adapter = createAnalyticsAdapter({
      key: 'phc_test',
      host: euHost,
      loadProvider,
    });

    adapter.capture({
      name: 'language_changed',
      properties: { from: 'en', to: 'ru' },
    });
    await Promise.resolve();

    expect(loadProvider).not.toHaveBeenCalled();
  });
});

describe('property derivation', () => {
  it.each([
    ['https://gumarov.com/ru/?utm_source=x#contact', 'https://gumarov.com/ru/'],
    ['javascript:alert(1)', ''],
    ['not a url', ''],
  ])('reduces %s to a bare page URL', (input, expected) => {
    expect(sanitizeLocation(input)).toBe(expected);
  });

  it.each([
    ['https://l.instagram.com/private?account=rinat', 'instagram'],
    ['https://www.google.com/search?q=rinat+gumarov', 'search'],
    ['https://t.me/RinatGumarov', 'social'],
    ['https://example.com/blog', 'other'],
    ['', 'direct'],
  ])('buckets the referrer %s', (input, expected) => {
    expect(categorizeReferrer(input)).toBe(expected);
  });

  it.each([
    [390, 'mobile'],
    [768, 'tablet'],
    [1440, 'desktop'],
  ])('classifies a %ipx viewport', (width, expected) => {
    expect(getViewportClass(width)).toBe(expected);
  });
});

describe('landing attribution', () => {
  it('attributes a landing to the page it came from', () => {
    setReferrer('https://t.me/RinatGumarov');

    expect(landingReferrer()).toBe('https://t.me/RinatGumarov');
  });

  it('reports no landing for a page reached from the site itself', () => {
    setReferrer(`${window.location.origin}/en/#work`);

    expect(landingReferrer()).toBeNull();
  });

  it('uses the referrer handed over by the root redirect, once', () => {
    setReferrer(`${window.location.origin}/`);
    window.sessionStorage.setItem(
      rootReferrerStorageKey,
      'https://l.instagram.com',
    );

    expect(landingReferrer()).toBe('https://l.instagram.com');
    expect(landingReferrer()).toBeNull();
  });
});
