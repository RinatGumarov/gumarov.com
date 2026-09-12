import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { renderPageMetadata, siteUrl } from './page-metadata.mjs';

const checkerPath = path.resolve(process.cwd(), 'scripts/check-dist.mjs');
const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('distribution checker', () => {
  it('accepts a complete distribution', async () => {
    const fixture = await createDistributionFixture();

    const result = runChecker(fixture.distDirectory);

    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });

  /*
   * `pnpm test:e2e` rebuilds dist with a placeholder analytics key, so the
   * artifact that reaches Pages must never be that build.
   */
  it('rejects a distribution built with the Playwright analytics token', async () => {
    const fixture = await createDistributionFixture();
    await mkdir(path.join(fixture.distDirectory, 'assets'), {
      recursive: true,
    });
    await writeFile(
      path.join(fixture.distDirectory, 'assets/app.js'),
      'const key = "phc_playwright_public_transport_token";\n',
    );

    const result = runChecker(fixture.distDirectory);

    expect(result.stderr).toContain(
      'built with the Playwright placeholder analytics token',
    );
    expect(result.status).toBe(1);
  });

  it.each([
    ['visible copy', 'Contact body.', 'missing visible content'],
    ['a destination', 'https://t.me/RinatGumarov', 'missing destination'],
    ['alt text', 'Rinat riding a wave.', 'missing image alt text'],
  ])('fails when the page drops %s', async (_label, value, failure) => {
    const fixture = await createDistributionFixture({ omit: value });

    const result = runChecker(fixture.distDirectory);

    expect(result.stderr).toContain(failure);
    expect(result.status).toBe(1);
  });

  it('fails when a locale route carries the other locale’s metadata', async () => {
    const fixture = await createDistributionFixture({
      transformHtml: {
        'ru/index.html': (html) =>
          html.replace(
            `<link rel="canonical" href="${siteUrl}/ru/" />`,
            `<link rel="canonical" href="${siteUrl}/en/" />`,
          ),
      },
    });

    const result = runChecker(fixture.distDirectory);

    expect(result.stderr).toContain('ru/index.html: canonical is');
    expect(result.status).toBe(1);
  });

  it('fails on an unresolved prerender marker', async () => {
    const fixture = await createDistributionFixture({
      transformHtml: {
        'en/index.html': (html) =>
          html.replace('</main>', '<!--app-html--></main>'),
      },
    });

    const result = runChecker(fixture.distDirectory);

    expect(result.stderr).toContain(
      'en/index.html: unresolved prerender marker',
    );
    expect(result.status).toBe(1);
  });

  it('rejects a render-blocking external stylesheet', async () => {
    const fixture = await createDistributionFixture({
      head: {
        'en/index.html': '<link rel="stylesheet" href="/assets/late.css" />',
      },
    });

    const result = runChecker(fixture.distDirectory);

    expect(result.stderr).toContain(
      'en/index.html: render-blocking stylesheet /assets/late.css',
    );
    expect(result.status).toBe(1);
  });

  it('rejects a webfont preload in front of the LCP heading', async () => {
    const fixture = await createDistributionFixture({
      head: {
        'en/index.html':
          '<link rel="preload" as="font" type="font/woff2" href="/assets/fonts/Onest-Variable.woff2" crossorigin />',
      },
    });

    const result = runChecker(fixture.distDirectory);

    expect(result.stderr).toContain('do not preload webfonts');
    expect(result.status).toBe(1);
  });

  it.each([
    ['a style element', (css) => `<style>${css}</style>`],
    [
      'a data stylesheet',
      (css) =>
        `<link rel="stylesheet" media="print" href="data:text/css;base64,${Buffer.from(css).toString('base64')}" />`,
    ],
  ])(
    'rejects a downloaded webfont face inlined through %s',
    async (_label, wrap) => {
      const fixture = await createDistributionFixture({
        head: {
          'en/index.html': wrap(
            '@font-face{font-family:Onest;src:url("/assets/fonts/Onest-Variable.woff2") format("woff2")}',
          ),
        },
      });

      const result = runChecker(fixture.distDirectory);

      expect(result.stderr).toContain(
        'inlined CSS must not declare @font-face with a downloaded source',
      );
      expect(result.status).toBe(1);
    },
  );

  /*
   * The mirror of the rejections above. A face with only `local()` sources
   * downloads nothing and exists to stop the heading reflowing when the real
   * webfont lands, so the critical path is exactly where it belongs — and the
   * family check has to see past the fallback's name to the webfont itself.
   */
  it('allows a metric-adjusted fallback with only local sources inline', async () => {
    const fixture = await createDistributionFixture({
      head: {
        'en/index.html':
          "<style>@font-face{font-family:'Onest Fallback';src:local('Arial Bold');size-adjust:98.5%}</style>",
      },
    });

    const result = runChecker(fixture.distDirectory);

    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });

  it('charges a route for assets reached through its stylesheets', async () => {
    const fixture = await createDistributionFixture({
      head: { 'ru/index.html': '<style>@import "/assets/theme.css";</style>' },
    });
    const assets = path.join(fixture.distDirectory, 'assets');
    await mkdir(assets, { recursive: true });
    await writeFile(
      path.join(assets, 'theme.css'),
      '.hero { background-image: url("/assets/backdrop.bin"); }',
    );
    await writeFile(
      path.join(assets, 'backdrop.bin'),
      Buffer.alloc(701 * 1024, 7),
    );

    const result = runChecker(fixture.distDirectory);

    expect(result.stderr).toContain('ru/index.html: initial transfer is');
    expect(result.status).toBe(1);
  });

  it.each(['CNAME', '.nojekyll'])(
    'requires the GitHub Pages %s file',
    async (file) => {
      const fixture = await createDistributionFixture();
      await rm(path.join(fixture.distDirectory, file));

      const result = runChecker(fixture.distDirectory);

      expect(result.stderr).toContain(
        `Required Pages file is missing: ${file}`,
      );
      expect(result.status).toBe(1);
    },
  );
});

