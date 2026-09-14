import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { getContent } from '../../src/content';
import { assertVisibleFocus, localePath, qualityLocales } from './quality';

const blockingImpacts = new Set(['serious', 'critical']);

/*
 * Phone and desktop only: the two layouts differ enough that contrast, target
 * size and landmark structure are worth checking in both, and the tablet
 * layout is the desktop one at a narrower measure.
 */
const viewports = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 1000 },
] as const;

for (const locale of qualityLocales) {
  for (const viewport of viewports) {
    test.describe(`${locale} ${viewport.name} accessibility`, () => {
      test.use({
        viewport: { width: viewport.width, height: viewport.height },
      });

      test('has no serious or critical axe violations', async ({ page }) => {
        await page.goto(localePath(locale));
        await settleHeroMotion(page);

        const results = await new AxeBuilder({ page })
          .withTags([
            'wcag2a',
            'wcag2aa',
            'wcag21a',
            'wcag21aa',
            'wcag22aa',
            'best-practice',
          ])
          .analyze();
        const blocking = results.violations.filter((violation) =>
          blockingImpacts.has(violation.impact ?? ''),
        );

        expect(blocking, formatViolations(blocking)).toEqual([]);

        const workCta = page.getByRole('link', {
          name: getContent(locale).hero.workCta,
        });
        await workCta.focus();
        await assertVisibleFocus(page);
      });
    });
  }
}

/** axe reads contrast off painted pixels, so the entry animation has to finish. */
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
          let current: Element | null = element;
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
