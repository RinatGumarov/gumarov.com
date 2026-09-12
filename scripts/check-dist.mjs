/**
 * Build-time checks on `dist/` that nothing else in the toolchain covers: that
 * the prerender is complete, that every authored string reached the page, that
 * the critical path stayed free of blocking CSS and webfonts, and that each
 * route stayed inside its transfer budget.
 *
 * Anything TypeScript, ESLint, Playwright or Lighthouse already protects is
 * deliberately not repeated here.
 */
import { gzipSync } from 'node:zlib';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const distDirectory = path.resolve(projectRoot, process.argv[2] ?? 'dist');
const siteUrl = 'https://gumarov.com';
const kibibyte = 1024;
const javascriptBudget = 150 * kibibyte;
const initialTransferBudget = 700 * kibibyte;
const playwrightAnalyticsToken = 'phc_playwright_public_transport_token';

const routeContracts = [
  { file: 'index.html', locale: 'en', canonical: `${siteUrl}/`, root: true },
  { file: 'en/index.html', locale: 'en', canonical: `${siteUrl}/en/` },
  { file: 'ru/index.html', locale: 'ru', canonical: `${siteUrl}/ru/` },
];

const failures = [];
const routeDocuments = new Map();
const routeTransferBytes = new Map();
const missingAssetFailures = new Set();
const contentByLocale = new Map();

try {
  const serverEntry = await import(
    pathToFileURL(
      path.join(path.dirname(distDirectory), 'dist-ssr', 'entry-server.js'),
    ).href
  );
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
  const dom = new JSDOM(html, { includeNodeLocations: true });
  const document = dom.window.document;
  const applicationRoot = document.getElementById('root');
  const rootLocation = applicationRoot
    ? dom.nodeLocation(applicationRoot)
    : null;
  const applicationMarkup =
    rootLocation?.startTag && rootLocation.endTag
      ? html.slice(
          rootLocation.startTag.endOffset,
          rootLocation.endTag.startOffset,
        )
      : '';

  if (html.includes('<!--app-html-->') || html.includes('<!--page-meta-->')) {
    failures.push(`${route.file}: unresolved prerender marker`);
  }
  if (document.documentElement.getAttribute('lang') !== route.locale) {
    failures.push(`${route.file}: expected html lang="${route.locale}"`);
  }
  if (!applicationRoot?.querySelector('main')) {
    failures.push(
      `${route.file}: server-rendered application markup is missing`,
    );
  }

  if (content) {
    validateRouteMetadata(route, document, content);
    if (applicationRoot) {
      validateContentContract(
        route.file,
        applicationRoot,
        applicationMarkup,
        content,
      );
    }
  }

  validateCriticalPath(route.file, html);

  /*
   * Only the root document may carry the locale bootstrap. On a localized
   * route it would redirect a visitor who has already chosen that locale.
   */
  const hasRootBootstrap = html.includes('data-root-locale-bootstrap');
  if (Boolean(route.root) !== hasRootBootstrap) {
    failures.push(
      route.root
        ? `${route.file}: missing root locale bootstrap`
        : `${route.file}: root locale bootstrap leaked into a locale route`,
    );
  }

  dom.window.close();
}

const outputFiles = await listFiles(distDirectory);
const javascriptFiles = outputFiles.filter((file) => file.endsWith('.js'));
const compressedJavascriptBytes = await sumCompressedBytes(javascriptFiles);

if (compressedJavascriptBytes > javascriptBudget) {
  failures.push(
    `Compressed JavaScript is ${formatKib(compressedJavascriptBytes)}; budget is ${formatKib(javascriptBudget)}.`,
  );
}

/*
 * `pnpm test:e2e` rebuilds dist through Playwright's webServer, which injects
 * a placeholder analytics key. Uploading that build would ship the test token
 * to real visitors and make their browsers call PostHog for nothing.
 */
for (const file of javascriptFiles) {
  if ((await readFile(file, 'utf8')).includes(playwrightAnalyticsToken)) {
    failures.push(
      `${path.relative(distDirectory, file)}: built with the Playwright placeholder analytics token`,
    );
  }
}

