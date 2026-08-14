import { gzipSync } from 'node:zlib';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
const projectUrls = [
  'https://www.tradingview.com/',
  'https://stoic.ai/',
  'https://splithub.app/',
  'https://evercity.io/',
];
const contactUrls = ['https://t.me/RinatGumarov', 'mailto:hi@gumarov.com'];
const routeContracts = [
  {
    file: 'index.html',
    lang: 'en',
    canonical: `${siteUrl}/`,
    hero: 'Senior Frontend Engineer building ambitious products.',
    root: true,
  },
  {
    file: 'en/index.html',
    lang: 'en',
    canonical: `${siteUrl}/en/`,
    hero: 'Senior Frontend Engineer building ambitious products.',
  },
  {
    file: 'ru/index.html',
    lang: 'ru',
    canonical: `${siteUrl}/ru/`,
    hero: 'Senior Frontend Engineer, который создаёт амбициозные продукты.',
  },
];
const failures = [];
const routeDocuments = new Map();
let initialTransferBytes = 0;

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
  requireText(html, route.hero, `${route.file}: missing localized hero copy`);

  for (const projectUrl of projectUrls) {
    requireText(
      html,
      `href="${projectUrl}"`,
      `${route.file}: missing project link ${projectUrl}`,
    );
  }

  for (const contactUrl of contactUrls) {
    requireText(
      html,
      `href="${contactUrl}"`,
      `${route.file}: missing contact link ${contactUrl}`,
    );
  }

  requireMatch(
    html,
    /<div id="root"><main\b/u,
    `${route.file}: server-rendered application markup is missing`,
  );

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

if (rootDocument) {
  const rootPath = path.join(distDirectory, 'index.html');
  const initialAssetPaths = await collectInitialAssetPaths(rootDocument);
  initialTransferBytes =
    gzipSync(await readFile(rootPath)).byteLength +
    (await sumTransferredBytes(initialAssetPaths));

  if (initialTransferBytes > initialTransferBudget) {
    failures.push(
      `Initial transfer is ${formatKib(initialTransferBytes)}; budget is ${formatKib(initialTransferBudget)}.`,
    );
  }
}

for (const file of outputFiles.filter(isHeroSource)) {
  const fileBytes = (await stat(file)).size;
  if (fileBytes > heroSourceBudget) {
    failures.push(
      `Hero source ${path.relative(distDirectory, file)} is ${formatKib(fileBytes)}; budget is ${formatKib(heroSourceBudget)}.`,
    );
  }
}

if (failures.length > 0) {
  console.error('Distribution checks failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `Distribution checks passed: 3 routes, ${formatKib(compressedJavascriptBytes)} compressed JavaScript, ${formatKib(initialTransferBytes)} initial transfer.`,
  );
}

function requireText(source, expected, failure) {
  if (!source.includes(expected)) {
    failures.push(failure);
  }
}

function requireMatch(source, pattern, failure) {
  if (!pattern.test(source)) {
    failures.push(failure);
  }
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

async function collectInitialAssetPaths(html) {
  const paths = new Set();
  const assetTagPattern = /<(?:script|link)\b[^>]*>/gu;

  for (const tagMatch of html.matchAll(assetTagPattern)) {
    const tag = tagMatch[0];
    const isScript = tag.startsWith('<script');
    const isInitialLink =
      tag.startsWith('<link') &&
      /\brel="(?:modulepreload|preload|stylesheet)"/u.test(tag);
    if (!isScript && !isInitialLink) continue;

    const reference = tag.match(/\b(?:src|href)="([^"]+)"/u)?.[1];
    const assetPath = resolveLocalAsset(reference);
    if (assetPath) paths.add(assetPath);
  }

  const picturePattern = /<picture\b[^>]*>([\s\S]*?)<\/picture>/gu;
  let htmlWithoutPictures = html;
  for (const pictureMatch of html.matchAll(picturePattern)) {
    const picture = pictureMatch[0];
    htmlWithoutPictures = htmlWithoutPictures.replace(picture, '');
    if (/\bloading="lazy"/u.test(picture)) continue;
    const largestCandidate = await findLargestImageCandidate(picture);
    if (largestCandidate) paths.add(largestCandidate);
  }

  const imagePattern = /<img\b[^>]*>/gu;
  for (const imageMatch of htmlWithoutPictures.matchAll(imagePattern)) {
    const image = imageMatch[0];
    if (/\bloading="lazy"/u.test(image)) continue;
    const largestCandidate = await findLargestImageCandidate(image);
    if (largestCandidate) paths.add(largestCandidate);
  }

  return [...paths];
}

async function findLargestImageCandidate(markup) {
  const candidates = [];
  const sourcePattern = /\b(?:src|srcset)="([^"]+)"/gu;

  for (const sourceMatch of markup.matchAll(sourcePattern)) {
    for (const candidate of sourceMatch[1].split(',')) {
      const url = candidate.trim().split(/\s+/u)[0];
      const assetPath = resolveLocalAsset(url);
      if (assetPath) candidates.push(assetPath);
    }
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
      failures.push(
        `Initial asset is missing: ${path.relative(distDirectory, candidate)}`,
      );
    }
  }

  return largest;
}

function resolveLocalAsset(reference) {
  if (!reference || reference.startsWith('#')) return null;

  let url;
  try {
    url = new URL(reference, `${siteUrl}/`);
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

function isHeroSource(file) {
  const relativeFile = path
    .relative(distDirectory, file)
    .split(path.sep)
    .join('/');
  return /(?:^|\/)assets\/(?:hero|portrait)\//u.test(relativeFile);
}

function formatKib(bytes) {
  return `${(bytes / kibibyte).toFixed(1)} KiB`;
}
