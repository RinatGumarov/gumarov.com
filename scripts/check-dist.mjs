import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import sharp from 'sharp';
import vm from 'node:vm';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const distDirectory = path.resolve(projectRoot, process.argv[2] ?? 'dist');
const siteUrl = 'https://gumarov.com';
const kibibyte = 1024;
const javascriptBudget = 150 * kibibyte;
const initialTransferBudget = 700 * kibibyte;
const heroSourceBudget = 300 * kibibyte;
const approvedPortraitSourceSha256 =
  '82a737263a795f74b39bca2b78710cfdca336d8408566f458c8bb4e8c35d9310';
const approvedPortraitManifestFile = 'assets/portrait/approved-manifest.json';
const approvedBrandManifestFile = 'assets/brand/approved-manifest.json';
const themeColor = '#080b0f';
const socialCardWidth = 1200;
const socialCardHeight = 630;
const socialCardBudget = 300 * kibibyte;
const iconBudget = 64 * kibibyte;
const webManifestFile = 'site.webmanifest';
const requiredBrandAssets = [
  { file: 'favicon.svg', vector: true, budget: 8 * kibibyte },
  {
    file: 'icon-192.png',
    metadataFormat: 'png',
    width: 192,
    height: 192,
    budget: iconBudget,
  },
  {
    file: 'icon-512.png',
    metadataFormat: 'png',
    width: 512,
    height: 512,
    budget: iconBudget,
  },
  {
    file: 'og-en.jpg',
    metadataFormat: 'jpeg',
    width: socialCardWidth,
    height: socialCardHeight,
    budget: socialCardBudget,
  },
  {
    file: 'og-ru.jpg',
    metadataFormat: 'jpeg',
    width: socialCardWidth,
    height: socialCardHeight,
    budget: socialCardBudget,
  },
];
const requiredPortraitAssets = [480, 768, 1024].flatMap((width) =>
  [
    { extension: 'avif', manifestFormat: 'avif', metadataFormat: 'heif' },
    { extension: 'webp', manifestFormat: 'webp', metadataFormat: 'webp' },
    { extension: 'jpg', manifestFormat: 'jpeg', metadataFormat: 'jpeg' },
  ].map(({ extension, manifestFormat, metadataFormat }) => ({
    file: `assets/portrait/portrait-${width}.${extension}`,
    manifestFormat,
    metadataFormat,
    width,
    height: Math.round(width * 1.25),
  })),
);
const approvedPersonalManifestFile = 'assets/personal/approved-manifest.json';
const personalSourceBudget = 120 * kibibyte;
const approvedPersonalSources = [
  {
    slug: 'surf',
    sha256: '52a7de95ba7da0e95f9ef9fd245e47723883ca912acbd678db16a740065023f4',
  },
  {
    slug: 'skate',
    sha256: '86ee2c416cea3a0cf1ab8560ba540e3c30592dae069aa0bbb6baa8dec0a3ad7f',
  },
  {
    slug: 'snowboard',
    sha256: '8fceebec257df1f33f90bbf553a269b40abc9e37bd190cd1c6826ed4543b0258',
  },
];
const requiredPersonalAssets = approvedPersonalSources.flatMap(({ slug }) =>
  [480, 768].flatMap((width) =>
    [
      { extension: 'avif', manifestFormat: 'avif', metadataFormat: 'heif' },
      { extension: 'webp', manifestFormat: 'webp', metadataFormat: 'webp' },
      { extension: 'jpg', manifestFormat: 'jpeg', metadataFormat: 'jpeg' },
    ].map(({ extension, manifestFormat, metadataFormat }) => ({
      file: `assets/personal/${slug}-${width}.${extension}`,
      manifestFormat,
      metadataFormat,
      width,
      height: Math.round((width * 3) / 4),
    })),
  ),
);
const routeContracts = [
  {
    file: 'index.html',
    locale: 'en',
    lang: 'en',
    canonical: `${siteUrl}/`,
    root: true,
  },
  {
    file: 'en/index.html',
    locale: 'en',
    lang: 'en',
    canonical: `${siteUrl}/en/`,
  },
  {
    file: 'ru/index.html',
    locale: 'ru',
    lang: 'ru',
    canonical: `${siteUrl}/ru/`,
  },
];
const failures = [];
const routeDocuments = new Map();
const heroSourcePaths = new Set();
const routeTransferBytes = new Map();
const missingAssetFailures = new Set();
const contentByLocale = new Map();

try {
  const serverEntryPath = path.join(
    path.dirname(distDirectory),
    'dist-ssr',
    'entry-server.js',
  );
  const serverEntry = await import(pathToFileURL(serverEntryPath).href);

  if (typeof serverEntry.getContent !== 'function') {
    throw new TypeError('getContent export is missing');
  }

  contentByLocale.set('en', serverEntry.getContent('en'));
  contentByLocale.set('ru', serverEntry.getContent('ru'));
} catch (error) {
  failures.push(`Unable to load the built content contract: ${String(error)}`);
}

