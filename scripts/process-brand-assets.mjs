import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

/** Design tokens duplicated from `src/styles/tokens.css` for offline rendering. */
export const brandPalette = {
  backdrop: '#080b0f',
  surface: '#0d1117',
  panel: '#17202a',
  line: 'rgb(179 211 230 / 0.13)',
  lineStrong: 'rgb(179 211 230 / 0.26)',
  textStrong: '#f6f9fc',
  text: '#dbe4ec',
  textMuted: '#9caaba',
  textSubtle: '#738292',
  cyan: '#46d9f5',
  amber: '#e7ad65',
};

export const socialCardSize = { width: 1200, height: 630 };
export const socialCardPortrait = { width: 430, height: 630 };
export const appIconSizes = [192, 512];

const fontDirectory = 'public/assets/fonts';
const sansFontFile = `${fontDirectory}/Onest-Variable.woff2`;
const monoFontFile = `${fontDirectory}/IBMPlexMono-Variable.woff2`;

/**
 * The monogram is drawn as monoline geometry so the mark stays identical in
 * every renderer, including favicon contexts that cannot load the site fonts.
 */
export function renderMonogramSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="RG monogram">
  <rect width="64" height="64" rx="14" fill="${brandPalette.surface}" />
  <rect x="1.5" y="1.5" width="61" height="61" rx="12.5" fill="none" stroke="#b3d3e6" stroke-opacity="0.26" stroke-width="1" />
  <g fill="none" stroke="${brandPalette.cyan}" stroke-width="4" stroke-linecap="square" stroke-linejoin="miter">
    <path d="M18 46V18h5.5a5.5 5.5 0 0 1 0 11H18" />
    <path d="m23.5 29 5 17" />
    <path d="M46.5 27a8 8 0 1 0 0 10v-5h-4.5" />
  </g>
</svg>
`;
}

export async function renderAppIcon({ size }) {
  return sharp(Buffer.from(renderMonogramSvg()), { density: (72 * size) / 64 })
    .resize({ width: size, height: size, fit: 'contain' })
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();
}

export async function renderSocialCard({ card, portraitPath, projectRoot }) {
  const { width, height } = socialCardSize;
  const portraitLeft = width - socialCardPortrait.width;
  const portrait = await sharp(portraitPath)
    .resize({
      width: socialCardPortrait.width,
      height: socialCardPortrait.height,
      fit: 'cover',
      position: 'centre',
      kernel: sharp.kernel.lanczos3,
    })
    .toColourspace('srgb')
    .toBuffer();

  const backdrop =
    Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
      <path d="M60 0H0V60" fill="none" stroke="#b3d3e6" stroke-opacity="0.07" stroke-width="1" />
    </pattern>
    <linearGradient id="glow" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="${brandPalette.cyan}" stop-opacity="0.14" />
      <stop offset="0.55" stop-color="${brandPalette.cyan}" stop-opacity="0" />
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="${brandPalette.surface}" />
  <rect width="${width}" height="${height}" fill="url(#grid)" />
  <rect width="${width}" height="${height}" fill="url(#glow)" />
</svg>`);

  const overlay =
    Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <linearGradient id="blend" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${brandPalette.surface}" stop-opacity="0.92" />
      <stop offset="0.34" stop-color="${brandPalette.surface}" stop-opacity="0" />
    </linearGradient>
    <linearGradient id="depth" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.5" stop-color="${brandPalette.backdrop}" stop-opacity="0" />
      <stop offset="1" stop-color="${brandPalette.backdrop}" stop-opacity="0.45" />
    </linearGradient>
  </defs>
  <rect x="${portraitLeft}" width="${socialCardPortrait.width}" height="${height}" fill="url(#blend)" />
  <rect x="${portraitLeft}" width="${socialCardPortrait.width}" height="${height}" fill="url(#depth)" />
  <line x1="${portraitLeft}.5" y1="0" x2="${portraitLeft}.5" y2="${height}" stroke="#b3d3e6" stroke-opacity="0.26" stroke-width="1" />
  <line x1="80" y1="470" x2="140" y2="470" stroke="${brandPalette.cyan}" stroke-width="2" />
