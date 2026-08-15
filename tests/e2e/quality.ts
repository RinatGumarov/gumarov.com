import { expect, type Page } from '@playwright/test';
import { getContent, type Locale } from '../../src/content';

export const qualityLocales = ['en', 'ru'] as const;

export const qualityViewports = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 1000 },
] as const;

export const projectHosts = [
  'https://www.tradingview.com/**',
  'https://stoic.ai/**',
  'https://splithub.app/**',
  'https://evercity.io/**',
] as const;

export function localePath(locale: Locale) {
  return `/${locale}/`;
}

export async function assertCoreContent(page: Page, locale: Locale) {
  const content = getContent(locale);

  await expect(page.locator('html')).toHaveAttribute('lang', locale);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    content.hero.title,
  );
  await expect(
    page.getByRole('heading', { name: content.projectsHeading }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: content.principles.heading }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: content.personal.heading }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: content.contact.heading }),
  ).toBeVisible();

  for (const project of content.projects) {
    await expect(
      page.getByRole('heading', { name: project.name }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: project.name }),
    ).toHaveAttribute('href', project.href);
  }

  const telegram = page.getByRole('link', {
    name: `${content.contact.telegramLabel}: ${content.contact.telegramHandle}`,
  });
  await expect(telegram.first()).toBeVisible();
  await expect(telegram.first()).toHaveAttribute(
    'href',
    content.contact.telegramHref,
  );
  await expect(
    page.getByText(content.contact.telegramHandle).first(),
  ).toBeVisible();

  const email = page.getByRole('link', {
    name: `${content.contact.emailLabel}: ${content.contact.emailAddress}`,
  });
  await expect(email.first()).toBeVisible();
  await expect(email.first()).toHaveAttribute(
    'href',
    content.contact.emailHref,
  );
  await expect(
    page.getByText(content.contact.emailAddress).first(),
  ).toBeVisible();
}

export async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return {
      clientWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
    };
  });

  expect(
    overflow.scrollWidth,
    `horizontal overflow of ${overflow.scrollWidth - overflow.clientWidth}px`,
  ).toBeLessThanOrEqual(overflow.clientWidth);
}

export async function assertVisibleFocus(page: Page) {
  const focused = page.locator(':focus-visible');
  await expect(focused).toHaveCSS('outline-style', 'solid');
  const outlineWidth = await focused.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).outlineWidth),
  );
  expect(outlineWidth).toBeGreaterThanOrEqual(2);
}