async function createDistributionFixture({
  omit,
  head = {},
  transformHtml = {},
} = {}) {
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'check-dist-'));
  temporaryDirectories.push(fixtureRoot);
  const distDirectory = path.join(fixtureRoot, 'dist');
  const serverDirectory = path.join(fixtureRoot, 'dist-ssr');

  await mkdir(path.join(distDirectory, 'en'), { recursive: true });
  await mkdir(path.join(distDirectory, 'ru'), { recursive: true });
  await mkdir(serverDirectory, { recursive: true });
  await writeFile(path.join(fixtureRoot, 'package.json'), '{"type":"module"}');
  await writeFile(path.join(distDirectory, 'CNAME'), 'gumarov.com\n');
  await writeFile(path.join(distDirectory, '.nojekyll'), '');

  const contentByLocale = { en: createContent('en'), ru: createContent('ru') };
  await writeFile(
    path.join(serverDirectory, 'entry-server.js'),
    `const content = ${JSON.stringify(contentByLocale)};\nexport function getContent(locale) { return content[locale]; }\n`,
  );

  const routes = [
    { file: 'index.html', locale: 'en', pathname: '/', root: true },
    { file: 'en/index.html', locale: 'en', pathname: '/en/' },
    { file: 'ru/index.html', locale: 'ru', pathname: '/ru/' },
  ];

  for (const route of routes) {
    const html = renderFixtureDocument({
      ...route,
      content: contentByLocale[route.locale],
      head: head[route.file] ?? '',
      omit,
    });
    await writeFile(
      path.join(distDirectory, route.file),
      transformHtml[route.file]?.(html) ?? html,
    );
  }

  return { distDirectory };
}

