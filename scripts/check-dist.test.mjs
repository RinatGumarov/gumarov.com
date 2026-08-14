import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import sharp from 'sharp';

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
  it('requires every exact metadata-free portrait variant at its declared dimensions', async () => {
    const missingFixture = await createDistributionFixture();
    await rm(
      path.join(
        missingFixture.distDirectory,
        'assets/portrait/portrait-768.webp',
      ),
    );

    const missingResult = runChecker(missingFixture.distDirectory);

    expect(missingResult.stderr).toContain(
      'Required portrait asset is missing: assets/portrait/portrait-768.webp',
    );
    expect(missingResult.status).toBe(1);

    const dimensionsFixture = await createDistributionFixture();
    await sharp({
      create: {
        width: 20,
        height: 20,
        channels: 3,
        background: '#123456',
      },
    })
      .avif()
      .toFile(
        path.join(
          dimensionsFixture.distDirectory,
          'assets/portrait/portrait-1024.avif',
        ),
      );

    const dimensionsResult = runChecker(dimensionsFixture.distDirectory);

    expect(dimensionsResult.stderr).toContain(
      'Portrait asset assets/portrait/portrait-1024.avif is 20x20; expected 1024x1280.',
    );
    expect(dimensionsResult.status).toBe(1);

    const metadataFixture = await createDistributionFixture();
    await sharp({
      create: {
        width: 480,
        height: 600,
        channels: 3,
        background: '#123456',
      },
    })
      .jpeg()
      .withExif({ IFD0: { Make: 'Fixture Camera' } })
      .toFile(
        path.join(
          metadataFixture.distDirectory,
          'assets/portrait/portrait-480.jpg',
        ),
      );

    const metadataResult = runChecker(metadataFixture.distDirectory);

    expect(metadataResult.stderr).toContain(
      'Portrait asset assets/portrait/portrait-480.jpg contains EXIF metadata.',
    );
    expect(metadataResult.status).toBe(1);

    const iccFixture = await createDistributionFixture();
    await sharp({
      create: {
        width: 480,
        height: 600,
        channels: 3,
        background: '#123456',
      },
    })
      .jpeg()
      .withIccProfile('srgb')
      .toFile(
        path.join(iccFixture.distDirectory, 'assets/portrait/portrait-480.jpg'),
      );

    const iccResult = runChecker(iccFixture.distDirectory);

    expect(iccResult.stderr).toContain(
      'Portrait asset assets/portrait/portrait-480.jpg contains ICC metadata.',
    );
    expect(iccResult.status).toBe(1);

    const orientationFixture = await createDistributionFixture();
    await sharp({
      create: {
        width: 480,
        height: 600,
        channels: 3,
        background: '#123456',
      },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toFile(
        path.join(
          orientationFixture.distDirectory,
          'assets/portrait/portrait-480.jpg',
        ),
      );

    const orientationResult = runChecker(orientationFixture.distDirectory);

    expect(orientationResult.stderr).toContain(
      'Portrait asset assets/portrait/portrait-480.jpg contains orientation metadata.',
    );
    expect(orientationResult.status).toBe(1);
  });

  it('rejects unrelated metadata-free pixels that do not match the approved output manifest', async () => {
    const missingManifestFixture = await createDistributionFixture();
    await rm(
      path.join(
        missingManifestFixture.distDirectory,
        'assets/portrait/approved-manifest.json',
      ),
    );

    const missingManifestResult = runChecker(
      missingManifestFixture.distDirectory,
    );

    expect(missingManifestResult.stderr).toContain(
      'Approved portrait manifest is missing or invalid: assets/portrait/approved-manifest.json',
    );
    expect(missingManifestResult.status).toBe(1);

    const fixture = await createDistributionFixture();
    const assetPath = path.join(
      fixture.distDirectory,
      'assets/portrait/portrait-480.webp',
    );
    await sharp({
      create: {
        width: 480,
        height: 600,
        channels: 3,
        background: '#654321',
      },
    })
      .webp({ quality: 10 })
      .toFile(assetPath);

    const result = runChecker(fixture.distDirectory);

    expect(result.stderr).toContain(
      'Portrait asset assets/portrait/portrait-480.webp SHA-256 does not match the approved manifest.',
    );
    expect(result.status).toBe(1);
  });

  it('fails for omitted values across the built visible-content contract', async () => {
    const omittedRequirements = [
      { path: 'hero.body', value: 'Required contract-only sentence.' },
      { path: 'nav.about', value: 'About' },
      {
        path: 'projects[0].contribution',
        value: 'TradingView contribution',
      },
      { path: 'principles.items[0]', value: 'Working principle.' },
      { path: 'personal.body', value: 'Personal story.' },
      { path: 'contact.heading', value: 'Let’s talk' },
    ];
    const fixture = await createDistributionFixture({
      omittedValuesByRoute: {
        'en/index.html': new Set(
          omittedRequirements.map((requirement) => requirement.value),
        ),
      },
      extraEnglishHeroBody: 'Required contract-only sentence.',
    });

    const result = runChecker(fixture.distDirectory);

    for (const requirement of omittedRequirements) {
      expect(result.stderr).toContain(
        `en/index.html: missing visible content ${requirement.path} ${JSON.stringify(requirement.value)}`,
      );
    }
    expect(result.status).toBe(1);
  });

  it.each([
    {
      label: 'project',
      path: 'projects[0].href',
      destination: 'https://www.tradingview.com/',
    },
    {
      label: 'Telegram',
      path: 'contact.telegramHref',
      destination: 'https://t.me/RinatGumarov',
    },
    {
      label: 'email',
      path: 'contact.emailHref',
      destination: 'mailto:hi@gumarov.com',
    },
  ])(
    'requires the $label destination in an exact href attribute',
    async ({ path: contentPath, destination }) => {
      const fixture = await createDistributionFixture({
        transformHtmlByRoute: {
          'en/index.html': (html) =>
            replaceDestinationLinkWithUnrelatedText(html, destination),
        },
      });

      const result = runChecker(fixture.distDirectory);

      expect(result.stderr).toContain(
        `en/index.html: missing destination ${contentPath} href=${JSON.stringify(destination)}`,
      );
      expect(result.status).toBe(1);
    },
  );

  it('requires the visible email address in rendered text independently of mailto', async () => {
    const fixture = await createDistributionFixture({
      transformHtmlByRoute: {
        'en/index.html': (html) =>
          html
            .replace(
              '<a href="mailto:hi@gumarov.com">mailto:hi@gumarov.com</a>',
              '<a href="mailto:hi@gumarov.com">Email destination</a>',
            )
            .replace('<p>hi@gumarov.com</p>', ''),
      },
    });

    const result = runChecker(fixture.distDirectory);

    expect(result.stderr).toContain(
      'en/index.html: missing visible content contact.emailAddress "hi@gumarov.com"',
    );
    expect(result.status).toBe(1);
  });

  it('budgets actual image sources inside semantic hero markup regardless of path', async () => {
    const fixture = await createDistributionFixture({
      heroMarkup:
        '<picture><source srcset="/media/portrait-small.jpg 480w, /media/portrait-large.jpg 1024w" /><img src="/media/portrait-small.jpg" alt="" /></picture>',
    });
    const mediaDirectory = path.join(fixture.distDirectory, 'media');
    await mkdir(mediaDirectory, { recursive: true });
    await writeFile(
      path.join(mediaDirectory, 'portrait-large.jpg'),
      Buffer.alloc(301 * 1024),
    );
    await writeFile(
      path.join(mediaDirectory, 'portrait-small.jpg'),
      Buffer.alloc(10 * 1024),
    );

    const result = runChecker(fixture.distDirectory);

    expect(result.stderr).toContain(
      'Hero source media/portrait-large.jpg is 301.0 KiB; budget is 300.0 KiB.',
    );
    expect(result.status).toBe(1);
  });

  it('budgets responsive hero sources emitted by React SSR', async () => {
    const heroMarkup = renderToStaticMarkup(
      createElement(
        'picture',
        null,
        createElement('source', {
          srcSet:
            '/media/portrait-small.jpg 480w, /media/portrait-large.jpg 1024w',
        }),
        createElement('img', {
          src: '/media/portrait-small.jpg',
          alt: '',
        }),
      ),
    );
    expect(heroMarkup).toContain('srcSet=');

    const fixture = await createDistributionFixture({ heroMarkup });
    const mediaDirectory = path.join(fixture.distDirectory, 'media');
    await mkdir(mediaDirectory, { recursive: true });
    await writeFile(
      path.join(mediaDirectory, 'portrait-large.jpg'),
      Buffer.alloc(301 * 1024),
    );
    await writeFile(
      path.join(mediaDirectory, 'portrait-small.jpg'),
      Buffer.alloc(10 * 1024),
    );

    const result = runChecker(fixture.distDirectory);

    expect(result.stderr).toContain(
      'Hero source media/portrait-large.jpg is 301.0 KiB; budget is 300.0 KiB.',
    );
    expect(result.status).toBe(1);
  });

  it('accepts an embedded data-image hero fallback as an inline asset', async () => {
    const fallback =
      'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
    const fixture = await createDistributionFixture({
      heroMarkup: `<picture><source srcset="${fallback}" /><img src="${fallback}" alt="" /></picture>`,
    });

    const result = runChecker(fixture.distDirectory);

    expect(result.stderr).not.toContain('initial asset is missing');
    expect(result.stderr).not.toContain('Hero source is missing');
    expect(result.status).toBe(0);
  });

  it('still budgets local hero sources listed after an inline fallback', async () => {
    const fallback =
      'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
    const fixture = await createDistributionFixture({
      heroMarkup: `<picture><source srcset="${fallback} 1x, /media/portrait-large.jpg 2x" /><img src="${fallback}" alt="" /></picture>`,
    });
    const mediaDirectory = path.join(fixture.distDirectory, 'media');
    await mkdir(mediaDirectory, { recursive: true });
    await writeFile(
      path.join(mediaDirectory, 'portrait-large.jpg'),
      Buffer.alloc(301 * 1024),
    );

    const result = runChecker(fixture.distDirectory);

    expect(result.stderr).toContain(
      'Hero source media/portrait-large.jpg is 301.0 KiB; budget is 300.0 KiB.',
    );
    expect(result.status).toBe(1);
  });

  it('enforces each route transfer budget through recursive CSS dependencies', async () => {
    const fixture = await createDistributionFixture({
      headByRoute: {
        'ru/index.html': '<link rel="stylesheet" href="/assets/ru.css" />',
      },
    });
    const assetsDirectory = path.join(fixture.distDirectory, 'assets');
    const mediaDirectory = path.join(fixture.distDirectory, 'media');
    await mkdir(assetsDirectory, { recursive: true });
    await mkdir(mediaDirectory, { recursive: true });
    await writeFile(
      path.join(assetsDirectory, 'ru.css'),
      '@import url("/assets/nested.css");',
    );
    await writeFile(
      path.join(assetsDirectory, 'nested.css'),
      '.hero { background-image: url("/media/large-background.bin"); }',
    );
    await writeFile(
      path.join(mediaDirectory, 'large-background.bin'),
      Buffer.alloc(701 * 1024),
    );

    const result = runChecker(fixture.distDirectory);

    expect(result.stderr).toContain('ru/index.html: initial transfer is');
    expect(result.status).toBe(1);
  });
});