for (const route of routeContracts) {
  const routePath = path.join(distDirectory, route.file);
  let html;

  try {
    html = await readFile(routePath, 'utf8');
  } catch {
    failures.push(`Missing route: ${route.file}`);
    continue;
  }

  routeDocuments.set(route.file, html);
  const content = contentByLocale.get(route.locale);
  const renderedDom = new JSDOM(html, { includeNodeLocations: true });
  const renderedDocument = renderedDom.window.document;
  const applicationRoot = renderedDocument.getElementById('root');
  const applicationRootLocation = applicationRoot
    ? renderedDom.nodeLocation(applicationRoot)
    : null;
  const applicationMarkup =
    applicationRootLocation?.startTag && applicationRootLocation.endTag
      ? html.slice(
          applicationRootLocation.startTag.endOffset,
          applicationRootLocation.endTag.startOffset,
        )
      : '';
  requireMatch(
    html,
    new RegExp(`<html[^>]*\\blang=["']${route.lang}["']`, 'u'),
    `${route.file}: expected html lang="${route.lang}"`,
  );
  if (content) {
    for (const [label, tag] of collectMetadataContracts(route, content)) {
      requireText(html, tag, `${route.file}: missing ${label}`);
    }

    validateStructuredData(route, html, content);
    validateScriptlessDocument(route.file, html, content);

    if (applicationRoot) {
      validateContentContract(
        route.file,
        applicationRoot,
        applicationMarkup,
        content,
      );
    }
  }

  if (!applicationRoot?.querySelector('main')) {
    failures.push(
      `${route.file}: server-rendered application markup is missing`,
    );
  }

  validateAccessibilityContract(route.file, renderedDocument);

  const heroMarkup = extractSemanticRegion(html, 'data-hero');
  if (heroMarkup === null) {
    failures.push(`${route.file}: semantic hero region is missing`);
  } else {
    for (const reference of collectImageReferences(heroMarkup)) {
      const heroSourcePath = resolveLocalAsset(reference, routePath);
      if (heroSourcePath) heroSourcePaths.add(heroSourcePath);
    }
  }

  if (html.includes('<!--app-html-->') || html.includes('<!--page-meta-->')) {
    failures.push(`${route.file}: unresolved prerender marker`);
  }

  validateRenderBlockingStylesheets(route.file, html);
  validateCriticalFonts(route.file, html);

  const hasRootBootstrap = html.includes('data-root-locale-bootstrap');
  if (route.root && !hasRootBootstrap) {
    failures.push(`${route.file}: missing root locale bootstrap`);
  }
  if (!route.root && hasRootBootstrap) {
    failures.push(
      `${route.file}: root locale bootstrap leaked into locale route`,
    );
  }

  renderedDom.window.close();
}

const rootDocument = routeDocuments.get('index.html');
if (rootDocument) {
  checkRootLocaleBootstrap(rootDocument);
}

const outputFiles = await listFiles(distDirectory);
const javascriptFiles = outputFiles.filter((file) => file.endsWith('.js'));
const compressedJavascriptBytes = await sumTransferredBytes(
  javascriptFiles,
  true,
);

if (compressedJavascriptBytes > javascriptBudget) {
  failures.push(
    `Compressed JavaScript is ${formatKib(compressedJavascriptBytes)}; budget is ${formatKib(javascriptBudget)}.`,
  );
}

for (const route of routeContracts) {
  const html = routeDocuments.get(route.file);
  if (!html) continue;

  const routePath = path.join(distDirectory, route.file);
  const initialAssetPaths = await collectInitialAssetPaths(
    html,
    routePath,
    route.file,
  );
  const initialTransferBytes =
    gzipSync(await readFile(routePath)).byteLength +
    (await sumRouteTransferredBytes(initialAssetPaths, route.file));
  routeTransferBytes.set(route.file, initialTransferBytes);

  if (initialTransferBytes > initialTransferBudget) {
    failures.push(
      `${route.file}: initial transfer is ${formatKib(initialTransferBytes)}; budget is ${formatKib(initialTransferBudget)}.`,
    );
  }
}

for (const file of heroSourcePaths) {
  let fileBytes;
  try {
    fileBytes = (await stat(file)).size;
  } catch {
    failures.push(
      `Hero source is missing: ${path.relative(distDirectory, file)}`,
    );
    continue;
  }

  if (fileBytes > heroSourceBudget) {
    failures.push(
      `Hero source ${path.relative(distDirectory, file)} is ${formatKib(fileBytes)}; budget is ${formatKib(heroSourceBudget)}.`,
    );
  }
}

await validateRequiredPortraitAssets();
await validateRequiredPersonalAssets();
await validateRequiredBrandAssets();
await validateWebManifest(contentByLocale.get('en'));
await validatePagesHostingFiles();
await validateInitialVisibility(
  outputFiles.filter((file) => file.endsWith('.css')),
);

if (failures.length > 0) {
  console.error('Distribution checks failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  const worstRoute = [...routeTransferBytes.entries()].sort(
    ([, leftBytes], [, rightBytes]) => rightBytes - leftBytes,
  )[0];
  const worstRouteSummary = worstRoute
    ? `${worstRoute[0]} ${formatKib(worstRoute[1])}`
    : 'unavailable';
  console.log(
    `Distribution checks passed: 3 routes, ${formatKib(compressedJavascriptBytes)} compressed JavaScript, worst initial transfer ${worstRouteSummary}.`,
  );
}

function requireText(source, expected, failure) {
  if (!source.includes(expected)) {
    failures.push(failure);
  }
}

