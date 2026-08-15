import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { renderPageMetadata, siteUrl } from './page-metadata.mjs';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const distDirectory = path.join(projectRoot, 'dist');
const templatePath = path.join(distDirectory, 'index.html');
const serverEntryUrl = pathToFileURL(
  path.join(projectRoot, 'dist-ssr', 'entry-server.js'),
).href;
const rootBootstrapPattern =
  /\s*<script\s+data-root-locale-bootstrap>[\s\S]*?<\/script>/u;

const template = await readFile(templatePath, 'utf8');
const { getContent, render } = await import(serverEntryUrl);

const routes = [
  { directory: '', locale: 'en', pathname: '/', keepRootBootstrap: true },
  { directory: 'en', locale: 'en', pathname: '/en/' },
  { directory: 'ru', locale: 'ru', pathname: '/ru/' },
];

for (const route of routes) {
  const outputDirectory = path.join(distDirectory, route.directory);
  const outputPath = path.join(outputDirectory, 'index.html');
  const pageMetadata = renderPageMetadata({
    canonical: `${siteUrl}${route.pathname}`,
    content: getContent(route.locale),
  }).join('\n    ');

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
