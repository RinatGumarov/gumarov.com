/**
 * Build-time checks on `dist/` that nothing else in the toolchain covers: the
 * prerender is complete and carries the right locale, the critical path carries
 * both font subsets and nothing else it should not, the bundle stays inside its
 * budget, and the Pages artifact is intact.
 *
 * Page weight, accessibility and everything else observable in a browser is
 * Lighthouse's and Playwright's job, not this script's.
 */
import { gzipSync } from 'node:zlib';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const distDirectory = path.resolve(projectRoot, process.argv[2] ?? 'dist');
const siteUrl = 'https://gumarov.com';
const javascriptBudget = 150 * 1024;
/*
 * The two faces the document is allowed to carry, and what each may weigh.
 * `scripts/subset-fonts.mjs` holds the same budgets — it refuses to write a
 * subset over them — and this is the check that the file in `dist/` is the one
 * that script wrote rather than a full face copied over it.
 */
const fontSubsets = [
  { path: '/assets/fonts/Onest-Subset.woff2', budget: 28 * 1024 },
  { path: '/assets/fonts/IBMPlexMono-Subset.woff2', budget: 20 * 1024 },
];
const fontSubsetPaths = fontSubsets.map((subset) => subset.path);
const playwrightAnalyticsToken = 'phc_playwright_public_transport_token';

const routes = [
  { file: 'index.html', locale: 'en', canonical: `${siteUrl}/`, root: true },
  { file: 'en/index.html', locale: 'en', canonical: `${siteUrl}/en/` },
  { file: 'ru/index.html', locale: 'ru', canonical: `${siteUrl}/ru/` },
];

const failures = [];
const getContent = await loadContent();

for (const route of routes) {
  let html;
  try {
    html = await readFile(path.join(distDirectory, route.file), 'utf8');
  } catch {
    failures.push(`Missing route: ${route.file}`);
    continue;
  }

  checkPrerender(route, html);
  checkCriticalPath(route.file, html);
}

const javascriptFiles = (await listFiles(distDirectory)).filter((file) =>
  file.endsWith('.js'),
);
let javascriptBytes = 0;

for (const file of javascriptFiles) {
  const contents = await readFile(file);
  javascriptBytes += gzipSync(contents).byteLength;

  /*
   * `pnpm test:e2e` rebuilds dist through Playwright's webServer, which injects
   * a placeholder analytics key. Uploading that build would ship the test token
   * to real visitors and make their browsers call PostHog for nothing.
   */
  if (contents.includes(playwrightAnalyticsToken)) {
    failures.push(
      `${path.relative(distDirectory, file)}: built with the Playwright placeholder analytics token`,
    );
  }
}

if (javascriptBytes > javascriptBudget) {
  failures.push(
    `Compressed JavaScript is ${formatKib(javascriptBytes)}; budget is ${formatKib(javascriptBudget)}.`,
  );
}

await checkFontSubsets();
await checkPagesFiles();

if (failures.length > 0) {
  console.error('Distribution checks failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    `Distribution checks passed: ${routes.length} routes, ${formatKib(javascriptBytes)} compressed JavaScript.`,
  );
}

/**
 * The prerender writes one template three times, so the failure to catch is a
 * route that rendered the wrong locale — or did not render at all.
 */
function checkPrerender(route, html) {
  if (html.includes('<!--app-html-->') || html.includes('<!--page-meta-->')) {
    failures.push(`${route.file}: unresolved prerender marker`);
  }
  if (!new RegExp(`<html[^>]*\\blang="${route.locale}"`, 'u').test(html)) {
    failures.push(`${route.file}: expected html lang="${route.locale}"`);
  }
  if (!html.includes('<main')) {
    failures.push(`${route.file}: server-rendered markup is missing`);
  }

  const canonical = readTagAttribute(
    html,
    /<link\b[^>]*rel="canonical"[^>]*>/u,
  );
  if (canonical !== route.canonical) {
    failures.push(
      `${route.file}: canonical is ${JSON.stringify(canonical)}; expected ${route.canonical}`,
    );
  }

  const meta = getContent?.(route.locale)?.meta;
  if (meta && !html.includes(`<title>${meta.title}</title>`)) {
    failures.push(`${route.file}: title is not the ${route.locale} one`);
  }

  /*
   * Only the root document may carry the locale bootstrap. On a localized
   * route it would redirect a visitor who has already chosen that locale.
   */
  if (Boolean(route.root) !== html.includes('data-root-locale-bootstrap')) {
    failures.push(
      route.root
        ? `${route.file}: missing root locale bootstrap`
        : `${route.file}: root locale bootstrap leaked into a locale route`,
    );
  }
}