function collectMetadataContracts(route, content) {
  const meta = content.meta;
  const socialImageUrl = `${siteUrl}${meta.ogImage}`;

  return [
    ['localized metadata title', `<title>${escapeHtml(meta.title)}</title>`],
    [
      'localized metadata description',
      `<meta name="description" content="${escapeHtmlAttribute(meta.description)}" />`,
    ],
    [
      `canonical ${route.canonical}`,
      `<link rel="canonical" href="${route.canonical}" />`,
    ],
    [
      'reciprocal English alternate',
      `<link rel="alternate" hreflang="en" href="${siteUrl}/en/" />`,
    ],
    [
      'reciprocal Russian alternate',
      `<link rel="alternate" hreflang="ru" href="${siteUrl}/ru/" />`,
    ],
    [
      'x-default alternate',
      `<link rel="alternate" hreflang="x-default" href="${siteUrl}/" />`,
    ],
    ['favicon', '<link rel="icon" href="/favicon.svg" type="image/svg+xml" />'],
    [
      'apple touch icon',
      '<link rel="apple-touch-icon" href="/icon-192.png" />',
    ],
    ['web app manifest', `<link rel="manifest" href="/${webManifestFile}" />`],
    ['theme colour', `<meta name="theme-color" content="${themeColor}" />`],
    ['og:type', '<meta property="og:type" content="website" />'],
    [
      'og:site_name',
      `<meta property="og:site_name" content="${escapeHtmlAttribute(meta.siteName)}" />`,
    ],
    ['og:locale', `<meta property="og:locale" content="${meta.ogLocale}" />`],
    [
      'og:locale:alternate',
      `<meta property="og:locale:alternate" content="${meta.ogAlternateLocale}" />`,
    ],
    ['og:url', `<meta property="og:url" content="${route.canonical}" />`],
    [
      'og:title',
      `<meta property="og:title" content="${escapeHtmlAttribute(meta.title)}" />`,
    ],
    [
      'og:description',
      `<meta property="og:description" content="${escapeHtmlAttribute(meta.description)}" />`,
    ],
    ['og:image', `<meta property="og:image" content="${socialImageUrl}" />`],
    ['og:image:type', '<meta property="og:image:type" content="image/jpeg" />'],
    [
      'og:image:width',
      `<meta property="og:image:width" content="${socialCardWidth}" />`,
    ],
    [
      'og:image:height',
      `<meta property="og:image:height" content="${socialCardHeight}" />`,
    ],
    [
      'og:image:alt',
      `<meta property="og:image:alt" content="${escapeHtmlAttribute(meta.ogImageAlt)}" />`,
    ],
    [
      'twitter:card',
      '<meta name="twitter:card" content="summary_large_image" />',
    ],
    [
      'twitter:title',
      `<meta name="twitter:title" content="${escapeHtmlAttribute(meta.title)}" />`,
    ],
    [
      'twitter:description',
      `<meta name="twitter:description" content="${escapeHtmlAttribute(meta.description)}" />`,
    ],
    [
      'twitter:image',
      `<meta name="twitter:image" content="${socialImageUrl}" />`,
    ],
    [
      'twitter:image:alt',
      `<meta name="twitter:image:alt" content="${escapeHtmlAttribute(meta.ogImageAlt)}" />`,
    ],
  ];
}

function validateRenderBlockingStylesheets(routeFile, html) {
  const assetTagPattern = /<(?:link)\b[^>]*>/gu;

  for (const tagMatch of html.matchAll(assetTagPattern)) {
    const tag = tagMatch[0];
    const linkRelations = new Set(
      (readHtmlAttribute(tag, 'rel') ?? '').toLowerCase().split(/\s+/u),
    );
    if (!linkRelations.has('stylesheet')) continue;

    const media = (readHtmlAttribute(tag, 'media') ?? 'all').toLowerCase();
    if (media === 'print') continue;

    const href = readHtmlAttribute(tag, 'href') ?? 'unknown';
    failures.push(`${routeFile}: render-blocking stylesheet ${href}`);
  }
}

function validateCriticalFonts(routeFile, html) {
  for (const css of collectDocumentCss(html)) {
    if (/@font-face\b/u.test(css)) {
      failures.push(`${routeFile}: inlined CSS must not declare @font-face`);
    }
    if (/\bOnest\b/u.test(css)) {
      failures.push(`${routeFile}: inlined CSS must not reference Onest`);
    }
  }

  const assetTagPattern = /<(?:link)\b[^>]*>/gu;
  for (const tagMatch of html.matchAll(assetTagPattern)) {
    const tag = tagMatch[0];
    const linkRelations = new Set(
      (readHtmlAttribute(tag, 'rel') ?? '').toLowerCase().split(/\s+/u),
    );
    const asValue = (readHtmlAttribute(tag, 'as') ?? '').toLowerCase();
    if (linkRelations.has('preload') && asValue === 'font') {
      failures.push(
        `${routeFile}: do not preload webfonts in front of the LCP heading`,
      );
    }
  }
}

function collectDocumentCss(html) {
  const cssChunks = [];
  const stylePattern = /<style\b[^>]*>([\s\S]*?)<\/style>/gu;
  for (const styleMatch of html.matchAll(stylePattern)) {
    cssChunks.push(styleMatch[1]);
  }

  const assetTagPattern = /<(?:link)\b[^>]*>/gu;
  for (const tagMatch of html.matchAll(assetTagPattern)) {
    const href = readHtmlAttribute(tagMatch[0], 'href') ?? '';
    const encoded = href.match(
      /^data:text\/css(?:;charset=utf-8)?;base64,([\s\S]+)$/iu,
    )?.[1];
    if (!encoded) continue;
    cssChunks.push(Buffer.from(encoded, 'base64').toString('utf8'));
  }

  return cssChunks;
}

function validateStructuredData(route, html, content) {
  const serialized = html.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/u,
  )?.[1];

  if (!serialized) {
    failures.push(`${route.file}: missing person structured data`);
    return;
  }

  let structuredData;
  try {
    structuredData = JSON.parse(serialized);
  } catch (error) {
    failures.push(
      `${route.file}: person structured data is not valid JSON (${String(error)})`,
    );
    return;
  }

  const expected = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: content.meta.socialCard.name,
    jobTitle: content.meta.socialCard.role,
    url: route.canonical,
    image: `${siteUrl}${content.meta.ogImage}`,
    sameAs: [content.contact.telegramHref],
  };

  for (const [key, value] of Object.entries(expected)) {
    if (JSON.stringify(structuredData[key]) !== JSON.stringify(value)) {
      failures.push(
        `${route.file}: person structured data ${key} is ${JSON.stringify(structuredData[key])}; expected ${JSON.stringify(value)}`,
      );
    }
  }
}

function validateAccessibilityContract(routeFile, document) {
  const skipLink = document.querySelector('a[href="#main-content"]');
  const skipTarget = document.getElementById('main-content');
  if (!skipLink || skipTarget?.tagName !== 'MAIN') {
    failures.push(`${routeFile}: missing skip link to #main-content`);
  }

  const headingOnes = document.querySelectorAll('h1');
  if (headingOnes.length !== 1) {
    failures.push(`${routeFile}: expected exactly one h1`);
  }

  const banner = document.querySelector('header, [role="banner"]');
  const main = document.querySelector('main, [role="main"]');
  const contentinfo = document.querySelector('footer, [role="contentinfo"]');

  if (!banner || !main || !isDocumentBefore(banner, main)) {
    failures.push(`${routeFile}: missing banner landmark before main`);
  }

  if (!contentinfo || !main || !isDocumentBefore(main, contentinfo)) {
    failures.push(`${routeFile}: missing contentinfo landmark after main`);
  }
}