for (const route of routeContracts) {
  const html = routeDocuments.get(route.file);
  if (!html) continue;

  const routePath = path.join(distDirectory, route.file);
  const initialAssets = await collectInitialAssetPaths(
    html,
    routePath,
    route.file,
  );
  const transferBytes =
    gzipSync(await readFile(routePath)).byteLength +
    (await sumRouteTransferredBytes(initialAssets, route.file));
  routeTransferBytes.set(route.file, transferBytes);

  if (transferBytes > initialTransferBudget) {
    failures.push(
      `${route.file}: initial transfer is ${formatKib(transferBytes)}; budget is ${formatKib(initialTransferBudget)}.`,
    );
  }
}

await validatePagesHostingFiles();

if (failures.length > 0) {
  console.error('Distribution checks failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  const worstRoute = [...routeTransferBytes.entries()].sort(
    ([, left], [, right]) => right - left,
  )[0];
  const worstRouteSummary = worstRoute
    ? `${worstRoute[0]} ${formatKib(worstRoute[1])}`
    : 'unavailable';
  console.log(
    `Distribution checks passed: ${routeContracts.length} routes, ${formatKib(compressedJavascriptBytes)} compressed JavaScript, worst initial transfer ${worstRouteSummary}.`,
  );
}

/**
 * The parts of the head that depend on which route is being rendered, which is
 * where a prerender loop goes wrong: the wrong locale's copy, the wrong
 * canonical, or alternates that stop pointing at each other.
 */
function validateRouteMetadata(route, document, content) {
  const meta = content.meta;
  const title = document.querySelector('title')?.textContent;
  if (title !== meta.title) {
    failures.push(
      `${route.file}: title is ${JSON.stringify(title)}; expected the ${route.locale} title`,
    );
  }

  const description = document
    .querySelector('meta[name="description"]')
    ?.getAttribute('content');
  if (description !== meta.description) {
    failures.push(`${route.file}: description is not the ${route.locale} one`);
  }

  const canonical = document
    .querySelector('link[rel="canonical"]')
    ?.getAttribute('href');
  if (canonical !== route.canonical) {
    failures.push(
      `${route.file}: canonical is ${JSON.stringify(canonical)}; expected ${route.canonical}`,
    );
  }

  const alternates = Object.fromEntries(
    [...document.querySelectorAll('link[rel="alternate"][hreflang]')].map(
      (link) => [link.getAttribute('hreflang'), link.getAttribute('href')],
    ),
  );
  const expectedAlternates = {
    en: `${siteUrl}/en/`,
    ru: `${siteUrl}/ru/`,
    'x-default': `${siteUrl}/`,
  };
  if (JSON.stringify(alternates) !== JSON.stringify(expectedAlternates)) {
    failures.push(
      `${route.file}: hreflang alternates are ${JSON.stringify(alternates)}`,
    );
  }

  const socialImageUrl = `${siteUrl}${meta.ogImage}`;
  for (const [label, selector, expected] of [
    ['og:url', 'meta[property="og:url"]', route.canonical],
    ['og:image', 'meta[property="og:image"]', socialImageUrl],
    ['twitter:image', 'meta[name="twitter:image"]', socialImageUrl],
  ]) {
    const value = document.querySelector(selector)?.getAttribute('content');
    if (value !== expected) {
      failures.push(
        `${route.file}: ${label} is ${JSON.stringify(value)}; expected ${expected}`,
      );
    }
  }
}

/**
 * Every authored string has to reach the page. The content model is the single
 * source of copy, so a field added to `en.ts` and never rendered — or rendered
 * in one locale only — is a silent hole that nothing else catches.
 */
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
      if (
        !renderedDestinations.has(requirement.value) ||
        !applicationMarkup.includes(
          `href="${escapeReactAttribute(requirement.value)}"`,
        )
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
    // `meta` is head material, checked against the document head instead.
    if (key !== 'meta') collectRequirements(value, key, key, requirements);
  }
  return requirements;
}

