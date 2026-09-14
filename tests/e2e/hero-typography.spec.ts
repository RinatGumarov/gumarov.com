import { expect, test, type Page } from '@playwright/test';

/*
 * 430 and 600 are not decoration. They sit inside the heading's fluid clamp,
 * where the phrase width is a fixed fraction of the column and a font a percent
 * wider than the last one flips the whole band from one line to two at once.
 * That is exactly where the Russian heading used to reflow when Onest arrived.
 */
const viewports = [
  { name: 'narrow-mobile', width: 320, height: 720 },
  { name: 'large-mobile', width: 430, height: 932 },
  { name: 'fluid-band', width: 600, height: 900 },
  { name: 'desktop', width: 1440, height: 1000 },
] as const;

const locales = ['en', 'ru'] as const;

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
          // `'Onest Fallback'` stays in the stack — it is the metric-adjusted
          // local face, and having it here is the point. What must be absent
          // is the Onest webfont itself.
          expect(await renderedFamily(page)).not.toMatch(
            /\bOnest\b(?!\s+Fallback)/u,
          );
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
  }
}