function isDocumentBefore(earlier, later) {
  return Boolean(
    earlier.compareDocumentPosition(later) &
    earlier.DOCUMENT_POSITION_FOLLOWING,
  );
}

function validateScriptlessDocument(routeFile, html, content) {
  const scriptlessHtml = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, '')
    .replace(/<script\b[^>]*\/?>/giu, '');

  if (/<script\b/iu.test(scriptlessHtml)) {
    failures.push(`${routeFile}: script removal left executable markup`);
    return;
  }

  const scriptlessDom = new JSDOM(scriptlessHtml);
  const scriptlessDocument = scriptlessDom.window.document;
  const headings = new Set(
    [...scriptlessDocument.querySelectorAll('h1, h2, h3')].map((heading) =>
      normalizeText(heading.textContent ?? ''),
    ),
  );
  const bodyText = normalizeText(scriptlessDocument.body?.textContent ?? '');
  const destinations = new Set(
    [...scriptlessDocument.querySelectorAll('a[href]')].map((link) =>
      link.getAttribute('href'),
    ),
  );

  const requiredHeadings = [
    content.hero.title,
    content.projectsHeading,
    content.principles.heading,
    content.personal.heading,
    content.contact.heading,
    ...content.projects.map((project) => project.name),
  ];

  for (const heading of requiredHeadings) {
    const expected = normalizeText(heading);
    if (![...headings].some((rendered) => rendered.includes(expected))) {
      failures.push(
        `${routeFile}: heading ${JSON.stringify(heading)} is missing without JavaScript`,
      );
    }
  }

  const requiredContacts = [
    ['Telegram handle', content.contact.telegramHandle],
    ['email address', content.contact.emailAddress],
  ];
  for (const [label, value] of requiredContacts) {
    if (!bodyText.includes(normalizeText(value))) {
      failures.push(
        `${routeFile}: ${label} ${JSON.stringify(value)} is missing without JavaScript`,
      );
    }
  }

  const requiredDestinations = [
    ['Telegram link', content.contact.telegramHref],
    ['email link', content.contact.emailHref],
    ...content.projects.map((project) => [
      `${project.name} link`,
      project.href,
    ]),
  ];
  for (const [label, destination] of requiredDestinations) {
    if (!destinations.has(destination)) {
      failures.push(
        `${routeFile}: ${label} ${JSON.stringify(destination)} is missing without JavaScript`,
      );
    }
  }

  scriptlessDom.window.close();
}

async function validateRequiredBrandAssets() {
  const approvedManifest = await readApprovedBrandManifest();
  const approvedOutputs = new Map(
    Array.isArray(approvedManifest?.outputs)
      ? approvedManifest.outputs.map((output) => [output.file, output])
      : [],
  );

  if (approvedManifest && approvedManifest.schemaVersion !== 1) {
    failures.push(`${approvedBrandManifestFile}: expected schemaVersion 1.`);
  }
  if (
    approvedManifest &&
    approvedManifest.source?.sha256 !== approvedPortraitSourceSha256
  ) {
    failures.push(
      `${approvedBrandManifestFile}: source SHA-256 is not the pinned approved portrait source.`,
    );
  }
  if (
    approvedManifest &&
    (!Array.isArray(approvedManifest.outputs) ||
      approvedManifest.outputs.length !== requiredBrandAssets.length)
  ) {
    failures.push(
      `${approvedBrandManifestFile}: expected exactly ${requiredBrandAssets.length} approved outputs.`,
    );
  }

  for (const contract of requiredBrandAssets) {
    const assetPath = path.join(distDirectory, contract.file);
    const approvedOutput = approvedOutputs.get(contract.file);
    let contents;

    try {
      contents = await readFile(assetPath);
    } catch {
      failures.push(`Required brand asset is missing: ${contract.file}`);
      continue;
    }

    if (contents.byteLength > contract.budget) {
      failures.push(
        `Brand asset ${contract.file} is ${formatKib(contents.byteLength)}; budget is ${formatKib(contract.budget)}.`,
      );
    }
    if (!approvedOutput) {
      failures.push(
        `${approvedBrandManifestFile}: missing approved output ${contract.file}.`,
      );
    } else {
      if (approvedOutput.bytes !== contents.byteLength) {
        failures.push(
          `Brand asset ${contract.file} byte size does not match the approved manifest.`,
        );
      }
      const actualSha256 = createHash('sha256').update(contents).digest('hex');
      if (approvedOutput.sha256 !== actualSha256) {
        failures.push(
          `Brand asset ${contract.file} SHA-256 does not match the approved manifest.`,
        );
      }
    }

    if (contract.vector) {
      validateVectorIcon(contract.file, contents.toString('utf8'));
      continue;
    }

    let metadata;
    try {
      metadata = await sharp(contents).metadata();
    } catch (error) {
      failures.push(
        `Brand asset ${contract.file} could not be inspected: ${String(error)}`,
      );
      continue;
    }

    if (metadata.format !== contract.metadataFormat) {
      failures.push(
        `Brand asset ${contract.file} has format ${String(metadata.format)}; expected ${contract.metadataFormat}.`,
      );
    }
    if (
      metadata.width !== contract.width ||
      metadata.height !== contract.height
    ) {
      failures.push(
        `Brand asset ${contract.file} is ${String(metadata.width)}x${String(metadata.height)}; expected ${contract.width}x${contract.height}.`,
      );
    }
    for (const metadataType of ['exif', 'xmp', 'iptc', 'icc']) {
      if (metadata[metadataType] !== undefined) {
        failures.push(
          `Brand asset ${contract.file} contains ${metadataType.toUpperCase()} metadata.`,
        );
      }
    }
  }
}

function validateVectorIcon(file, markup) {
  if (!/^<svg\b[^>]*\bviewBox="[^"]+"/mu.test(markup)) {
    failures.push(`Brand asset ${file} has no <svg> root with a viewBox.`);
  }
  if (/<(?:script|foreignObject|image)\b/iu.test(markup)) {
    failures.push(`Brand asset ${file} embeds scripts or external content.`);
  }
  if (/\b(?:href|src)="(?:https?:)?\/\//iu.test(markup)) {
    failures.push(`Brand asset ${file} references a remote resource.`);
  }
}

