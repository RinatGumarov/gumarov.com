import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

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
  it('fails for omitted values across the built visible-content contract', async () => {
    const omittedValues = [
      'Required contract-only sentence.',
      'About',
      'TradingView contribution',
      'Working principle.',
      'Personal story.',
      'Let’s talk',
    ];
    const fixture = await createDistributionFixture({
      omittedValuesByRoute: {
        'en/index.html': new Set(omittedValues),
      },
      extraEnglishHeroBody: 'Required contract-only sentence.',
    });

    const result = runChecker(fixture.distDirectory);

    for (const value of omittedValues) {
      expect(result.stderr).toContain(
        `en/index.html: missing visible content ${JSON.stringify(value)}`,
      );
    }
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
    const html = renderFixtureDocument({
      ...route,
      content: contentByLocale[route.locale],
      head: options.headByRoute?.[route.file] ?? '',
      heroMarkup: options.heroMarkup ?? '',
      omittedValues: options.omittedValuesByRoute?.[route.file] ?? new Set(),
    });
    await writeFile(outputPath, html);
  }

  return { distDirectory };
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

function runChecker(distDirectory) {
  return spawnSync(process.execPath, [checkerPath, distDirectory], {
    encoding: 'utf8',
  });
}
