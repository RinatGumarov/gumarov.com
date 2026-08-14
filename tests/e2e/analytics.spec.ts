import { gunzipSync } from 'node:zlib';
import { expect, test, type Page, type Request } from '@playwright/test';

const analyticsHost = 'https://eu.i.posthog.com';
const analyticsKey = 'phc_playwright_public_transport_token';
const analyticsEventAllowlist = [
  'landing_viewed',
  'language_changed',
  'project_viewed',
  'contact_clicked',
] as const;
const providerPropertyAllowlist = [
  'token',
  '$current_url',
  '$lib',
  '$lib_version',
  '$process_person_profile',
  '$cookieless_mode',
] as const;

type AnalyticsEventName = (typeof analyticsEventAllowlist)[number];
type CapturedEvent = {
  event: AnalyticsEventName;
  properties: Record<string, unknown>;
  uuid: string;
};

test('blocked PostHog keeps the journey intact and sends only the privacy allowlist', async ({
  page: workingPage,
  context,
}) => {
  const workingAnalytics = await installAnalyticsEndpoint(
    workingPage,
    'fulfill',
  );
  const workingJourney = await exerciseJourney(workingPage, workingAnalytics);
  await workingPage.close();

  const blockedPage = await context.newPage();
  const blockedAnalytics = await installAnalyticsEndpoint(blockedPage, 'abort');
  const blockedJourney = await exerciseJourney(blockedPage, blockedAnalytics);

  expect(blockedJourney).toEqual(workingJourney);
  expect(blockedAnalytics.requests.length).toBeGreaterThan(0);
  expect(blockedAnalytics.unexpectedEndpoints).toEqual([]);
  expect(blockedAnalytics.events.length).toBeGreaterThanOrEqual(5);
  assertOutgoingAllowlist(blockedAnalytics.events);

  expect(blockedAnalytics.events).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        event: 'landing_viewed',
        properties: expect.objectContaining({
          locale: 'en',
          viewport: 'desktop',
          referrer: 'instagram',
        }),
      }),
      expect.objectContaining({
        event: 'project_viewed',
        properties: expect.objectContaining({
          slug: 'tradingview',
          locale: 'en',
        }),
      }),
      expect.objectContaining({
        event: 'contact_clicked',
        properties: expect.objectContaining({
          channel: 'telegram',
          section: 'contact',
          locale: 'en',
        }),
      }),
      expect.objectContaining({
        event: 'contact_clicked',
        properties: expect.objectContaining({
          channel: 'email',
          section: 'footer',
          locale: 'en',
        }),
      }),
      expect.objectContaining({
        event: 'language_changed',
        properties: { from: 'en', to: 'ru' },
      }),
    ]),
  );

  await blockedPage.close();
});

