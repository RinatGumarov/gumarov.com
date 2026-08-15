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

  document = await inlineStylesheets(document);

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

async function inlineStylesheets(html) {
  const stylesheetPattern = /<link\b[^>]*>/gu;
  let inlined = html;

  for (const tagMatch of html.matchAll(stylesheetPattern)) {
    const tag = tagMatch[0];
    const rel = (readHtmlAttribute(tag, 'rel') ?? '').toLowerCase();
    if (!rel.split(/\s+/u).includes('stylesheet')) continue;

    const media = (readHtmlAttribute(tag, 'media') ?? 'all').toLowerCase();
    if (media === 'print') continue;

    const href = readHtmlAttribute(tag, 'href');
    if (!href || /^(?:https?:)?\/\//u.test(href)) {
      throw new Error(
        `Cannot inline remote stylesheet ${href ?? '(missing)'}.`,
      );
    }

    const relativePath = decodeURIComponent(href.replace(/^\/+/u, ''));
    const cssPath = path.resolve(distDirectory, relativePath);
    if (!cssPath.startsWith(distDirectory)) {
      throw new Error(`Stylesheet path escapes dist: ${href}`);
    }

    const css = await readFile(cssPath, 'utf8');
    inlined = inlined.replace(tag, `<style>${css}</style>`);
  }

  return inlined;
}

function readHtmlAttribute(tag, name) {
  const match = tag.match(
    new RegExp(`(?:^|\\s)${name}=(?:"([^"]*)"|'([^']*)')`, 'iu'),
  );
  return match?.[1] ?? match?.[2];
}
