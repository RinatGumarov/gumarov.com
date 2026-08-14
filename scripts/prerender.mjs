import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const distDirectory = path.join(projectRoot, 'dist');
const templatePath = path.join(distDirectory, 'index.html');
const serverEntryUrl = pathToFileURL(
  path.join(projectRoot, 'dist-ssr', 'entry-server.js'),
).href;
const siteUrl = 'https://gumarov.com';
const rootBootstrapPattern =
  /\s*<script\s+data-root-locale-bootstrap>[\s\S]*?<\/script>/u;

const template = await readFile(templatePath, 'utf8');
const { getPageMeta, render } = await import(serverEntryUrl);

const routes = [
  { directory: '', locale: 'en', pathname: '/', keepRootBootstrap: true },
  { directory: 'en', locale: 'en', pathname: '/en/' },
  { directory: 'ru', locale: 'ru', pathname: '/ru/' },
];

for (const route of routes) {
  const outputDirectory = path.join(distDirectory, route.directory);
  const outputPath = path.join(outputDirectory, 'index.html');
  const metadata = getPageMeta(route.locale);
  const pageMetadata = [
    `<title>${escapeHtml(metadata.title)}</title>`,
    `<meta name="description" content="${escapeHtmlAttribute(metadata.description)}" />`,
    `<link rel="canonical" href="${siteUrl}${route.pathname}" />`,
    `<link rel="alternate" hreflang="en" href="${siteUrl}/en/" />`,
    `<link rel="alternate" hreflang="ru" href="${siteUrl}/ru/" />`,
    `<link rel="alternate" hreflang="x-default" href="${siteUrl}/" />`,
  ].join('\n    ');

  let document = replaceUnique(template, '<!--html-lang-->', route.locale);
  document = replaceUnique(document, '<!--page-meta-->', pageMetadata);
  document = replaceUnique(document, '<!--app-html-->', render(route.locale));

  if (!route.keepRootBootstrap) {
    document = document.replace(rootBootstrapPattern, '');
  }

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(outputPath, document);
}

function replaceUnique(source, marker, replacement) {
  const occurrences = source.split(marker).length - 1;

  if (occurrences !== 1) {
    throw new Error(
      `Expected one ${marker} marker in the client template, found ${occurrences}.`,
    );
  }

  return source.replace(marker, replacement);
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
