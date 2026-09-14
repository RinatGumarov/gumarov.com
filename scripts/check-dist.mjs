/**
 * Build-time checks on `dist/` that nothing else in the toolchain covers: the
 * prerender is complete and carries the right locale, the critical path stays
 * free of blocking CSS and downloaded webfonts, the bundle stays inside its
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
 * The LCP heading paints without waiting on a download because nothing
 * render-blocking and no webfont sits in front of it. That is easy to undo by
 * accident: a stray `<link rel="stylesheet">`, a downloaded `@font-face` that
 * drifts into the inlined critical CSS, a well-meant font preload.
 */
function checkCriticalPath(routeFile, html) {
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
      failures.push(
        `${routeFile}: do not preload webfonts in front of the LCP heading`,
      );
    }
  }

  for (const [, css] of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gu)) {
    /*
     * A face whose sources are `local()` only downloads nothing: that is the
     * metric-adjusted fallback in `tokens.css`, which belongs on the critical
     * path precisely so the first paint agrees with Onest about the heading's
     * line count. A `url()` source is the thing that must not be here.
     */
    for (const [, face] of css.matchAll(/@font-face\s*\{([^}]*)\}/gu)) {
      if (/\burl\(/u.test(face)) {
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