/**
 * Every word on the page paints in its real face, on the first frame, because
 * both subsets — the display face and the label face — are preloaded alongside
 * the document and declared in the inlined CSS. Nothing else goes on the
 * critical path, and nothing that is on it may be dropped: a face that arrives
 * after the first frame is a face the visitor watches change.
 *
 * Every part of that is easy to undo by accident: a stray
 * `<link rel="stylesheet">`, a preload going missing or a third appearing, a
 * preload that loses its `crossorigin` and so downloads the file twice, or a
 * full variable face drifting back into the inlined `@font-face`.
 */
function checkCriticalPath(routeFile, html) {
  const fontPreloads = [];

  for (const [tag] of html.matchAll(/<link\b[^>]*>/gu)) {
    const relations = (readHtmlAttribute(tag, 'rel') ?? '').toLowerCase();

    if (
      relations.includes('stylesheet') &&
      (readHtmlAttribute(tag, 'media') ?? 'all').toLowerCase() !== 'print'
    ) {
      failures.push(
        `${routeFile}: render-blocking stylesheet ${readHtmlAttribute(tag, 'href') ?? 'unknown'}`,
      );
    }
    if (
      relations.includes('preload') &&
      (readHtmlAttribute(tag, 'as') ?? '').toLowerCase() === 'font'
    ) {
      fontPreloads.push(tag);
    }
  }

  const preloaded = fontPreloads.map((tag) => readHtmlAttribute(tag, 'href'));
  if (
    preloaded.length !== fontSubsetPaths.length ||
    !fontSubsetPaths.every((subsetPath) => preloaded.includes(subsetPath))
  ) {
    failures.push(
      `${routeFile}: the font preloads are ${JSON.stringify(preloaded)}; exactly ${JSON.stringify(fontSubsetPaths)} belong in front of the text`,
    );
  }

  for (const tag of fontPreloads) {
    const href = readHtmlAttribute(tag, 'href');
    if ((readHtmlAttribute(tag, 'type') ?? '').toLowerCase() !== 'font/woff2') {
      failures.push(
        `${routeFile}: the ${href} preload is missing type="font/woff2"`,
      );
    }
    /*
     * A font is fetched anonymously whatever the preload says, so a preload
     * without `crossorigin` is a second, unused download rather than a warmed
     * cache entry.
     */
    if (!/(?:^|\s)crossorigin(?:[\s=/>]|$)/iu.test(tag)) {
      failures.push(`${routeFile}: the ${href} preload is missing crossorigin`);
    }
  }

  for (const [, css] of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gu)) {
    /*
     * The metric-adjusted fallback faces source `local()` only and download
     * nothing; the two subsets are the only faces here that may name a
     * `url()`, and they may only name their own.
     */
    for (const [, face] of css.matchAll(/@font-face\s*\{([^}]*)\}/gu)) {
      const urls = [...face.matchAll(/\burl\(\s*['"]?([^'")]+)/gu)].map(
        ([, url]) => url,
      );
      if (
        urls.length > 0 &&
        !(urls.length === 1 && fontSubsetPaths.includes(urls[0]))
      ) {
        failures.push(
          `${routeFile}: inlined @font-face downloads ${urls.join(', ')}; only ${fontSubsetPaths.join(' and ')} may be on the critical path`,
        );
      }
    }
  }
}

/** A preload is only worth its place while the file behind it stays small. */
async function checkFontSubsets() {
  for (const subset of fontSubsets) {
    const file = path.join(distDirectory, subset.path.replace(/^\/+/u, ''));

    try {
      const { size } = await stat(file);
      if (size > subset.budget) {
        failures.push(
          `${subset.path} is ${formatKib(size)}; budget is ${formatKib(subset.budget)}.`,
        );
      }
    } catch {
      failures.push(`Missing a preloaded subset: ${subset.path}`);
    }
  }
}

async function checkPagesFiles() {
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

async function loadContent() {
  try {
    const entry = await import(
      pathToFileURL(
        path.join(path.dirname(distDirectory), 'dist-ssr', 'entry-server.js'),
      ).href
    );
    return entry.getContent;
  } catch (error) {
    failures.push(`Unable to load the built content: ${String(error)}`);
    return null;
  }
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const entryPath = path.join(directory, entry.name);
      return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
    }),
  );

  return files.flat();
}

function readTagAttribute(html, tagPattern, name = 'href') {
  const tag = html.match(tagPattern)?.[0];
  return tag ? readHtmlAttribute(tag, name) : undefined;
}

function readHtmlAttribute(tag, name) {
  const match = tag.match(
    new RegExp(`(?:^|\\s)${name}=(?:"([^"]*)"|'([^']*)')`, 'iu'),
  );
  return match?.[1] ?? match?.[2];
}

function formatKib(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}
