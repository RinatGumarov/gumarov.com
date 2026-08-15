import { expect, test } from '@playwright/test';

const viewports = [
  { name: 'narrow-mobile', width: 320, height: 720 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 1000 },
] as const;

const locales = ['en', 'ru'] as const;

for (const locale of locales) {
  for (const viewport of viewports) {
    test(`keeps every ${locale} hero word on one line at ${viewport.name}`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto(`/${locale}/`);
      await page.waitForLoadState('networkidle');

      // A word rendered across more than one line box was broken mid-word.
      // Russian headline words are long enough to trigger this whenever the
      // heading measure is narrower than the longest word.
      const brokenWords = await page.evaluate(() => {
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
              Array.from(range.getClientRects(), (rect) =>
                Math.round(rect.top),
              ),
            );
            if (lineTops.size > 1) {
              broken.push(match[0]);
            }
            range.detach();
          }
        }

        return broken;
      });

      expect(brokenWords, `hero words broken mid-word in ${locale}`).toEqual(
        [],
      );

      const overflows = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      );
      expect(overflows, `horizontal overflow in ${locale}`).toBe(false);
    });
  }
}