async function createDistributionFixture(options = {}) {
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'check-dist-'));
  temporaryDirectories.push(fixtureRoot);
  const distDirectory = path.join(fixtureRoot, 'dist');
  const serverDirectory = path.join(fixtureRoot, 'dist-ssr');
  await mkdir(path.join(distDirectory, 'en'), { recursive: true });
  await mkdir(path.join(distDirectory, 'ru'), { recursive: true });
  await mkdir(serverDirectory, { recursive: true });
  await writeFile(path.join(fixtureRoot, 'package.json'), '{"type":"module"}');
  await writeValidPortraitAssets(distDirectory);

  const contentByLocale = {
    en: createContent(
      'en',
      options.extraEnglishHeroBody ?? 'English fixture body.',
    ),
    ru: createContent('ru', 'Русский текст для проверочного документа.'),
  };

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
    const outputPath = path.join(distDirectory, route.file);
    let html = renderFixtureDocument({
      ...route,
      content: contentByLocale[route.locale],
      head: options.headByRoute?.[route.file] ?? '',
      heroMarkup: options.heroMarkup ?? '',
      omittedValues: options.omittedValuesByRoute?.[route.file] ?? new Set(),
    });
    html = options.transformHtmlByRoute?.[route.file]?.(html) ?? html;
    await writeFile(outputPath, html);
  }

  return { distDirectory };
}