async function installAnalyticsEndpoint(
  page: Page,
  response: 'fulfill' | 'abort',
) {
  const requests: Request[] = [];
  const events: CapturedEvent[] = [];
  const unexpectedEndpoints: string[] = [];

  await page.route(`${analyticsHost}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname !== '/e/') {
      unexpectedEndpoints.push(request.url());
      await route.abort('blockedbyclient');
      return;
    }

    requests.push(request);
    events.push(...decodeCapturedEvents(request));
    if (response === 'fulfill') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{}',
      });
    } else {
      await route.abort('blockedbyclient');
    }
  });

  return { requests, events, unexpectedEndpoints };
}

async function exerciseJourney(
  page: Page,
  analytics: Awaited<ReturnType<typeof installAnalyticsEndpoint>>,
) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/en/?secret=must-not-leak#work', {
    referer: 'https://l.instagram.com/private/path?account=rinat#profile',
  });
  const initialJourney = await readCoreJourney(page);

  await expect
    .poll(() =>
      analytics.events.some((event) => event.event === 'landing_viewed'),
    )
    .toBe(true);

  const firstProject = page.locator('[data-project-slug="tradingview"]');
  await firstProject.scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      firstProject.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        const visibleHeight = Math.max(
          0,
          Math.min(bounds.bottom, window.innerHeight) - Math.max(bounds.top, 0),
        );
        return visibleHeight / bounds.height;
      }),
    )
    .toBeGreaterThanOrEqual(0.5);
  await expect
    .poll(() =>
      analytics.events.some(
        (event) =>
          event.event === 'project_viewed' &&
          event.properties.slug === 'tradingview',
      ),
    )
    .toBe(true);

  const heroContact = page.locator('[data-hero="landing"] a[href="#contact"]');
  const contactCountBeforeHeroNavigation = analytics.events.filter(
    (event) => event.event === 'contact_clicked',
  ).length;
  await heroContact.click();
  await expect(page).toHaveURL(/#contact$/u);
  await page.waitForTimeout(100);
  expect(
    analytics.events.filter((event) => event.event === 'contact_clicked'),
  ).toHaveLength(contactCountBeforeHeroNavigation);

  const contactTelegram = page
    .locator('#contact')
    .getByRole('link', { name: 'Telegram: @RinatGumarov' });
  await preventDefaultOnce(contactTelegram);
  await contactTelegram.click();
  await expect
    .poll(() =>
      analytics.events.some(
        (event) =>
          event.event === 'contact_clicked' &&
          event.properties.channel === 'telegram' &&
          event.properties.section === 'contact',
      ),
    )
    .toBe(true);

  const footerEmail = page
    .locator('footer')
    .getByRole('link', { name: 'Email: hi@gumarov.com' });
  await footerEmail.scrollIntoViewIfNeeded();
  await preventDefaultOnce(footerEmail);
  await footerEmail.click();
  await expect
    .poll(() =>
      analytics.events.some(
        (event) =>
          event.event === 'contact_clicked' &&
          event.properties.channel === 'email' &&
          event.properties.section === 'footer',
      ),
    )
    .toBe(true);

  await page.getByRole('link', { name: 'Русский' }).last().click();
  await expect(page.locator('main')).toHaveAttribute('data-locale', 'ru');
  await expect
    .poll(() =>
      analytics.events.some((event) => event.event === 'language_changed'),
    )
    .toBe(true);

  return {
    initial: initialJourney,
    final: await readCoreJourney(page),
    finalPath: new URL(page.url()).pathname,
  };
}

async function preventDefaultOnce(locator: ReturnType<Page['locator']>) {
  await locator.evaluate((element) => {
    element.addEventListener('click', (event) => event.preventDefault(), {
      once: true,
    });
  });
}

function decodeCapturedEvents(request: Request): CapturedEvent[] {
  const encoded = request.postDataBuffer();
  expect(
    encoded,
    'PostHog ingestion request must contain a body',
  ).not.toBeNull();
  if (!encoded) return [];

  const body =
    encoded[0] === 0x1f && encoded[1] === 0x8b
      ? gunzipSync(encoded).toString('utf8')
      : decodeUncompressedBody(encoded.toString('utf8'));
  const payload = JSON.parse(body) as {
    api_key: string;
    batch: CapturedEvent[];
    sent_at: string;
  };

  expect(Object.keys(payload).sort()).toEqual(['api_key', 'batch', 'sent_at']);
  expect(payload.api_key).toBe(analyticsKey);
  expect(payload.batch.length).toBeGreaterThan(0);
  return payload.batch;
}

function decodeUncompressedBody(body: string) {
  if (!body.startsWith('data=')) return body;
  const encodedData = new URLSearchParams(body).get('data');
  if (!encodedData) return '';

  const decodedData = encodedData;
  if (decodedData.startsWith('{') || decodedData.startsWith('[')) {
    return decodedData;
  }
  return Buffer.from(decodedData, 'base64').toString('utf8');
}

function assertOutgoingAllowlist(events: CapturedEvent[]) {
  const applicationProperties: Record<AnalyticsEventName, readonly string[]> = {
    landing_viewed: ['locale', 'viewport', 'referrer'],
    language_changed: ['from', 'to'],
    project_viewed: ['slug', 'locale'],
    contact_clicked: ['channel', 'section', 'locale'],
  };

  for (const event of events) {
    expect(Object.keys(event).sort()).toEqual(['event', 'properties', 'uuid']);
    expect(analyticsEventAllowlist).toContain(event.event);
    expect(event.uuid).toMatch(/^[0-9a-f-]+$/u);
    expect(Object.keys(event.properties).sort()).toEqual(
      [
        ...applicationProperties[event.event],
        ...providerPropertyAllowlist,
      ].sort(),
    );
    expect(event.properties.token).toBe(analyticsKey);
    expect(event.properties.$process_person_profile).toBe(false);
    expect(event.properties.$cookieless_mode).toBe(true);

    const currentUrl = new URL(String(event.properties.$current_url));
    expect(currentUrl.search).toBe('');
    expect(currentUrl.hash).toBe('');
    expect(['/en/', '/ru/']).toContain(currentUrl.pathname);

    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain('secret=must-not-leak');
    expect(serialized).not.toContain('l.instagram.com');
    expect(serialized).not.toContain('hi@gumarov.com');
    expect(serialized).not.toContain('@RinatGumarov');
    expect(serialized).not.toMatch(
      /distinct_id|\$device_id|\$session_id|\$window_id|\$referrer/iu,
    );
  }
}

async function readCoreJourney(page: Page) {
  return {
    locale: await page.locator('main').getAttribute('data-locale'),
    heading: await page.getByRole('heading', { level: 1 }).textContent(),
    projects: await page.locator('[data-project-slug]').count(),
    telegram: await page
      .getByRole('link', { name: /Telegram:/u })
      .first()
      .getAttribute('href'),
    email: await page
      .getByRole('link', { name: /Email:|Почта:/u })
      .first()
      .getAttribute('href'),
  };
}