async function validatePagesHostingFiles() {
  const pagesFiles = [
    {
      file: 'CNAME',
      validate(contents) {
        if (contents.trim() !== 'gumarov.com') {
          failures.push('CNAME must contain only gumarov.com');
        }
      },
    },
    { file: '.nojekyll' },
  ];

  for (const contract of pagesFiles) {
    try {
      const contents = await readFile(
        path.join(distDirectory, contract.file),
        'utf8',
      );
      contract.validate?.(contents);
    } catch {
      failures.push(`Required Pages file is missing: ${contract.file}`);
    }
  }
}

async function readApprovedBrandManifest() {
  try {
    return JSON.parse(
      await readFile(
        path.join(distDirectory, approvedBrandManifestFile),
        'utf8',
      ),
    );
  } catch (error) {
    failures.push(
      `Approved brand manifest is missing or invalid: ${approvedBrandManifestFile} (${String(error)}).`,
    );
    return null;
  }
}

async function validateWebManifest(content) {
  let manifest;
  try {
    manifest = JSON.parse(
      await readFile(path.join(distDirectory, webManifestFile), 'utf8'),
    );
  } catch (error) {
    failures.push(
      `Web app manifest is missing or invalid: ${webManifestFile} (${String(error)}).`,
    );
    return;
  }

  const requiredMembers = [
    ['name', (value) => value === content?.meta.title],
    ['short_name', (value) => value === content?.meta.siteName],
    ['description', (value) => value === content?.meta.description],
    ['lang', (value) => value === 'en'],
    ['dir', (value) => value === 'ltr'],
    ['start_url', (value) => value === '/'],
    ['scope', (value) => value === '/'],
    [
      'display',
      (value) =>
        ['browser', 'fullscreen', 'minimal-ui', 'standalone'].includes(value),
    ],
    ['background_color', (value) => value === themeColor],
    ['theme_color', (value) => value === themeColor],
  ];

  for (const [member, isValid] of requiredMembers) {
    if (!isValid(manifest[member])) {
      failures.push(
        `${webManifestFile}: member ${member} is ${JSON.stringify(manifest[member])}.`,
      );
    }
  }

  const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
  for (const size of [192, 512]) {
    const icon = icons.find(
      (candidate) => candidate?.sizes === `${size}x${size}`,
    );

    if (!icon) {
      failures.push(`${webManifestFile}: no ${size}x${size} icon is declared.`);
      continue;
    }
    if (icon.type !== 'image/png') {
      failures.push(
        `${webManifestFile}: the ${size}x${size} icon type is ${JSON.stringify(icon.type)}.`,
      );
    }

    const iconPath = resolveLocalAsset(
      icon.src,
      path.join(distDirectory, webManifestFile),
    );
    if (!iconPath) {
      failures.push(
        `${webManifestFile}: the ${size}x${size} icon src ${JSON.stringify(icon.src)} is not a local asset.`,
      );
      continue;
    }

    try {
      await stat(iconPath);
    } catch {
      failures.push(
        `${webManifestFile}: the ${size}x${size} icon file is missing: ${path.relative(distDirectory, iconPath)}`,
      );
    }
  }
}

