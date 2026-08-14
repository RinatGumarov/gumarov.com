import { expect, test, type Page } from '@playwright/test';

const analyticsEventAllowlist = [
  'landing_viewed',
  'language_changed',
  'project_viewed',
  'contact_clicked',
] as const;

test('blocked analytics leaves the rendered journey unchanged and emits no extra events', async ({
  browser,
}) => {
  const baselinePage = await browser.newPage();
  await baselinePage.goto('/en/');
  const baseline = await readCoreJourney(baselinePage);
  await baselinePage.close();

  const blockedPage = await browser.newPage();
  const analyticsRequests: string[] = [];
  blockedPage.on('request', (request) => {
    if (/posthog/iu.test(request.url())) {
      analyticsRequests.push(request.postData() ?? '');
    }
  });
  await blockedPage.route(/posthog/iu, (route) =>
    route.abort('blockedbyclient'),
  );
  await blockedPage.goto('/en/');

  expect(await readCoreJourney(blockedPage)).toEqual(baseline);
  const telegram = blockedPage
    .getByRole('link', {
      name: 'Telegram: @RinatGumarov',
    })
    .first();
  const email = blockedPage
    .getByRole('link', {
      name: 'Email: hi@gumarov.com',
    })
    .first();
  await expect(telegram).toHaveAttribute('href', 'https://t.me/RinatGumarov');
  await expect(email).toHaveAttribute('href', 'mailto:hi@gumarov.com');
  await expect(
    blockedPage.getByRole('link', { name: 'Русский' }).first(),
  ).toHaveAttribute('href', '/ru/');

  for (const body of analyticsRequests) {
    for (const quotedEvent of body.matchAll(/"event"\s*:\s*"([^"]+)"/gu)) {
      expect(analyticsEventAllowlist).toContain(quotedEvent[1]);
    }
    expect(body).not.toMatch(/[?#](?:utm_|email|telegram|token|secret)/iu);
    expect(body).not.toContain('hi@gumarov.com');
    expect(body).not.toContain('@RinatGumarov');
  }
});

async function readCoreJourney(page: Page) {
  return {
    locale: await page.locator('main').getAttribute('data-locale'),
    heading: await page.getByRole('heading', { level: 1 }).textContent(),
    projects: await page.locator('[data-project-slug]').count(),
    telegram: await page
      .getByRole('link', { name: 'Telegram: @RinatGumarov' })
      .first()
      .getAttribute('href'),
    email: await page
      .getByRole('link', { name: 'Email: hi@gumarov.com' })
      .first()
      .getAttribute('href'),
  };
}