async function writeValidPortraitAssets(distDirectory) {
  const portraitDirectory = path.join(distDirectory, 'assets/portrait');
  await mkdir(portraitDirectory, { recursive: true });
  const outputs = [];

  for (const width of [480, 768, 1024]) {
    for (const format of ['avif', 'webp', 'jpeg']) {
      const extension = format === 'jpeg' ? 'jpg' : format;
      const file = `portrait-${width}.${extension}`;
      const outputPath = path.join(portraitDirectory, file);
      await sharp({
        create: {
          width,
          height: width * 1.25,
          channels: 3,
          background: '#123456',
        },
      })
        .toFormat(format, { quality: 10 })
        .toFile(outputPath);
      const contents = await readFile(outputPath);
      outputs.push({
        file: `assets/portrait/${file}`,
        format,
        width,
        height: width * 1.25,
        bytes: contents.byteLength,
        sha256: createHash('sha256').update(contents).digest('hex'),
      });
    }
  }

  await writeFile(
    path.join(portraitDirectory, 'approved-manifest.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        source: {
          sha256:
            '82a737263a795f74b39bca2b78710cfdca336d8408566f458c8bb4e8c35d9310',
        },
        outputs,
      },
      null,
      2,
    )}\n`,
  );
}

function createContent(locale, heroBody) {
  const isRussian = locale === 'ru';
  return {
    meta: {
      title: isRussian ? 'Проверочная страница' : 'Fixture page',
      description: isRussian
        ? 'Описание проверочной страницы.'
        : 'Fixture page description.',
    },
    nav: {
      work: isRussian ? 'Проекты' : 'Work',
      about: isRussian ? 'Обо мне' : 'About',
      contact: isRussian ? 'Контакты' : 'Contact',
    },
    hero: {
      eyebrow: 'React · TypeScript',
      title: isRussian
        ? 'Senior Frontend Engineer, который создаёт амбициозные продукты.'
        : 'Senior Frontend Engineer building ambitious products.',
      body: heroBody,
      workCta: isRussian ? 'Смотреть проекты' : 'View work',
      contactCta: isRussian ? 'Связаться' : 'Contact me',
    },
    projectsHeading: isRussian ? 'Избранные проекты' : 'Selected work',
    projects: [
      ['tradingview', 'TradingView', 'https://www.tradingview.com/'],
      ['stoic', 'Stoic', 'https://stoic.ai/'],
      ['splithub', 'SplitHub', 'https://splithub.app/'],
      ['evercity', 'Evercity', 'https://evercity.io/'],
    ].map(([slug, name, href]) => ({
      slug,
      name,
      eyebrow: `${name} eyebrow`,
      summary: `${name} summary`,
      contribution: `${name} contribution`,
      href,
    })),
    principles: {
      heading: isRussian ? 'Как я работаю' : 'How I work',
      items: [isRussian ? 'Принцип работы.' : 'Working principle.'],
    },
    personal: {
      heading: isRussian ? 'Вне экрана' : 'Beyond the screen',
      body: isRussian ? 'Личный текст.' : 'Personal story.',
      items: [isRussian ? 'Сёрфинг' : 'Surfing'],
    },
    contact: {
      heading: isRussian ? 'Давайте поговорим' : 'Let’s talk',
      body: isRussian ? 'Контактный текст.' : 'Contact body.',
      telegramLabel: 'Telegram',
      telegramHref: 'https://t.me/RinatGumarov',
      telegramHandle: '@RinatGumarov',
      emailLabel: 'Email',
      emailHref: 'mailto:hi@gumarov.com',
      emailAddress: 'hi@gumarov.com',
    },
  };
}

function renderFixtureDocument({
  file,
  locale,
  pathname,
  root,
  content,
  head,
  heroMarkup,
  omittedValues,
}) {
  const visibleValues = collectVisibleStrings(content).filter(
    (value) => !omittedValues.has(value),
  );
  const renderedValues = visibleValues
    .map((value) =>
      /^(?:https?:|mailto:)/u.test(value)
        ? `<a href="${escapeHtml(value)}">${escapeHtml(value)}</a>`
        : `<p>${escapeHtml(value)}</p>`,
    )
    .join('');
  const bootstrap = root
    ? `<script data-root-locale-bootstrap>(()=>{if(window.location.pathname!=='/')return;let locale=null;try{locale=window.localStorage.getItem('preferred-locale')}catch{}if(locale!=='en'&&locale!=='ru'){const languages=Array.isArray(window.navigator.languages)?window.navigator.languages:[window.navigator.language];locale=languages.some((language)=>typeof language==='string'&&language.toLowerCase().startsWith('ru'))?'ru':'en'}if(locale==='ru')window.location.replace(\`/ru/\${window.location.search}\${window.location.hash}\`)})();</script>`
    : '';

  return `<!doctype html><html lang="${locale}"><head><title>${escapeHtml(content.meta.title)}</title><meta name="description" content="${escapeHtml(content.meta.description)}" /><link rel="canonical" href="https://gumarov.com${pathname}" /><link rel="alternate" hreflang="en" href="https://gumarov.com/en/" /><link rel="alternate" hreflang="ru" href="https://gumarov.com/ru/" /><link rel="alternate" hreflang="x-default" href="https://gumarov.com/" />${head}${bootstrap}</head><body><div id="root"><main data-fixture-route="${file}"><section data-hero>${heroMarkup}</section>${renderedValues}</main></div></body></html>`;
}

function collectVisibleStrings(content) {
  const { meta: _meta, ...visibleContent } = content;
  const values = [];
  visit(visibleContent, null, values);
  return values;
}

function visit(value, key, values) {
  if (typeof value === 'string') {
    if (key !== 'slug' && value !== '') values.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) visit(item, null, values);
    return;
  }
  if (value && typeof value === 'object') {
    for (const [childKey, childValue] of Object.entries(value)) {
      visit(childValue, childKey, values);
    }
  }
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#x27;');
}

function replaceDestinationLinkWithUnrelatedText(html, destination) {
  const escapedDestination = escapeHtml(destination);
  return html.replace(
    `<a href="${escapedDestination}">${escapedDestination}</a>`,
    `<span data-destination="${escapedDestination}">${escapedDestination}</span>`,
  );
}

function runChecker(distDirectory) {
  return spawnSync(process.execPath, [checkerPath, distDirectory], {
    encoding: 'utf8',
  });
}
