/**
 * Builds the Onest subset that ships with the document.
 *
 * The full variable face is 82 KB, which is too much to put in front of the
 * first paint; a subset of the glyphs this site actually renders is a third of
 * that, so it can be preloaded with the HTML and the heading never changes
 * typeface under the visitor. It stays one variable file rather than a handful
 * of static instances, but only across the weights the page asks for — 400 for
 * text, 650 for the headings, 700 for the actions and the identity line. The
 * rest of the axis is not free: 100–900 costs 11 KB more, all of it weights
 * nothing on this site can reach.
 *
 * The result is committed. Re-run `pnpm fonts:subset` after changing the
 * source face or adding a character the ranges below do not cover; the script
 * refuses to write a subset that misses a character the site renders.
 */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const fontDirectory = path.join(projectRoot, 'public', 'assets', 'fonts');
const sourceFile = path.join(fontDirectory, 'Onest-Variable.woff2');
const outputFile = path.join(fontDirectory, 'Onest-Subset.woff2');

/*
 * The weights the page sets, and no more. Every `font-weight` in `src/` that
 * lands on the sans is 400, 650 or 700; 100–500 and 501–900 belong to the two
 * `local()` fallback faces in `tokens.css`, which this file does not build.
 */
const weightAxis = { wght: { min: 400, max: 700 } };

/*
 * The budget is what a preload can cost without taking the bandwidth the LCP
 * text and the bundle need on a slow connection — the subset is fetched at the
 * same priority as the bundle, so every kilobyte here is a kilobyte the first
 * paint waits for. It sits just above the current result, deliberately: if a
 * subset exceeds it, narrow the ranges rather than raise the number.
 */
const byteBudget = 28 * 1024;

/**
 * Every code point the site can render in Onest, as inclusive ranges: the two
 * alphabets it is written in, then the punctuation, arrows and symbols the copy
 * and the components reach for. Ranges rather than the exact strings, because
 * the copy changes more often than this file does and a subset that fits only
 * today's wording would break the next edit silently.
 *
 * They are as wide as the budget allows and no wider. The whole Latin-1
 * Supplement block and the whole Cyrillic block together cost 45.9 KiB, which
 * is more than a preload should take from the first paint; the Latin letters
 * with diacritics and the Cyrillic alphabets nothing here is written in are
 * what came out. Adding a character back is a line below and a re-run.
 */
const codePointRanges = [
  [0x0020, 0x007e], // Basic Latin, printable.
  [0x00a0, 0x00a0], // The no-break space, which holds a unit to its number.
  [0x00a9, 0x00a9], // The copyright sign in the footer.
  [0x00ab, 0x00ab], // Opening guillemet, the Russian quotation mark.
  [0x00b0, 0x00b1], // Degree and plus-minus, for measurements.
  [0x00b7, 0x00b7], // The interpunct that separates meta items.
  [0x00bb, 0x00bb], // Closing guillemet.
  [0x00d7, 0x00d7], // The multiplication sign, for dimensions.
  [0x0410, 0x044f], // Cyrillic А–я.
  [0x0451, 0x0451], // ё, which sits outside that run.
  [0x0401, 0x0401], // Ё, likewise.
  [0x2010, 0x2027], // Dashes, quotes, ellipsis, bullet, dagger.
  [0x2030, 0x203a], // Per mille, primes, single guillemets.
  [0x2116, 0x2116], // The numero sign, which Russian copy uses for numbers.
  [0x2190, 0x2199], // The arrows the links and the hero actions render.
  [0x2212, 0x2212], // The minus sign, which is not the hyphen.
  [0x20ac, 0x20ac], // Euro.
  [0x20bd, 0x20bd], // Ruble.
];

/*
 * The files whose literal characters have to be covered. `content/` is the copy
 * itself; the components are here because a few glyphs are written straight
 * into the markup — the ↗ on every outbound link, the ↘ in the hero — and
 * nothing else would notice them going missing.
 */
const coverageFiles = [
  ...(await listSourceFiles(path.join(projectRoot, 'src', 'content'), (name) =>
    name.endsWith('.ts'),
  )),
  ...(await listSourceFiles(
    path.join(projectRoot, 'src', 'components'),
    (name) => name.endsWith('.tsx') && !name.endsWith('.test.tsx'),
  )),
];

const subsetCodePoints = new Set();
for (const [first, last] of codePointRanges) {
  for (let codePoint = first; codePoint <= last; codePoint += 1) {
    subsetCodePoints.add(codePoint);
  }
}

await assertCoverage();

const source = await readFile(sourceFile);
const subset = await subsetFont(
  source,
  String.fromCodePoint(...subsetCodePoints),
  { targetFormat: 'woff2', variationAxes: weightAxis },
);

if (subset.byteLength > byteBudget) {
  throw new Error(
    `The subset is ${formatKib(subset.byteLength)}; the budget is ${formatKib(byteBudget)}.`,
  );
}

await writeFile(outputFile, subset);
console.log(
  `Wrote ${path.relative(projectRoot, outputFile)}: ${formatKib(subset.byteLength)} from ${formatKib(source.byteLength)}, ${subsetCodePoints.size} code points requested, wght ${weightAxis.wght.min}–${weightAxis.wght.max}.`,
);

/**
 * Fails before anything is written if the site renders a character the ranges
 * do not carry. Importing the content is not an option here — it is TypeScript,
 * and this script runs outside the build — so the files are read as text, which
 * also covers the glyphs written directly into the components.
 */
async function assertCoverage() {
  const missing = new Map();

  for (const file of coverageFiles) {
    const text = withoutComments(await readFile(file, 'utf8'));

    for (const character of text) {
      const codePoint = character.codePointAt(0);
      // Whitespace is structure, not copy, and no face needs a glyph for it.
      if (codePoint < 0x20 || subsetCodePoints.has(codePoint)) continue;

      const where = missing.get(character) ?? new Set();
      where.add(path.relative(projectRoot, file));
      missing.set(character, where);
    }
  }

  if (missing.size === 0) return;

  const report = [...missing]
    .map(
      ([character, where]) =>
        `  ${formatCodePoint(character)} ${character} — ${[...where].join(', ')}`,
    )
    .join('\n');
  throw new Error(
    `These characters are rendered but outside the subset:\n${report}`,
  );
}

/**
 * Drops the comments, because a prose comment is not something a visitor sees
 * and the subset should not grow to cover an accent in one. Line comments are
 * only recognised on a line of their own — that is how they are written here,
 * and it keeps a `https://` inside a string from being read as one.
 */
function withoutComments(source) {
  return source
    .replaceAll(/\/\*[\s\S]*?\*\//gu, '')
    .replaceAll(/^[^\S\n]*\/\/.*$/gmu, '');
}

async function listSourceFiles(directory, matches) {
  const names = await readdir(directory);
  return names
    .filter((name) => matches(name))
    .sort()
    .map((name) => path.join(directory, name));
}

function formatCodePoint(character) {
  return `U+${character.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`;
}

function formatKib(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}
