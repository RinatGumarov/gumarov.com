import { expect, test, type Page } from '@playwright/test';
import { localePath, qualityLocales } from './quality';

/*
 * The page's promise, as something a test can hold: after the first paint no
 * text changes typeface or moves. Both faces are preloaded and declared
 * `font-display: optional`, which is what makes that true in the two cases
 * that exist — the file is there for the first frame, or it is not there in
 * time and the visit keeps the metric-matched fallback for good.
 *
 * Sampling runs in the page from the document's first moment rather than from
 * Playwright, because the change this is written against took about half a
 * second and a swap is only ever visible between two frames. A wall-clock wait
 * on this side would see the settled page and nothing else.
 */
const sampleIntervalMs = 50;
const sampleWindowMs = 3000;

/*
 * One element per thing the page can render: the heading and the paragraph are
 * the sans at its two sizes, the nav link and the eyebrow are the mono. The
 * eyebrow is the hero's second identity line; the nav link sits outside the
 * hero, so between them they cover a label that animates and one that does not.
 */
const watched = {
  heading: 'h1',
  paragraph: '[data-hero="landing"] p[data-motion-enter="subcopy"]',
  navigationLink: 'header nav a',
  eyebrow: '[data-motion-enter="portrait"] p:last-child',
} as const;

type Watched = keyof typeof watched;

interface Reading {
  /** The first family of the computed stack, which is the face being asked for. */
  family: string;
  /*
   * Geometry, as the two numbers a typeface change moves. `offsetWidth` and
   * `offsetTop` are taken rather than a client rect because the entrance
   * animation translates and scales these elements, and neither of these two
   * can see a transform: what they report is where the text would be if the
   * animation were over, which is the only thing a swap would alter.
   */
  width: number;
  top: number;
}

interface Sample {
  at: number;
  /** `null` until the element is parsed; the early samples run against an empty body. */
  readings: Record<Watched, Reading | null>;
  /** Whether each face is loaded — false while its file is still in flight. */
  loaded: { sans: boolean; mono: boolean };
}

async function sampleFontState(page: Page, path: string) {
  await page.addInitScript(
    ({ watched, intervalMs, windowMs }) => {
      const samples: unknown[] = [];
      Object.defineProperty(window, '__fontSamples', { value: samples });

      const read = () => {
        const readings: Record<string, unknown> = {};

        for (const [name, selector] of Object.entries(watched)) {
          const element = document.querySelector(selector);
          readings[name] =
            element instanceof HTMLElement
              ? {
                  family: (
                    getComputedStyle(element).fontFamily.split(',')[0] ?? ''
                  )
                    .trim()
                    .replaceAll(/^["']|["']$/gu, ''),
                  width: element.offsetWidth,
                  top: element.offsetTop,
                }
              : null;
        }

        samples.push({
          at: Math.round(performance.now()),
          readings,
          loaded: {
            sans: document.fonts.check('650 64px Onest'),
            mono: document.fonts.check('700 12px "IBM Plex Mono"'),
          },
        });

        if (samples.length * intervalMs < windowMs) {
          setTimeout(read, intervalMs);
        }
      };

      read();
    },
    {
      watched,
      intervalMs: sampleIntervalMs,
      windowMs: sampleWindowMs,
    },
  );

  await page.goto(path, { waitUntil: 'commit' });
  await expect
    .poll(
      () =>
        page.evaluate(
          () => (window as { __fontSamples?: unknown[] }).__fontSamples?.length,
        ),
      { timeout: sampleWindowMs * 3 },
    )
    .toBe(sampleWindowMs / sampleIntervalMs);

  return page.evaluate(
    () => (window as unknown as { __fontSamples: Sample[] }).__fontSamples,
  );
}

/**
 * Every moment one of the watched elements stopped looking like itself.
 *
 * Only the samples in which an element is present count: the first few run
 * before the body is parsed, and an element appearing is not an element
 * changing. After that the reading must hold for the rest of the window.
 */
function changes(samples: Sample[]) {
  const seen = new Map<Watched, Reading>();
  const found: string[] = [];

  for (const sample of samples) {
    for (const name of Object.keys(watched) as Watched[]) {
      const reading = sample.readings[name];
      if (!reading) continue;

      const first = seen.get(name);
      if (!first) {
        seen.set(name, reading);
        continue;
      }
      if (
        first.family === reading.family &&
        first.width === reading.width &&
        first.top === reading.top
      ) {
        continue;
      }

      found.push(
        `${sample.at}ms ${name}: ${format(first)} -> ${format(reading)}`,
      );
      seen.set(name, reading);
    }
  }

  const missing = (Object.keys(watched) as Watched[]).filter(
    (name) => !seen.has(name),
  );
  if (missing.length > 0) {
    found.push(`never rendered: ${missing.join(', ')}`);
  }

  return found;
}

function format({ family, width, top }: Reading) {
  return `${family}, ${width}px wide at ${top}px`;
}

for (const locale of qualityLocales) {
  test.describe(`${locale} typeface stability`, () => {
    test.use({ viewport: { width: 1440, height: 1000 } });

    test('keeps every face and every line where the first frame put them', async ({
      page,
    }) => {
      const samples = await sampleFontState(page, localePath(locale));

      expect(changes(samples)).toEqual([]);
      // Proves the run measured the page with its own faces rather than a
      // visit where both files quietly failed.
      expect(samples.at(-1)?.loaded).toEqual({ sans: true, mono: true });
    });

    test('keeps them where the first frame put them when the faces arrive late', async ({
      page,
    }) => {
      await page.route('**/*.woff2', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        await route.continue();
      });

      const samples = await sampleFontState(page, localePath(locale));

      /*
       * The delay is longer than the page takes to render, so the first frame
       * is drawn in the fallbacks; the files then land inside the sampling
       * window. Asserting both ends is what makes the run meaningful — without
       * the first the page might simply have been fast, without the second the
       * faces might never have arrived at all.
       */
      const rendered = samples.filter((sample) => sample.readings.heading);
      expect(rendered[0]?.loaded).toEqual({ sans: false, mono: false });
      expect(samples.at(-1)?.loaded).toEqual({ sans: true, mono: true });

      expect(changes(samples)).toEqual([]);
    });
  });
}