</svg>`);

  const textLayers = await Promise.all([
    renderTextLayer({
      projectRoot,
      markup: `<span letter_spacing="4200" foreground="${brandPalette.amber}">${escapePangoMarkup(card.role.toUpperCase())}</span>`,
      font: 'IBM Plex Mono Bold 20',
      fontfile: monoFontFile,
      width: 620,
      left: 80,
      top: 92,
    }),
    renderTextLayer({
      projectRoot,
      markup: `<span foreground="${brandPalette.textStrong}">${escapePangoMarkup(card.name)}</span>`,
      font: 'Onest Semi-Bold 74',
      fontfile: sansFontFile,
      width: 620,
      left: 80,
      top: 150,
    }),
    renderTextLayer({
      projectRoot,
      markup: `<span foreground="${brandPalette.text}">${escapePangoMarkup(card.headline)}</span>`,
      font: 'Onest 31',
      fontfile: sansFontFile,
      width: 600,
      spacing: 12,
      left: 82,
      top: 276,
    }),
    renderTextLayer({
      projectRoot,
      markup: `<span letter_spacing="1200" foreground="${brandPalette.textMuted}">${escapePangoMarkup(card.contact)}</span>`,
      font: 'IBM Plex Mono 23',
      fontfile: monoFontFile,
      width: 620,
      left: 80,
      top: 502,
    }),
  ]);

  return sharp(backdrop)
    .composite([
      { input: portrait, left: portraitLeft, top: 0 },
      { input: overlay, left: 0, top: 0 },
      ...textLayers,
    ])
    .jpeg({ quality: 82, chromaSubsampling: '4:2:0', progressive: true })
    .toBuffer();
}

async function renderTextLayer({
  projectRoot,
  markup,
  font,
  fontfile,
  width,
  spacing = 0,
  left,
  top,
}) {
  const input = await sharp({
    text: {
      text: markup,
      font,
      fontfile: path.join(projectRoot, fontfile),
      rgba: true,
      width,
      spacing,
      align: 'left',
      wrap: 'word',
      dpi: 72,
    },
  })
    .png()
    .toBuffer();

  return { input, left, top };
}

function escapePangoMarkup(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export async function processBrandAssets({
  projectRoot,
  publicDirectory,
  portraitFile,
  cards,
}) {
  await mkdir(publicDirectory, { recursive: true });
  const outputs = [];
  const record = async (file, contents) => {
    const outputPath = path.join(publicDirectory, file);
    await writeFile(outputPath, contents);
    const metadata = file.endsWith('.svg')
      ? { format: 'svg' }
      : await sharp(contents).metadata();
    outputs.push({
      file,
      format: file.endsWith('.svg') ? 'svg' : metadata.format,
      width: metadata.width,
      height: metadata.height,
      bytes: contents.byteLength,
      sha256: createHash('sha256').update(contents).digest('hex'),
    });
  };

  await record('favicon.svg', Buffer.from(renderMonogramSvg()));

  for (const size of appIconSizes) {
    await record(`icon-${size}.png`, await renderAppIcon({ size }));
  }

  for (const card of cards) {
    await record(
      card.file,
      await renderSocialCard({
        card,
        portraitPath: path.join(projectRoot, portraitFile),
        projectRoot,
      }),
    );
  }

  return outputs;
}

export async function verifyApprovedPortraitDerivative({
  projectRoot,
  portraitFile,
  approvedManifestFile,
}) {
  const contents = await readFile(path.join(projectRoot, portraitFile));
  const sha256 = createHash('sha256').update(contents).digest('hex');
  const approvedManifest = JSON.parse(
    await readFile(path.join(projectRoot, approvedManifestFile), 'utf8'),
  );
  const derivativeName = path.basename(portraitFile);
  const approvedOutput = approvedManifest.outputs?.find((output) =>
    output.file.endsWith(derivativeName),
  );

  if (!approvedOutput || approvedOutput.sha256 !== sha256) {
    throw new Error(
      `Social cards must use an approved portrait derivative: ${portraitFile} does not match ${approvedManifestFile}.`,
    );
  }

  return {
    file: portraitFile,
    width: approvedOutput.width,
    height: approvedOutput.height,
    bytes: contents.byteLength,
    sha256,
    source: approvedManifest.source,
  };
}

const isDirectInvocation =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isDirectInvocation) {
  const projectRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
  );
  const portraitFile = 'public/assets/portrait/portrait-1024.jpg';
  const approvedPortraitManifestFile =
    'public/assets/portrait/approved-manifest.json';
  const { en } = await import(path.join(projectRoot, 'src/content/en.ts'));
  const { ru } = await import(path.join(projectRoot, 'src/content/ru.ts'));
  const portrait = await verifyApprovedPortraitDerivative({
    projectRoot,
    portraitFile,
    approvedManifestFile: approvedPortraitManifestFile,
  });
  const outputs = await processBrandAssets({
    projectRoot,
    publicDirectory: path.join(projectRoot, 'public'),
    portraitFile,
    cards: [en, ru].map((content) => ({
      ...content.meta.socialCard,
      file: content.meta.ogImage.replace(/^\//u, ''),
    })),
  });
  const manifest = {
    schemaVersion: 1,
    source: portrait.source,
    portraitDerivative: {
      file: portrait.file.replace(/^public\//u, ''),
      width: portrait.width,
      height: portrait.height,
      bytes: portrait.bytes,
      sha256: portrait.sha256,
    },
    processing: {
      monogram: 'monoline-rg-paths',
      iconRasteriser: 'sharp-svg',
      socialCardCrop: 'fixed-centre-cover',
      socialCardSize: `${socialCardSize.width}x${socialCardSize.height}`,
      fonts: [sansFontFile, monoFontFile],
      metadataPolicy: 'exclude',
    },
    outputs,
  };

  await mkdir(path.join(projectRoot, 'public/assets/brand'), {
    recursive: true,
  });
  await writeFile(
    path.join(projectRoot, 'public/assets/brand/approved-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  console.log(JSON.stringify({ portrait, outputs }, null, 2));
}
