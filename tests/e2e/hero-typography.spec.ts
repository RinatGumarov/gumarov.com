import { expect, test, type Page } from '@playwright/test';

/*
 * 430 and 600 are not decoration. They sit inside the heading's fluid clamp,
 * where the phrase width is a fixed fraction of the column and a font a percent
 * wider than the last one flips the whole band from one line to two at once.
 * That is exactly where the Russian heading used to reflow when Onest arrived.
 */
const viewports = [
  { name: 'narrow-mobile', width: 320, height: 720 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'large-mobile', width: 430, height: 932 },
  { name: 'fluid-band', width: 600, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 1000 },
] as const;

const locales = ['en', 'ru'] as const;

/*
 * The three faces a heading can be rendered in, and every one of them is a
 * state a real visitor sees:
 *
 * - `firstPaint` is `--font-display` as `src/styles/tokens.css` declares it.
 *   Onest is banned from the inlined critical CSS (`scripts/check-dist.mjs`
 *   fails the build over it), so this is what the LCP heading paints in, and
 *   it is also what a visitor whose webfonts never arrive keeps.
 * - `metricFallback` is the size-adjusted face in `faces.css`. It covers the
 *   window between the brand stylesheet landing and the woff2 arriving.
 * - the brand face is Onest itself.
 *
 * All three have to agree about how many lines the heading takes, or the page
 * below it jumps when the visitor is already reading.
 */
const firstPaintStack = 'ui-sans-serif, system-ui, sans-serif';
const metricFallbackStack = '"Onest Fallback", ui-sans-serif, sans-serif';

/**
 * Waits until Onest is registered AND usable.
 *
 * `document.fonts.check()` answers `true` when no matching face is registered
 * at all, so it cannot by itself distinguish "loaded" from "never heard of it"
 * — with the `<link>` in the DOM but its stylesheet not yet parsed, a check-only
 * gate opens early. Confirming `--font-display` has picked up the value that
 * only `faces.css` sets proves the stylesheet is parsed and applied; `load()`
 * then fetches the face and `ready` settles the layout.
 */
async function waitForBrandFonts(page: Page) {
  await page.waitForFunction(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue('--font-display')
      .includes('Onest'),
  );
  await page.evaluate(async () => {
    await document.fonts.load('650 64px Onest');
    await document.fonts.ready;
  });
  await page.waitForFunction(() => document.fonts.check('650 64px Onest'));
}

/** Every word that was rendered across more than one line box. */
async function brokenWords(page: Page) {
  return page.evaluate(() => {
    const heading = document.querySelector('h1');
    if (!heading) {
      return ['<missing h1>'];
    }

    const broken: string[] = [];
    const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);

    for (
      let node = walker.nextNode();
      node !== null;
      node = walker.nextNode()
    ) {
      const text = node.textContent ?? '';
      const pattern = /\S+/g;

      for (
        let match = pattern.exec(text);
        match !== null;
        match = pattern.exec(text)
      ) {
        const range = document.createRange();
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        const lineTops = new Set(
          Array.from(range.getClientRects(), (rect) => Math.round(rect.top)),
        );
        if (lineTops.size > 1) {
          broken.push(match[0]);
        }
        range.detach();
      }
    }

    return broken;
  });
}

async function overflows(page: Page) {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
}

/** The family the heading actually resolved to, for asserting the font state. */
async function renderedFamily(page: Page) {
  return page.evaluate(() => {
    const heading = document.querySelector('h1');
    return heading ? getComputedStyle(heading).fontFamily : '';
  });
}

for (const locale of locales) {
  for (const viewport of viewports) {
    /*
     * The headline has to survive in Onest AND in the stack it falls back to.
     * Checking it only under Onest would leave a font-blocked visitor — and
     * every visitor, for the first moments of every visit — with no cover at
     * all, which is how a broken Russian headline would reach production
     * unnoticed.
     */
    for (const fonts of ['brand', 'blocked'] as const) {
      test(`keeps every ${locale} hero word on one line at ${viewport.name} (${fonts} fonts)`, async ({
        page,
      }) => {
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });

        if (fonts === 'blocked') {
          await page.route('**/assets/fonts/**', (route) => route.abort());
        }

        await page.goto(`/${locale}/`);
        await page.waitForLoadState('networkidle');

        if (fonts === 'brand') {
          await waitForBrandFonts(page);
          // Proves this case measures what it claims to.
          expect(await renderedFamily(page)).toMatch(/(^|\s)Onest(,|$)/u);
        } else {
          expect(await renderedFamily(page)).not.toMatch(/Onest/u);
        }

        // A word rendered across more than one line box was broken mid-word.
        // Russian headline words are long enough to trigger this whenever the
        // heading measure is narrower than the longest word.
        expect(
          await brokenWords(page),
          `hero words broken mid-word in ${locale} (${fonts} fonts)`,
        ).toEqual([]);

        expect(
          await overflows(page),
          `horizontal overflow in ${locale} (${fonts} fonts)`,
        ).toBe(false);
      });
    }

    test(`renders the ${locale} hero heading in Onest without moving it at ${viewport.name}`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto(`/${locale}/`);
      await page.waitForLoadState('networkidle');
      await waitForBrandFonts(page);

      const heading = page.locator('h1#hero-heading');
      await expect(heading).toBeVisible();
      // Plan §7: the heading is Onest, not the permanent system stack it used
      // to be pinned to.
      await expect(heading).toHaveCSS('font-family', /(^|\s)Onest(,|$)/u);

      /*
       * Onest arrives after first paint, so whatever the heading measures in
       * the stacks it passes through on the way it has to measure in Onest
       * too — otherwise the swap reflows the whole page below the hero. All
       * three are measured here with the webfont already loaded, so this
       * compares the layouts rather than racing the network.
       *
       * The `metricFallback` row is the guard on `faces.css`'s `size-adjust`,
       * `ascent-override` and `descent-override`: those numbers exist for
       * exactly this comparison, and without it they could drift back to a
       * face 8% narrower than Onest with the suite still green.
       */
      const heights = await heading.evaluate(
        (element, stacks) => {
          const h1 = element as HTMLElement;
          const measure = (family: string) => {
            h1.style.fontFamily = family;
            return h1.getBoundingClientRect().height;
          };
          const firstPaint = measure(stacks.firstPaint);
          const metricFallback = measure(stacks.metricFallback);
          h1.style.fontFamily = '';
          const brand = h1.getBoundingClientRect().height;
          return { firstPaint, metricFallback, brand };
        },
        { firstPaint: firstPaintStack, metricFallback: metricFallbackStack },
      );

      expect(
        Math.abs(heights.brand - heights.firstPaint),
        `the hero heading changes height by ${Math.round(
          heights.brand - heights.firstPaint,
        )}px between the first-paint stack and Onest (${locale}, ${viewport.name})`,
      ).toBeLessThanOrEqual(1);

      expect(
        Math.abs(heights.brand - heights.metricFallback),
        `the hero heading changes height by ${Math.round(
          heights.brand - heights.metricFallback,
        )}px between the metric-adjusted fallback face and Onest (${locale}, ${viewport.name}) — check the size-adjust in public/assets/fonts/faces.css`,
      ).toBeLessThanOrEqual(1);
    });
  }
}
