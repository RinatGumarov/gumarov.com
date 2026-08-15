import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { getContent } from '../../src/content';
import {
  assertVisibleFocus,
  localePath,
  qualityLocales,
  qualityViewports,
} from './quality';

const blockingImpacts = new Set(['serious', 'critical']);
const requiredRules = [
  'page-has-heading-one',
  'landmark-one-main',
  'region',
  'color-contrast',
  'target-size',
  'image-alt',
  'heading-order',
] as const;

for (const locale of qualityLocales) {
  for (const viewport of qualityViewports) {
    test.describe(`${locale} ${viewport.name} accessibility`, () => {
      test.use({
        viewport: { width: viewport.width, height: viewport.height },
      });

      test('has no serious or critical axe violations and keeps explicit structure', async ({
        page,
      }) => {
        await page.goto(localePath(locale));
        const content = getContent(locale);
        await settleHeroMotion(page);

        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze();
        const blocking = results.violations.filter((violation) =>
          blockingImpacts.has(violation.impact ?? ''),
        );

        expect(blocking, formatViolations(blocking)).toEqual([]);

        for (const ruleId of requiredRules) {
          expect(
            results.violations.map((violation) => violation.id),
            `axe rule ${ruleId} failed`,
          ).not.toContain(ruleId);
        }

        await assertSingleHeadingHierarchy(page, content.hero.title);
        await assertLandmarkOrder(page);
        await assertImageAlternativeText(page);
        await assertPrimaryTargetSizes(page, locale);

        const workCta = page.getByRole('link', { name: content.hero.workCta });
        await workCta.focus();
        await expect(workCta).toBeFocused();
        await assertVisibleFocus(page);
      });
    });
  }
}

async function settleHeroMotion(page: Page) {
  const heroCopy = page.locator(
    '[data-hero="landing"] [data-motion-enter="copy"]',
  );
  await heroCopy.evaluate(async (element) => {
    await Promise.all(
      element
        .getAnimations({ subtree: true })
        .map((animation) => animation.finished.catch(() => undefined)),
    );
  });
  await expect
    .poll(() =>
      heroCopy.evaluate((element) => {
        let opacity = 1;
        for (
          let current: HTMLElement | null = element;
          current;
          current = current.parentElement
        ) {
          opacity *= Number.parseFloat(getComputedStyle(current).opacity);
        }
        return opacity;
      }),
    )
    .toBeCloseTo(1, 2);
}

async function assertSingleHeadingHierarchy(page: Page, title: string) {
  const headings = await page
    .locator('h1, h2, h3, h4, h5, h6')
    .evaluateAll((elements) =>
      elements.map((element) => ({
        level: Number(element.tagName.slice(1)),
        text: (element.textContent ?? '').replace(/\s+/gu, ' ').trim(),
      })),
    );

  expect(headings.filter((heading) => heading.level === 1)).toHaveLength(1);
  expect(headings[0]).toEqual({ level: 1, text: title });

  let previousLevel = 1;
  for (const heading of headings) {
    expect(heading.level - previousLevel).toBeLessThanOrEqual(1);
    previousLevel = heading.level;
  }
}

async function assertLandmarkOrder(page: Page) {
  const landmarks = await page.evaluate(() => {
    const implicitRoles: Record<string, string> = {
      HEADER: 'banner',
      NAV: 'navigation',
      MAIN: 'main',
      FOOTER: 'contentinfo',
    };

    return [...document.querySelectorAll('header, nav, main, footer')].map(
      (element) =>
        element.getAttribute('role') ?? implicitRoles[element.tagName] ?? '',
    );
  });

  const bannerIndex = landmarks.indexOf('banner');
  const mainIndex = landmarks.indexOf('main');
  const contentinfoIndex = landmarks.indexOf('contentinfo');

  expect(bannerIndex).toBeGreaterThanOrEqual(0);
  expect(mainIndex).toBeGreaterThan(bannerIndex);
  expect(contentinfoIndex).toBeGreaterThan(mainIndex);
  expect(landmarks.filter((role) => role === 'main')).toHaveLength(1);
}

async function assertImageAlternativeText(page: Page) {
  const images = await page.locator('img').evaluateAll((elements) =>
    elements.map((element) => ({
      hasAlt: element.hasAttribute('alt'),
      alt: element.getAttribute('alt'),
      decorative: Boolean(element.closest('[aria-hidden="true"]')),
    })),
  );

  expect(images.length).toBeGreaterThan(0);
  expect(images.every((image) => image.hasAlt)).toBe(true);

  for (const image of images) {
    if (!image.decorative && image.alt) {
      expect(image.alt.trim().length).toBeGreaterThan(0);
    }
  }
}

async function assertPrimaryTargetSizes(page: Page, locale: 'en' | 'ru') {
  const content = getContent(locale);
  const targets = [
    page.getByRole('link', { name: 'Rinat Gumarov — home' }),
    page
      .getByRole('navigation', {
        name: locale === 'ru' ? 'Основная навигация' : 'Primary navigation',
      })
      .getByRole('link', { name: content.nav.work }),
    page.getByRole('link', { name: content.hero.workCta }),
    page
      .getByRole('link', {
        name: `${content.contact.telegramLabel}: ${content.contact.telegramHandle}`,
      })
      .first(),
  ];

  for (const target of targets) {
    const size = await target.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return { width: bounds.width, height: bounds.height };
    });
    expect(size.width).toBeGreaterThanOrEqual(24);
    expect(size.height).toBeGreaterThanOrEqual(24);
  }
}

function formatViolations(
  violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations'],
) {
  return violations
    .map(
      (violation) =>
        `${violation.id} (${violation.impact}): ${violation.nodes
          .map((node) => node.target.join(' '))
          .join(', ')}`,
    )
    .join('\n');
}