function collectRequirements(value, pathName, key, requirements) {
  if (typeof value === 'string') {
    if (!isStructuralField(key) && value !== '') {
      requirements.push({
        kind: isDestinationField(key)
          ? 'destination'
          : key === 'alt'
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

/**
 * Identifiers and rendering discriminators are not copy: `slug` names an asset,
 * `variant` picks a scene composition and `media` says whether that scene
 * carries a capture. Alt text reaches assistive technology through an
 * attribute, so it is matched against rendered `alt` values, not visible text.
 */
function isStructuralField(key) {
  return key === 'slug' || key === 'variant' || key === 'media';
}

function isDestinationField(key) {
  return key === 'href' || key.endsWith('Href');
}

/**
 * The LCP heading paints without waiting on a download because nothing
 * render-blocking and no webfont sits in front of it. That is easy to undo by
 * accident: a stray `<link rel="stylesheet">`, a downloaded `@font-face` that
 * drifts into the inlined critical CSS, a well-meant font preload.
 */
function validateCriticalPath(routeFile, html) {
  for (const tagMatch of html.matchAll(/<link\b[^>]*>/gu)) {
    const tag = tagMatch[0];
    const relations = new Set(
      (readHtmlAttribute(tag, 'rel') ?? '').toLowerCase().split(/\s+/u),
    );

    if (
      relations.has('stylesheet') &&
      (readHtmlAttribute(tag, 'media') ?? 'all').toLowerCase() !== 'print'
    ) {
      failures.push(
        `${routeFile}: render-blocking stylesheet ${readHtmlAttribute(tag, 'href') ?? 'unknown'}`,
      );
    }
    if (
      relations.has('preload') &&
      (readHtmlAttribute(tag, 'as') ?? '').toLowerCase() === 'font'
    ) {
      failures.push(
        `${routeFile}: do not preload webfonts in front of the LCP heading`,
      );
    }
  }

  for (const css of collectDocumentCss(html)) {
    /*
     * A face whose sources are `local()` only downloads nothing: that is the
     * metric-adjusted fallback in `tokens.css`, which belongs on the critical
     * path precisely so the first paint agrees with Onest about the heading's
     * line count. A `url()` source is the thing that must not be here.
     */
    for (const face of css.matchAll(/@font-face\s*\{([^}]*)\}/gu)) {
      if (/\burl\(/u.test(face[1])) {
        failures.push(
          `${routeFile}: inlined CSS must not declare @font-face with a downloaded source`,
        );
      }
    }
    if (/\bOnest\b(?!\s+Fallback)/u.test(css)) {
      failures.push(`${routeFile}: inlined CSS must not reference Onest`);
    }
  }
}

function collectDocumentCss(html) {
  const cssChunks = [];

  for (const styleMatch of html.matchAll(
    /<style\b[^>]*>([\s\S]*?)<\/style>/gu,
  )) {
    cssChunks.push(styleMatch[1]);
  }

  for (const tagMatch of html.matchAll(/<link\b[^>]*>/gu)) {
    const encoded = (readHtmlAttribute(tagMatch[0], 'href') ?? '').match(
      /^data:text\/css(?:;charset=utf-8)?;base64,([\s\S]+)$/iu,
    )?.[1];
    if (encoded) {
      cssChunks.push(Buffer.from(encoded, 'base64').toString('utf8'));
    }
  }

  return cssChunks;
}

async function validatePagesHostingFiles() {
  try {
    const cname = await readFile(path.join(distDirectory, 'CNAME'), 'utf8');
    if (cname.trim() !== 'gumarov.com') {
      failures.push('CNAME must contain only gumarov.com');
    }
  } catch {
    failures.push('Required Pages file is missing: CNAME');
  }

  try {
    await stat(path.join(distDirectory, '.nojekyll'));
  } catch {
    failures.push('Required Pages file is missing: .nojekyll');
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

async function sumCompressedBytes(files) {
  let bytes = 0;
  for (const file of new Set(files)) {
    bytes += gzipSync(await readFile(file)).byteLength;
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

/** Everything the browser has to fetch before the page is usable. */
async function collectInitialAssetPaths(html, documentPath, routeFile) {
  const paths = new Set();

  for (const tagMatch of html.matchAll(/<(?:script|link)\b[^>]*>/gu)) {
    const tag = tagMatch[0];
    const relations = new Set(
      (readHtmlAttribute(tag, 'rel') ?? '').toLowerCase().split(/\s+/u),
    );
    const isInitialLink =
      tag.startsWith('<link') &&
      ['modulepreload', 'preload', 'stylesheet'].some((relation) =>
        relations.has(relation),
      );
    if (!tag.startsWith('<script') && !isInitialLink) continue;

    const assetPath = resolveLocalAsset(
      readHtmlAttribute(tag, 'src') ?? readHtmlAttribute(tag, 'href'),
      documentPath,
    );
    if (assetPath) paths.add(assetPath);
  }

  /*
   * Only the largest candidate of an eager image can be charged to the route:
   * the browser fetches exactly one, and which one depends on the viewport.
   */
  let htmlWithoutPictures = html;
  for (const pictureMatch of html.matchAll(
    /<picture\b[^>]*>([\s\S]*?)<\/picture>/gu,
  )) {
    htmlWithoutPictures = htmlWithoutPictures.replace(pictureMatch[0], '');
    if (/\bloading="lazy"/u.test(pictureMatch[0])) continue;
    const largest = await findLargestImageCandidate(
      pictureMatch[0],
      documentPath,
      routeFile,
    );
    if (largest) paths.add(largest);
  }

  for (const imageMatch of htmlWithoutPictures.matchAll(/<img\b[^>]*>/gu)) {
    if (/\bloading="lazy"/u.test(imageMatch[0])) continue;
    const largest = await findLargestImageCandidate(
      imageMatch[0],
      documentPath,
      routeFile,
    );
    if (largest) paths.add(largest);
  }

  for (const styleMatch of html.matchAll(
    /<style\b[^>]*>([\s\S]*?)<\/style>/gu,
  )) {
    for (const reference of collectCssReferences(styleMatch[1])) {
      const assetPath = resolveLocalAsset(reference, documentPath);
      if (assetPath) paths.add(assetPath);
    }
  }

  await collectCssDependencies(paths, routeFile);
  return [...paths];
}

async function findLargestImageCandidate(markup, documentPath, routeFile) {
  let largest;
  let largestBytes = -1;

  for (const reference of collectImageReferences(markup)) {
    const candidate = resolveLocalAsset(reference, documentPath);
    if (!candidate) continue;

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

function collectImageReferences(markup) {
  const references = new Set();

  for (const sourceMatch of markup.matchAll(
    /(?:^|\s)(?:src|srcset)="([^"]+)"/giu,
  )) {
    for (const candidate of splitImageSourceCandidates(sourceMatch[1].trim())) {
      const reference = candidate.trim().split(/\s+/u)[0];
      if (reference) references.add(reference);
    }
  }

  return references;
}

/** A `data:` URI can itself contain commas, so it cannot be split naively. */
function splitImageSourceCandidates(sourceValue) {
  if (!sourceValue.startsWith('data:')) return sourceValue.split(',');

  const inlineCandidate = sourceValue.match(
    /^(data:[^,]+,[^\s,]+)(?:\s+(?:\d+(?:\.\d+)?x|\d+w))?(?:\s*,\s*(.*))?$/u,
  );
  if (!inlineCandidate) return sourceValue.split(',');

  return [
    inlineCandidate[1],
    ...(inlineCandidate[2] ? inlineCandidate[2].split(',') : []),
  ];
}

async function collectCssDependencies(paths, routeFile) {
  const cssQueue = [...paths].filter((file) => file.endsWith('.css'));
  const visited = new Set();

  while (cssQueue.length > 0) {
    const cssPath = cssQueue.shift();
    if (!cssPath || visited.has(cssPath)) continue;
    visited.add(cssPath);

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
  const patterns = [
    /@import\s+(?!url\()(?:"([^"]+)"|'([^']+)'|([^\s;]+))/giu,
    /url\(\s*(?:"([^"]+)"|'([^']+)'|([^\s)]+))\s*\)/giu,
  ];

  for (const pattern of patterns) {
    for (const match of css.matchAll(pattern)) {
      const reference = match[1] ?? match[2] ?? match[3];
      if (reference) references.add(reference);
    }
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

function normalizeText(value) {
  return String(value).replace(/\s+/gu, ' ').trim();
}

function escapeReactAttribute(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#x27;');
}

function isCompressible(file) {
  return /\.(?:css|html|js|json|svg|webmanifest)$/u.test(file);
}

function formatKib(bytes) {
  return `${(bytes / kibibyte).toFixed(1)} KiB`;
}
