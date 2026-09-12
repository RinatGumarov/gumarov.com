import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { getContent } from '../../src/content';
import {
  assertVisibleFocus,
  localePath,
  qualityLocales,
  qualityViewports,
} from './quality';

/*
 * axe is the assertion. `requiredRules` below pins the rules that have to have
 * actually run and passed, so a selector change or a rule that silently stops
 * applying cannot turn this suite green by covering nothing.
 */

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

      test('has no serious or critical axe violations', async ({ page }) => {
        await page.goto(localePath(locale));
        const content = getContent(locale);
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
        const executed = axeExecutedRuleIds(results);

        expect(blocking, formatViolations(blocking)).toEqual([]);

        for (const ruleId of requiredRules) {
          expect(executed, `axe never ran ${ruleId}`).toContain(ruleId);
          expect(
            results.violations.map((violation) => violation.id),
            `axe rule ${ruleId} failed`,
          ).not.toContain(ruleId);
        }

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

function axeExecutedRuleIds(
  results: Awaited<ReturnType<AxeBuilder['analyze']>>,
) {
  return [
    ...results.passes,
    ...results.violations,
    ...results.incomplete,
    ...results.inapplicable,
  ].map((rule) => rule.id);
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