async function validateInitialVisibility(cssFiles) {
  const motionRulePattern =
    /([^{}]*\[data-motion-(?:enter|reveal|sticky)[^{}]*)\{([^{}]*)\}/gu;

  for (const file of cssFiles) {
    let css;
    try {
      css = await readFile(file, 'utf8');
    } catch {
      failures.push(
        `Stylesheet is missing: ${path.relative(distDirectory, file)}`,
      );
      continue;
    }

    const styleRules = css.replace(
      /@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/gu,
      '',
    );

    validateHeroCopyLcpVisibility(css, path.relative(distDirectory, file));

    for (const rule of styleRules.matchAll(motionRulePattern)) {
      const selector = normalizeText(rule[1]);
      const declarations = rule[2];
      const hides =
        /(?:^|;)\s*opacity\s*:\s*0(?:\s|;|$)/u.test(declarations) ||
        /visibility\s*:\s*hidden/u.test(declarations) ||
        /display\s*:\s*none/u.test(declarations) ||
        /animation(?:-name)?\s*:\s*(?!none)/u.test(declarations) ||
        /position\s*:\s*sticky/u.test(declarations);

      if (hides && !selector.includes('data-motion-state')) {
        failures.push(
          `${path.relative(distDirectory, file)}: rule ${JSON.stringify(selector)} changes the initial state without the [data-motion-state='enabled'] gate.`,
        );
      }
    }
  }
}

function validateHeroCopyLcpVisibility(css, relativeFile) {
  const copyRules = css.matchAll(
    /([^{}]*\[data-motion-enter=(['"]?)copy\2\][^{]*)\{([^{}]*)\}/gu,
  );
  const keyframes = new Map(
    [...css.matchAll(/@keyframes\s+([\w-]+)\s*\{([\s\S]*?)\}/gu)].map(
      (match) => [match[1], match[2]],
    ),
  );

  for (const rule of copyRules) {
    const animation = rule[3].match(/animation(?:-name)?\s*:\s*([^;]+)/u)?.[1];
    if (!animation) continue;

    for (const token of animation.split(/[\s,]+/u)) {
      const frames = keyframes.get(token);
      if (frames && /(?:^|;|\{)\s*opacity\s*:\s*0(?:\s|;|$)/u.test(frames)) {
        failures.push(
          `${relativeFile}: hero copy animation ${JSON.stringify(token)} hides the LCP heading.`,
        );
      }
    }
  }
}

async function validateRequiredPortraitAssets() {
  await validateApprovedImageSet({
    label: 'Portrait',
    manifestFile: approvedPortraitManifestFile,
    contracts: requiredPortraitAssets,
    budget: heroSourceBudget,
    validateSources(manifest) {
      if (manifest.source?.sha256 !== approvedPortraitSourceSha256) {
        failures.push(
          `${approvedPortraitManifestFile}: source SHA-256 is not the pinned approved portrait source.`,
        );
      }
    },
  });
}

async function validateRequiredPersonalAssets() {
  await validateApprovedImageSet({
    label: 'Personal',
    manifestFile: approvedPersonalManifestFile,
    contracts: requiredPersonalAssets,
    budget: personalSourceBudget,
    validateSources(manifest) {
      const declared = new Map(
        Array.isArray(manifest.sources)
          ? manifest.sources.map((source) => [source.slug, source.sha256])
          : [],
      );
      for (const { slug, sha256: expected } of approvedPersonalSources) {
        if (declared.get(slug) !== expected) {
          failures.push(
            `${approvedPersonalManifestFile}: source SHA-256 for ${slug} is not the pinned approved source.`,
          );
        }
      }
    },
  });
}

async function validateApprovedImageSet({
  label,
  manifestFile,
  contracts,
  budget,
  validateSources,
}) {
  const approvedManifest = await readApprovedManifest(manifestFile, label);
  const approvedOutputs = new Map(
    Array.isArray(approvedManifest?.outputs)
      ? approvedManifest.outputs.map((output) => [output.file, output])
      : [],
  );

  if (approvedManifest) {
    validateSources(approvedManifest);
  }
  if (approvedManifest && approvedManifest.schemaVersion !== 1) {
    failures.push(`${manifestFile}: expected schemaVersion 1.`);
  }
  if (
    approvedManifest &&
    (!Array.isArray(approvedManifest.outputs) ||
      approvedManifest.outputs.length !== contracts.length)
  ) {
    failures.push(
      `${manifestFile}: expected exactly ${contracts.length} approved outputs.`,
    );
  }

  for (const contract of contracts) {
    const assetPath = path.join(distDirectory, contract.file);
    const approvedOutput = approvedOutputs.get(contract.file);
    let assetStat;

    if (!approvedOutput) {
      failures.push(
        `${manifestFile}: missing approved output ${contract.file}.`,
      );
    } else if (
      approvedOutput.format !== contract.manifestFormat ||
      approvedOutput.width !== contract.width ||
      approvedOutput.height !== contract.height
    ) {
      failures.push(
        `${manifestFile}: contract for ${contract.file} does not match the required format and dimensions.`,
      );
    }

    try {
      assetStat = await stat(assetPath);
    } catch {
      failures.push(
        `Required ${label.toLowerCase()} asset is missing: ${contract.file}`,
      );
      continue;
    }

    if (assetStat.size > budget) {
      failures.push(
        `${label} asset ${contract.file} is ${formatKib(assetStat.size)}; budget is ${formatKib(budget)}.`,
      );
    }
    if (approvedOutput?.bytes !== assetStat.size) {
      failures.push(
        `${label} asset ${contract.file} byte size does not match the approved manifest.`,
      );
    }

    const contents = await readFile(assetPath);
    const actualSha256 = createHash('sha256').update(contents).digest('hex');
    if (approvedOutput?.sha256 !== actualSha256) {
      failures.push(
        `${label} asset ${contract.file} SHA-256 does not match the approved manifest.`,
      );
    }

    let metadata;
    try {
      metadata = await sharp(assetPath).metadata();
    } catch (error) {
      failures.push(
        `${label} asset ${contract.file} could not be inspected: ${String(error)}`,
      );
      continue;
    }

    if (metadata.format !== contract.metadataFormat) {
      failures.push(
        `${label} asset ${contract.file} has format ${String(metadata.format)}; expected ${contract.metadataFormat}.`,
      );
    }
    if (
      metadata.width !== contract.width ||
      metadata.height !== contract.height
    ) {
      failures.push(
        `${label} asset ${contract.file} is ${String(metadata.width)}x${String(metadata.height)}; expected ${contract.width}x${contract.height}.`,
      );
    }
    for (const metadataType of ['exif', 'xmp', 'iptc', 'icc']) {
      if (metadata[metadataType] !== undefined) {
        failures.push(
          `${label} asset ${contract.file} contains ${metadataType.toUpperCase()} metadata.`,
        );
      }
    }
    if (metadata.orientation !== undefined) {
      failures.push(
        `${label} asset ${contract.file} contains orientation metadata.`,
      );
    }
  }
}

async function readApprovedManifest(manifestFile, label) {
  try {
    return JSON.parse(
      await readFile(path.join(distDirectory, manifestFile), 'utf8'),
    );
  } catch (error) {
    failures.push(
      `Approved ${label.toLowerCase()} manifest is missing or invalid: ${manifestFile} (${String(error)}).`,
    );
    return null;
  }
}

function requireMatch(source, pattern, failure) {
  if (!pattern.test(source)) {
    failures.push(failure);
  }
}

function extractSemanticRegion(html, attribute) {
  const pattern = new RegExp(
    `<([a-z][a-z0-9-]*)\\b(?=[^>]*\\b${attribute}(?:\\s|=|>))[^>]*>([\\s\\S]*?)<\\/\\1>`,
    'iu',
  );
  return html.match(pattern)?.[2] ?? null;
}

function collectImageReferences(markup) {
  const references = new Set();
  const sourcePattern = /(?:^|\s)(?:src|srcset)="([^"]+)"/giu;

  for (const sourceMatch of markup.matchAll(sourcePattern)) {
    const sourceValue = sourceMatch[1].trim();

    for (const candidate of splitImageSourceCandidates(sourceValue)) {
      const reference = candidate.trim().split(/\s+/u)[0];
      if (reference) references.add(reference);
    }
  }

  return references;
}

function splitImageSourceCandidates(sourceValue) {
  if (!sourceValue.startsWith('data:')) return sourceValue.split(',');

  const inlineCandidate = sourceValue.match(
    /^(data:[^,]+,[^\s,]+)(?:\s+(?:\d+(?:\.\d+)?x|\d+w))?(?:\s*,\s*(.*))?$/u,
  );
  if (!inlineCandidate) return sourceValue.split(',');

  const remainingCandidates = inlineCandidate[2]
    ? inlineCandidate[2].split(',')
    : [];
  return [inlineCandidate[1], ...remainingCandidates];
}

function validateContentContract(
  routeFile,
  applicationRoot,
  applicationMarkup,
  content,
) {
  const renderedText = normalizeText(applicationRoot.textContent ?? '');
  const renderedDestinations = new Set(
    [...applicationRoot.querySelectorAll('a[href]')].map((link) =>
      link.getAttribute('href'),
    ),
  );

  const renderedAlternativeText = new Set(
    [...applicationRoot.querySelectorAll('img[alt]')].map((image) =>
      normalizeText(image.getAttribute('alt') ?? ''),
    ),
  );

  for (const requirement of collectContentRequirements(content)) {
    if (requirement.kind === 'alternative') {
      if (!renderedAlternativeText.has(normalizeText(requirement.value))) {
        failures.push(
          `${routeFile}: missing image alt text ${requirement.path} ${JSON.stringify(requirement.value)}`,
        );
      }
      continue;
    }

    if (requirement.kind === 'destination') {
      const escapedHref = `href="${escapeReactAttribute(requirement.value)}"`;
      if (
        !renderedDestinations.has(requirement.value) ||
        !applicationMarkup.includes(escapedHref)
      ) {
        failures.push(
          `${routeFile}: missing destination ${requirement.path} href=${JSON.stringify(requirement.value)}`,
        );
      }
      continue;
    }

    if (!renderedText.includes(normalizeText(requirement.value))) {
      failures.push(
        `${routeFile}: missing visible content ${requirement.path} ${JSON.stringify(requirement.value)}`,
      );
    }
  }
}

function collectContentRequirements(content) {
  const requirements = [];

  for (const [key, value] of Object.entries(content)) {
    if (key !== 'meta') {
      collectRequirements(value, key, key, requirements);
    }
  }

  return requirements;
}

function collectRequirements(value, pathName, key, requirements) {
  if (typeof value === 'string') {
    if (key !== 'slug' && value !== '') {
      requirements.push({
        kind: isDestinationField(key)
          ? 'destination'
          : isAlternativeTextField(key)
            ? 'alternative'
            : 'visible',
        path: pathName,
        value,
      });
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectRequirements(item, `${pathName}[${index}]`, key, requirements);
    });
    return;
  }

  if (value && typeof value === 'object') {
    for (const [childKey, childValue] of Object.entries(value)) {
      collectRequirements(
        childValue,
        `${pathName}.${childKey}`,
        childKey,
        requirements,
      );
    }
  }
}

function isDestinationField(key) {
  return key === 'href' || key.endsWith('Href');
}

/**
 * Alternative text reaches assistive technology through an attribute, never as
 * visible page text, so it is verified against rendered `alt` values instead.
 */
function isAlternativeTextField(key) {
  return key === 'alt';
}

function normalizeText(value) {
  return String(value).replace(/\s+/gu, ' ').trim();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function escapeHtmlAttribute(value) {
  return escapeHtml(value).replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function escapeReactAttribute(value) {
  return escapeHtml(value).replaceAll('"', '&quot;').replaceAll("'", '&#x27;');
}

function checkRootLocaleBootstrap(html) {
  const script = html.match(
    /<script\s+data-root-locale-bootstrap>([\s\S]*?)<\/script>/u,
  )?.[1];

  if (!script) return;

  const scenarios = [
    {
      name: 'redirects a Russian browser from the root',
      input: { pathname: '/', stored: null, languages: ['en', 'ru-RU'] },
      expected: ['/ru/'],
    },
    {
      name: 'honors an English stored preference at the root',
      input: { pathname: '/', stored: 'en', languages: ['ru-RU'] },
      expected: [],
    },
    {
      name: 'honors a Russian stored preference at the root',
      input: { pathname: '/', stored: 'ru', languages: ['en-US'] },
      expected: ['/ru/'],
    },
    {
      name: 'falls back to browser languages when storage throws',
      input: {
        pathname: '/',
        stored: null,
        languages: ['ru'],
        storageThrows: true,
      },
      expected: ['/ru/'],
    },
    {
      name: 'never redirects a localized route',
      input: { pathname: '/en/', stored: 'ru', languages: ['ru-RU'] },
      expected: [],
    },
  ];

  for (const scenario of scenarios) {
    const replacements = [];
    const location = {
      pathname: scenario.input.pathname,
      search: '',
      hash: '',
      replace(destination) {
        replacements.push(destination);
      },
    };
    const localStorage = {
      getItem() {
        if (scenario.input.storageThrows) {
          throw new Error('Storage is unavailable');
        }
        return scenario.input.stored;
      },
    };

    try {
      vm.runInNewContext(script, {
        window: {
          location,
          localStorage,
          navigator: { languages: scenario.input.languages },
        },
      });
    } catch (error) {
      failures.push(
        `index.html: root locale bootstrap threw for scenario "${scenario.name}": ${String(error)}`,
      );
      continue;
    }

    if (JSON.stringify(replacements) !== JSON.stringify(scenario.expected)) {
      failures.push(
        `index.html: root locale bootstrap ${scenario.name}; expected ${JSON.stringify(scenario.expected)}, received ${JSON.stringify(replacements)}`,
      );
    }
  }
}

async function listFiles(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }

  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
    }),
  );

  return files.flat();
}

async function sumTransferredBytes(files, alwaysCompress = false) {
  let bytes = 0;

  for (const file of new Set(files)) {
    try {
      const contents = await readFile(file);
      bytes +=
        alwaysCompress || isCompressible(file)
          ? gzipSync(contents).byteLength
          : contents.byteLength;
    } catch {
      failures.push(
        `Initial asset is missing: ${path.relative(distDirectory, file)}`,
      );
    }
  }

  return bytes;
}

async function sumRouteTransferredBytes(files, routeFile) {
  let bytes = 0;

  for (const file of new Set(files)) {
    try {
      const contents = await readFile(file);
      bytes += isCompressible(file)
        ? gzipSync(contents).byteLength
        : contents.byteLength;
    } catch {
      reportMissingAsset(routeFile, file);
    }
  }

  return bytes;
}

async function collectInitialAssetPaths(html, documentPath, routeFile) {
  const paths = new Set();
  const assetTagPattern = /<(?:script|link)\b[^>]*>/gu;

  for (const tagMatch of html.matchAll(assetTagPattern)) {
    const tag = tagMatch[0];
    const isScript = tag.startsWith('<script');
    const linkRelations = new Set(
      (readHtmlAttribute(tag, 'rel') ?? '').toLowerCase().split(/\s+/u),
    );
    const isInitialLink =
      tag.startsWith('<link') &&
      ['modulepreload', 'preload', 'stylesheet'].some((relation) =>
        linkRelations.has(relation),
      );
    if (!isScript && !isInitialLink) continue;

    const reference =
      readHtmlAttribute(tag, 'src') ?? readHtmlAttribute(tag, 'href');
    const assetPath = resolveLocalAsset(reference, documentPath);
    if (assetPath) paths.add(assetPath);
  }

  const picturePattern = /<picture\b[^>]*>([\s\S]*?)<\/picture>/gu;
  let htmlWithoutPictures = html;
  for (const pictureMatch of html.matchAll(picturePattern)) {
    const picture = pictureMatch[0];
    htmlWithoutPictures = htmlWithoutPictures.replace(picture, '');
    if (/\bloading="lazy"/u.test(picture)) continue;
    const largestCandidate = await findLargestImageCandidate(
      picture,
      documentPath,
      routeFile,
    );
    if (largestCandidate) paths.add(largestCandidate);
  }

  const imagePattern = /<img\b[^>]*>/gu;
  for (const imageMatch of htmlWithoutPictures.matchAll(imagePattern)) {
    const image = imageMatch[0];
    if (/\bloading="lazy"/u.test(image)) continue;
    const largestCandidate = await findLargestImageCandidate(
      image,
      documentPath,
      routeFile,
    );
    if (largestCandidate) paths.add(largestCandidate);
  }

  const stylePattern = /<style\b[^>]*>([\s\S]*?)<\/style>/gu;
  for (const styleMatch of html.matchAll(stylePattern)) {
    for (const reference of collectCssReferences(styleMatch[1])) {
      const assetPath = resolveLocalAsset(reference, documentPath);
      if (assetPath) paths.add(assetPath);
    }
  }

  await collectCssDependencies(paths, routeFile);
  return [...paths];
}

async function findLargestImageCandidate(markup, documentPath, routeFile) {
  const candidates = [];
  for (const reference of collectImageReferences(markup)) {
    const assetPath = resolveLocalAsset(reference, documentPath);
    if (assetPath) candidates.push(assetPath);
  }

  let largest;
  let largestBytes = -1;
  for (const candidate of new Set(candidates)) {
    try {
      const candidateBytes = (await stat(candidate)).size;
      if (candidateBytes > largestBytes) {
        largest = candidate;
        largestBytes = candidateBytes;
      }
    } catch {
      reportMissingAsset(routeFile, candidate);
    }
  }

  return largest;
}

async function collectCssDependencies(paths, routeFile) {
  const cssQueue = [...paths].filter((file) => file.endsWith('.css'));
  const visitedCss = new Set();

  while (cssQueue.length > 0) {
    const cssPath = cssQueue.shift();
    if (!cssPath || visitedCss.has(cssPath)) continue;
    visitedCss.add(cssPath);

    let css;
    try {
      css = await readFile(cssPath, 'utf8');
    } catch {
      reportMissingAsset(routeFile, cssPath);
      continue;
    }

    for (const reference of collectCssReferences(css)) {
      const assetPath = resolveLocalAsset(reference, cssPath);
      if (!assetPath || paths.has(assetPath)) continue;
      paths.add(assetPath);
      if (assetPath.endsWith('.css')) cssQueue.push(assetPath);
    }
  }
}

function collectCssReferences(css) {
  const references = new Set();
  const importPattern =
    /@import\s+(?!url\()(?:"([^"]+)"|'([^']+)'|([^\s;]+))/giu;
  const urlPattern = /url\(\s*(?:"([^"]+)"|'([^']+)'|([^\s)]+))\s*\)/giu;

  for (const match of css.matchAll(importPattern)) {
    const reference = match[1] ?? match[2] ?? match[3];
    if (reference) references.add(reference);
  }

  for (const match of css.matchAll(urlPattern)) {
    const reference = match[1] ?? match[2] ?? match[3];
    if (reference) references.add(reference);
  }

  return references;
}

function readHtmlAttribute(tag, name) {
  const match = tag.match(
    new RegExp(`(?:^|\\s)${name}=(?:"([^"]*)"|'([^']*)')`, 'iu'),
  );
  return match?.[1] ?? match?.[2];
}

function reportMissingAsset(routeFile, file) {
  const relativeFile = path.relative(distDirectory, file);
  const failure = `${routeFile}: initial asset is missing: ${relativeFile}`;
  if (missingAssetFailures.has(failure)) return;
  missingAssetFailures.add(failure);
  failures.push(failure);
}

function resolveLocalAsset(reference, referringFile) {
  if (!reference || reference.startsWith('#')) return null;

  let url;
  try {
    const relativeReferrer = referringFile
      ? path.relative(distDirectory, referringFile).split(path.sep).join('/')
      : 'index.html';
    url = new URL(reference, new URL(`/${relativeReferrer}`, siteUrl));
  } catch {
    return null;
  }

  if (url.origin !== siteUrl) return null;

  const relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const assetPath = path.resolve(distDirectory, relativePath);
  const relativeAssetPath = path.relative(distDirectory, assetPath);

  if (
    relativeAssetPath.startsWith('..') ||
    path.isAbsolute(relativeAssetPath) ||
    relativePath === ''
  ) {
    return null;
  }

  return assetPath;
}

function isCompressible(file) {
  return /\.(?:css|html|js|json|svg|webmanifest)$/u.test(file);
}

function formatKib(bytes) {
  return `${(bytes / kibibyte).toFixed(1)} KiB`;
}
