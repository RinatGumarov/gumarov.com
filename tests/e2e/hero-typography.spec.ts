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
 * Waits until Onest is loaded and the layout has settled on it.
 *
 * `document.fonts.check()` answers `true` when no matching face is registered
 * at all, so it cannot by itself distinguish "loaded" from "never heard of it".
 * Here the face is declared in the inlined CSS of every document, so it is
 * always registered and the check does mean loaded; `load()` asks for the
 * heading's own weight and `ready` settles the layout around it.
 */
async function waitForBrandFonts(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.load('650 64px Onest');
    await document.fonts.ready;
  });
  await page.waitForFunction(() => document.fonts.check('650 64px Onest'));
}

/** Whether the Onest file itself arrived, as opposed to being merely declared. */
async function loadedOnest(page: Page) {
  return page.evaluate(() =>
    [...document.fonts].some(
      (face) => face.family === 'Onest' && face.status === 'loaded',
    ),
  );
}

/**
 * Every word the heading's measure could not hold on one line.
 *
 * A word misses in one of two ways, depending on how it is laid out. As
 * ordinary inline text it breaks, and is rendered across two line boxes. Given
 * a box of its own — which is what the entrance animation needs, and what the
 * heading's words get once motion is enabled — it cannot break, so it hangs
 * out of the heading's measure instead. Both are the same defect, the measure
 * being narrower than the word, and both are reported here: measuring only the
 * first would quietly stop testing anything the moment the words were wrapped.
 */
async function unfitWords(page: Page) {
  return page.evaluate(() => {
    const heading = document.querySelector('h1');
    if (!heading) {
      return ['<missing h1>'];
    }

    // The measure every word has to fit into. The heading has no padding, so
    // its content box is the line box the words are laid into.
    const measure = heading.clientWidth;
    const unfit: string[] = [];
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
        const rects = [...range.getClientRects()];
        const lineTops = new Set(rects.map((rect) => Math.round(rect.top)));
        const widest = Math.max(0, ...rects.map((rect) => rect.width));
        // A pixel of tolerance: the rects are fractional and the measure is
        // rounded, so an exactly-fitting word can read a hair over.
        if (lineTops.size > 1 || widest > measure + 1) {
          unfit.push(match[0]);
        }
        range.detach();
      }
    }

    return unfit;
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
          expect(await loadedOnest(page)).toBe(true);
        } else {
          // The stack is unchanged — Onest is declared in the inlined CSS of
          // every document — so what tells the two cases apart is whether the
          // file behind it arrived. Here it must not have; the heading is
          // measured in the metric-adjusted local face instead.
          expect(await renderedFamily(page)).toMatch(/Onest Fallback/u);
          expect(await loadedOnest(page)).toBe(false);
        }

        // A word that does not fit the measure is either broken across two
        // lines or hanging out of the column. Russian headline words are long
        // enough to do one or the other whenever the heading measure is
        // narrower than the longest word.
        expect(
          await unfitWords(page),
          `hero words that do not fit the measure in ${locale} (${fonts} fonts)`,
        ).toEqual([]);

        expect(
          await overflows(page),
          `horizontal overflow in ${locale} (${fonts} fonts)`,
        ).toBe(false);
      });
    }
  }
}