function createContent(locale) {
  const russian = locale === 'ru';

  return {
    meta: {
      title: russian ? 'Проверочная страница' : 'Fixture page',
      description: russian ? 'Описание страницы.' : 'Fixture description.',
      siteName: russian ? 'Проверочный сайт' : 'Fixture site',
      ogLocale: russian ? 'ru_RU' : 'en_US',
      ogAlternateLocale: russian ? 'en_US' : 'ru_RU',
      ogImage: russian ? '/og-ru.jpg' : '/og-en.jpg',
      ogImageAlt: russian ? 'Карточка.' : 'Social card.',
      socialCard: {
        name: russian ? 'Ринат Гумаров' : 'Rinat Gumarov',
        role: 'Senior Frontend Engineer',
        headline: russian ? 'Заголовок.' : 'Headline.',
        contact: 'gumarov.com',
      },
    },
    hero: {
      titleLines: russian
        ? ['Сложные интерфейсы.', 'Простые действия.']
        : ['Complex interfaces.', 'Effortless interactions.'],
      body: russian ? 'Текст героя.' : 'Hero body.',
    },
    projects: [
      {
        // Identifiers and discriminators are never page text, so the fixture
        // renders none of them and the checker must not demand them.
        slug: 'tradingview',
        variant: 'lead',
        media: 'screenshot',
        name: 'TradingView',
        href: 'https://www.tradingview.com/',
      },
    ],
    personal: {
      heading: russian ? 'Вне экрана' : 'Beyond the screen',
      photos: [{ slug: 'surf', alt: 'Rinat riding a wave.' }],
    },
    contact: {
      heading: russian ? 'Давайте поговорим' : 'Let’s talk',
      body: 'Contact body.',
      telegramHref: 'https://t.me/RinatGumarov',
      emailHref: 'mailto:hi@gumarov.com',
      emailAddress: 'hi@gumarov.com',
    },
  };
}

function renderFixtureDocument({
  locale,
  pathname,
  root,
  content,
  head,
  omit,
}) {
  const pageMetadata = renderPageMetadata({
    canonical: `${siteUrl}${pathname}`,
    content,
  }).join('');
  const bootstrap = root
    ? '<script data-root-locale-bootstrap>void 0;</script>'
    : '';
  const body = collectRenderables(content)
    .filter((entry) => entry.value !== omit)
    .map((entry) => {
      if (entry.kind === 'destination') {
        return `<a href="${entry.value}">${escapeHtml(entry.value)}</a>`;
      }
      if (entry.kind === 'alternative') {
        return `<img src="/assets/personal/surf-768.jpg" alt="${escapeHtml(entry.value)}" loading="lazy" />`;
      }
      return `<p>${escapeHtml(entry.value)}</p>`;
    })
    .join('');

  return `<!doctype html><html lang="${locale}"><head>${pageMetadata}${head}${bootstrap}</head><body><div id="root"><main>${body}</main></div></body></html>`;
}

/** Mirrors the checker's own view of the content model, minus `meta`. */
function collectRenderables(content, key = '', collected = []) {
  if (typeof content === 'string') {
    if (key === 'slug' || key === 'variant' || key === 'media')
      return collected;
    collected.push({
      kind:
        key === 'href' || key.endsWith('Href')
          ? 'destination'
          : key === 'alt'
            ? 'alternative'
            : 'visible',
      value: content,
    });
    return collected;
  }

  if (Array.isArray(content)) {
    for (const item of content) collectRenderables(item, key, collected);
    return collected;
  }

  if (content && typeof content === 'object') {
    for (const [childKey, child] of Object.entries(content)) {
      if (childKey === 'meta') continue;
      collectRenderables(child, childKey, collected);
    }
  }

  return collected;
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#x27;');
}

function runChecker(distDirectory) {
  return spawnSync(process.execPath, [checkerPath, distDirectory], {
    encoding: 'utf8',
  });
}
