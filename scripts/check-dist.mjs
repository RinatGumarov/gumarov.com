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
const requiredPortraitAssets = [480, 768, 1024].flatMap((width) =>
  [
    { extension: 'avif', format: 'heif' },
    { extension: 'webp', format: 'webp' },
    { extension: 'jpg', format: 'jpeg' },
  ].map(({ extension, format }) => ({
    file: `assets/portrait/portrait-${width}.${extension}`,
    format,
    width,
    height: Math.round(width * 1.25),
  })),
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
  requireText(
    html,
    `<link rel="canonical" href="${route.canonical}" />`,
    `${route.file}: missing canonical ${route.canonical}`,
  );
  requireText(
    html,
    `<link rel="alternate" hreflang="en" href="${siteUrl}/en/" />`,
    `${route.file}: missing reciprocal English alternate`,
  );
  requireText(
    html,
    `<link rel="alternate" hreflang="ru" href="${siteUrl}/ru/" />`,
    `${route.file}: missing reciprocal Russian alternate`,
  );
  requireText(
    html,
    `<link rel="alternate" hreflang="x-default" href="${siteUrl}/" />`,
    `${route.file}: missing x-default alternate`,
  );
  if (content) {
    requireText(
      html,
      `<title>${escapeHtml(content.meta.title)}</title>`,
      `${route.file}: missing localized metadata title`,
    );
    requireText(
      html,
      `<meta name="description" content="${escapeHtmlAttribute(content.meta.description)}" />`,
      `${route.file}: missing localized metadata description`,
    );

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

async function validateRequiredPortraitAssets() {
  for (const contract of requiredPortraitAssets) {
    const assetPath = path.join(distDirectory, contract.file);
    let assetStat;

    try {
      assetStat = await stat(assetPath);
    } catch {
      failures.push(`Required portrait asset is missing: ${contract.file}`);
      continue;
    }

    if (assetStat.size > heroSourceBudget) {
      failures.push(
        `Portrait asset ${contract.file} is ${formatKib(assetStat.size)}; budget is ${formatKib(heroSourceBudget)}.`,
      );
    }

    let metadata;
    try {
      metadata = await sharp(assetPath).metadata();
    } catch (error) {
      failures.push(
        `Portrait asset ${contract.file} could not be inspected: ${String(error)}`,
      );
      continue;
    }

    if (metadata.format !== contract.format) {
      failures.push(
        `Portrait asset ${contract.file} has format ${String(metadata.format)}; expected ${contract.format}.`,
      );
    }
    if (
      metadata.width !== contract.width ||
      metadata.height !== contract.height
    ) {
      failures.push(
        `Portrait asset ${contract.file} is ${String(metadata.width)}x${String(metadata.height)}; expected ${contract.width}x${contract.height}.`,
      );
    }
    for (const metadataType of ['exif', 'xmp', 'iptc']) {
      if (metadata[metadataType] !== undefined) {
        failures.push(
          `Portrait asset ${contract.file} contains ${metadataType.toUpperCase()} metadata.`,
        );
      }
    }
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

  for (const requirement of collectContentRequirements(content)) {
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
        kind: isDestinationField(key) ? 'destination' : 'visible',
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
