import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import sharp from 'sharp';

const execFileAsync = promisify(execFile);

export const approvedPortraitSourceSha256 =
  '82a737263a795f74b39bca2b78710cfdca336d8408566f458c8bb4e8c35d9310';

const portraitWidths = [480, 768, 1024];
const portraitFormats = [
  {
    name: 'avif',
    extension: 'avif',
    encode(image) {
      return image.avif({ quality: 58, effort: 6 });
    },
  },
  {
    name: 'webp',
    extension: 'webp',
    encode(image) {
      return image.webp({ quality: 82, effort: 6, smartSubsample: true });
    },
  },
  {
    name: 'jpeg',
    extension: 'jpg',
    encode(image) {
      return image.jpeg({
        quality: 82,
        chromaSubsampling: '4:2:0',
        progressive: true,
      });
    },
  },
];

export async function processPortrait({ inputPath, outputDirectory }) {
  await mkdir(outputDirectory, { recursive: true });
  const manifest = [];

  for (const width of portraitWidths) {
    const height = Math.round(width * 1.25);

    for (const format of portraitFormats) {
      const fileName = `portrait-${width}.${format.extension}`;
      const outputPath = path.join(outputDirectory, fileName);
      const image = sharp(inputPath)
        .rotate()
        .resize({
          width,
          height,
          fit: 'cover',
          position: 'centre',
          kernel: sharp.kernel.lanczos3,
        })
        .toColourspace('srgb')
        .modulate({ brightness: 0.92, saturation: 0.88 });

      await format.encode(image).toFile(outputPath);
      const contents = await readFile(outputPath);
      manifest.push({
        file: fileName,
        format: format.name,
        width,
        height,
        bytes: (await stat(outputPath)).size,
        sha256: createHash('sha256').update(contents).digest('hex'),
      });
    }
  }

  return manifest;
}

export async function decodeHeicToPng({
  decoderPath = 'heif-convert',
  inputPath,
  outputPath,
}) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await rm(outputPath, { force: true });
  await execFileAsync(decoderPath, ['--disable-limits', inputPath, outputPath]);

  const contents = await readFile(outputPath);
  const metadata = await sharp(contents).metadata();
  return {
    file: outputPath,
    format: metadata.format,
    width: metadata.width,
    height: metadata.height,
    bytes: contents.byteLength,
    sha256: createHash('sha256').update(contents).digest('hex'),
  };
}

export async function verifyApprovedSource(inputPath, expectedSha256) {
  const contents = await readFile(inputPath);
  const actualSha256 = createHash('sha256').update(contents).digest('hex');

  if (actualSha256 !== expectedSha256) {
    throw new Error(
      `Approved source SHA-256 mismatch for ${path.basename(inputPath)}: expected ${expectedSha256}, received ${actualSha256}.`,
    );
  }

  return {
    file: inputPath,
    bytes: contents.byteLength,
    sha256: actualSha256,
  };
}

export async function verifyApprovedPortraitSource(inputPath) {
  const contents = await readFile(inputPath);
  const actualSha256 = createHash('sha256').update(contents).digest('hex');

  if (actualSha256 !== approvedPortraitSourceSha256) {
    throw new Error(
      `Approved portrait source SHA-256 mismatch: expected ${approvedPortraitSourceSha256}, received ${actualSha256}.`,
    );
  }

  return {
    file: inputPath,
    bytes: contents.byteLength,
    sha256: actualSha256,
  };
}

const personalWidths = [480, 768];

/**
 * Fixed crop rectangles measured once against the auto-oriented source pixels.
 * They keep each subject inside the 4:3 film-strip frame without a gravity
 * heuristic, so re-running the pipeline cannot silently re-frame a photo.
 *
 * Every derivative keeps the same 4:3 crop regardless of `widths`: the surf
 * frame's desktop 16:9 presentation is produced in CSS (object-fit: cover
 * inside an aspect-ratio: 16/9 figure), not by extracting a second, narrower
 * rectangle here. Widths above the shared `personalWidths` default are
 * declared per photo only where the personal-section layout (plan §4/§7)
 * displays that photo wider than the 480/768 set was sized for.
 */
export const approvedPersonalPhotos = [
  {
    slug: 'surf',
    file: 'surf.jpg',
    sha256: '52a7de95ba7da0e95f9ef9fd245e47723883ca912acbd678db16a740065023f4',
    crop: { left: 1000, top: 200, width: 4000, height: 3000 },
    // Full-bleed lead frame at up to --content-wide (1280px); the desktop
    // 16:9 crop is a CSS object-fit, so the raster itself must resolve at
    // real desktop widths instead of being upscaled from 768w.
    widths: [480, 768, 960, 1440, 1920],
  },
  {
    slug: 'skate',
    file: 'skate.jpg',
    sha256: '86ee2c416cea3a0cf1ab8560ba540e3c30592dae069aa0bbb6baa8dec0a3ad7f',
    crop: { left: 0, top: 390, width: 3680, height: 2760 },
  },
  {
    slug: 'snowboard',
    file: 'snowboard.jpg',
    sha256: '8fceebec257df1f33f90bbf553a269b40abc9e37bd190cd1c6826ed4543b0258',
    crop: { left: 480, top: 0, width: 2880, height: 2160 },
  },
  {
    slug: 'drift-rear',
    file: 'drift-rear.png',
    sha256: '1c881495bd421e7ca056efb1fecf09cbc1e428bb779360f32e719ec051fa2224',
    // Source is 2560x1706 with a credit bar occupying the bottom 66px
    // (from row 1640). Height 1620 clears it with margin.
    crop: { left: 200, top: 0, width: 2160, height: 1620 },
  },
  {
    slug: 'powder',
    file: 'powder.png',
    sha256: 'd8f6176cbde98511e66ee297e79ac99b1e1c1b9334ef9cdbbbf94abca729468e',
    crop: { left: 480, top: 0, width: 2880, height: 2160 },
  },
  {
    slug: 'drift-front',
    file: 'drift-front.jpg',
    sha256: '371ce8799176881205728e5fbd6cafd4b8e8f9d3af30968c40815e1e73e1b575',
    // Source is 2880x1887 with a credit bar occupying the bottom 68px
    // (from row 1819). Height 1800 clears it with margin.
    crop: { left: 240, top: 0, width: 2400, height: 1800 },
    // First activity row, 7-of-12 columns: displayed wider than 600 CSS px
    // on desktop (plan §7), so it gets a retina-capable derivative.
    widths: [480, 768, 1200],
  },
];

export async function processPersonalPhotos({
  inputDirectory,
  outputDirectory,
  photos = approvedPersonalPhotos,
}) {
  await mkdir(outputDirectory, { recursive: true });
  const manifest = [];

  for (const photo of photos) {
    const inputPath = path.join(inputDirectory, photo.file);

    for (const width of photo.widths ?? personalWidths) {
      const height = Math.round((width * 3) / 4);

      for (const format of portraitFormats) {
        const fileName = `${photo.slug}-${width}.${format.extension}`;
        const outputPath = path.join(outputDirectory, fileName);
        const image = sharp(inputPath)
          .rotate()
          .extract(photo.crop)
          .resize({
            width,
            height,
            fit: 'cover',
            position: 'centre',
            kernel: sharp.kernel.lanczos3,
          })
          .toColourspace('srgb')
          .modulate({ brightness: 0.92, saturation: 0.88 });

        await format.encode(image).toFile(outputPath);
        const contents = await readFile(outputPath);
        manifest.push({
          file: fileName,
          slug: photo.slug,
          format: format.name,
          width,
          height,
          bytes: (await stat(outputPath)).size,
          sha256: createHash('sha256').update(contents).digest('hex'),
        });
      }
    }
  }

  return manifest;
}

const projectWidths = [640, 960, 1440];

/**
 * Product screenshots for the work scenes. Each crop starts below the browser
 * chrome — detected once at row 310 of the 3024x1964 captures — so no tab bar,
 * address bar or bookmark strip reaches the site. Stoic starts lower still,
 * because its application header carries the signed-in account's address.
 * Full source width is kept and the height fixed at 2:1, so no interface is
 * ever cut mid-word.
 */
export const approvedProjectScreenshots = [
  {
    slug: 'tradingview',
    file: 'tradingview.png',
    sha256: '63f9d90139adf8b99fffb0bebe931648f6c89311d25e9eca3434568adb7fde99',
    crop: { left: 0, top: 310, width: 3024, height: 1512 },
  },
  {
    slug: 'stoic',
    file: 'stoic.png',
    sha256: '4f29598e25d5aa6ddd65956de6a7721fd7c0f0c87cd0ce29525efe8828f6fa22',
    crop: { left: 0, top: 440, width: 3024, height: 1512 },
  },
  {
    slug: 'splithub',
    file: 'splithub.png',
    sha256: '141a6b0b5a86296f4dfd1f49165eeb94c27b22af3e870c1623a8204d9c977d22',
    crop: { left: 0, top: 310, width: 3024, height: 1512 },
  },
  {
    slug: 'evercity',
    file: 'evercity.png',
    sha256: 'dc6bd17beb17bb2791a076aeef8a110e3dee0e5f2b99441b2d5276cdb4f0a9be',
    crop: { left: 0, top: 310, width: 3024, height: 1512 },
  },
];

export async function processProjectScreenshots({
  inputDirectory,
  outputDirectory,
  screenshots = approvedProjectScreenshots,
}) {
  await mkdir(outputDirectory, { recursive: true });
  const manifest = [];

  for (const shot of screenshots) {
    const inputPath = path.join(inputDirectory, shot.file);

    for (const width of projectWidths) {
      const height = Math.round(width / 2);

      for (const format of portraitFormats) {
        const fileName = `${shot.slug}-${width}.${format.extension}`;
        const outputPath = path.join(outputDirectory, fileName);
        // Screenshots are flat UI, not photographs: keep them unmodulated so
        // the interface stays legible instead of dimmed to match the portrait.
        const image = sharp(inputPath)
          .extract(shot.crop)
          .resize({
            width,
            height,
            fit: 'cover',
            kernel: sharp.kernel.lanczos3,
          })
          .toColourspace('srgb');

        await format.encode(image).toFile(outputPath);
        const contents = await readFile(outputPath);
        manifest.push({
          file: fileName,
          slug: shot.slug,
          format: format.name,
          width,
          height,
          bytes: (await stat(outputPath)).size,
          sha256: createHash('sha256').update(contents).digest('hex'),
        });
      }
    }
  }

  return manifest;
}

/*
 * The Splithub app crop.
 *
 * Unlike every other derivative here, this one is cut from an approved
 * *derivative* rather than from an original capture: the project sources live
 * outside the repository, and the largest Splithub pixels available locally are
 * the 1440x720 JPEG this pipeline already produced. The rectangle below lifts
 * the phone and both of its floating notifications out of that composite so the
 * portfolio can show the application instead of another landing page.
 *
 * The consequence is a hard ceiling: 624px is the crop's native width and
 * nothing here upscales past it. If the original 3024px capture is ever added
 * to `assets-source/projects/`, this should be re-cut from it — run `--projects`
 * first, then this mode, since this one merges into the manifest that writes.
 */
export const approvedSplithubAppCrop = {
  slug: 'splithub-app',
  // The approved 1440w Splithub derivative, by content hash.
  source: 'assets/projects/splithub-1440.jpg',
  sha256: '8f99d3d2e89ca09fe3f2bb8abed8cd4eb69edb064ee0cb0a33722604fe7f38ab',
  // Bounds the device (x 864-1168, y 111-720) and both notification cards
  // (x 720-891 / y 138-188 and x 1125-1308 / y 632-682) with a small margin,
  // so nothing in the composition is cut.
  crop: { left: 696, top: 96, width: 624, height: 624 },
  widths: [312, 624],
};

export async function processSplithubAppCrop({
  sourcePath,
  outputDirectory,
  descriptor = approvedSplithubAppCrop,
}) {
  await mkdir(outputDirectory, { recursive: true });
  const manifest = [];

  for (const width of descriptor.widths) {
    const height = Math.round(
      (width * descriptor.crop.height) / descriptor.crop.width,
    );

    for (const format of portraitFormats) {
      const fileName = `${descriptor.slug}-${width}.${format.extension}`;
      const outputPath = path.join(outputDirectory, fileName);
      // Flat interface pixels, like the other project captures: no modulate
      // pass, so the application stays exactly as it was captured.
      const image = sharp(sourcePath)
        .extract(descriptor.crop)
        .resize({ width, height, fit: 'cover', kernel: sharp.kernel.lanczos3 })
        .toColourspace('srgb');

      await format.encode(image).toFile(outputPath);
      const contents = await readFile(outputPath);
      manifest.push({
        file: fileName,
        slug: descriptor.slug,
        format: format.name,
        width,
        height,
        bytes: (await stat(outputPath)).size,
        sha256: createHash('sha256').update(contents).digest('hex'),
      });
    }
  }

  return manifest;
}

const isDirectInvocation =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isDirectInvocation && process.argv[2] === '--projects') {
  const projectRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
  );
  const inputDirectory = path.resolve(
    projectRoot,
    process.argv[3] ?? 'assets-source/projects',
  );
  const outputDirectory = path.resolve(
    projectRoot,
    process.argv[4] ?? 'public/assets/projects',
  );
  const sources = [];
  for (const shot of approvedProjectScreenshots) {
    sources.push(
      await verifyApprovedSource(
        path.join(inputDirectory, shot.file),
        shot.sha256,
      ),
    );
  }
  const outputs = await processProjectScreenshots({
    inputDirectory,
    outputDirectory,
  });
  const manifest = {
    schemaVersion: 1,
    sources: approvedProjectScreenshots.map((shot, index) => ({
      slug: shot.slug,
      file: `assets-source/projects/${shot.file}`,
      bytes: sources[index].bytes,
      sha256: shot.sha256,
      crop: shot.crop,
    })),
    processing: {
      crop: 'fixed-rectangle-extract-below-browser-chrome',
      aspectRatio: '2:1',
      resizeKernel: 'lanczos3',
      colourspace: 'srgb',
      metadataPolicy: 'exclude',
    },
    outputs: outputs.map((output) => ({
      ...output,
      file: `assets/projects/${output.file}`,
    })),
  };
  await writeFile(
    path.join(outputDirectory, 'approved-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  console.log(JSON.stringify({ sources, outputs }, null, 2));
} else if (isDirectInvocation && process.argv[2] === '--splithub-app') {
  const projectRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
  );
  const outputDirectory = path.resolve(
    projectRoot,
    process.argv[3] ?? 'public/assets/projects',
  );
  const sourcePath = path.join(
    projectRoot,
    'public',
    approvedSplithubAppCrop.source,
  );
  const source = await verifyApprovedSource(
    sourcePath,
    approvedSplithubAppCrop.sha256,
  );
  const outputs = await processSplithubAppCrop({ sourcePath, outputDirectory });
  const manifestPath = path.join(outputDirectory, 'approved-manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const entry = {
    slug: approvedSplithubAppCrop.slug,
    file: approvedSplithubAppCrop.source,
    derivedFrom: 'splithub',
    bytes: source.bytes,
    sha256: approvedSplithubAppCrop.sha256,
    crop: approvedSplithubAppCrop.crop,
  };
  manifest.sources = [
    ...manifest.sources.filter((item) => item.slug !== entry.slug),
    entry,
  ];
  manifest.outputs = [
    ...manifest.outputs.filter(
      (item) => item.slug !== approvedSplithubAppCrop.slug,
    ),
    ...outputs.map((output) => ({
      ...output,
      file: `assets/projects/${output.file}`,
    })),
  ];
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({ source, outputs }, null, 2));
} else if (isDirectInvocation && process.argv[2] === '--personal') {
  const projectRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
  );
  const inputDirectory = path.resolve(
    projectRoot,
    process.argv[3] ?? 'assets-source/personal',
  );
  const outputDirectory = path.resolve(
    projectRoot,
    process.argv[4] ?? 'public/assets/personal',
  );
  const sources = [];
  for (const photo of approvedPersonalPhotos) {
    sources.push(
      await verifyApprovedSource(
        path.join(inputDirectory, photo.file),
        photo.sha256,
      ),
    );
  }
  const outputs = await processPersonalPhotos({
    inputDirectory,
    outputDirectory,
  });
  const manifest = {
    schemaVersion: 1,
    sources: approvedPersonalPhotos.map((photo, index) => ({
      slug: photo.slug,
      file: `assets-source/personal/${photo.file}`,
      bytes: sources[index].bytes,
      sha256: photo.sha256,
      crop: photo.crop,
    })),
    processing: {
      crop: 'fixed-rectangle-extract',
      aspectRatio: '4:3',
      resizeKernel: 'lanczos3',
      colourspace: 'srgb',
      brightness: 0.92,
      saturation: 0.88,
      metadataPolicy: 'exclude',
    },
    outputs: outputs.map((output) => ({
      ...output,
      file: `assets/personal/${output.file}`,
    })),
  };
  await writeFile(
    path.join(outputDirectory, 'approved-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  console.log(JSON.stringify({ sources, outputs }, null, 2));
} else if (isDirectInvocation) {
  const projectRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
  );
  const inputPath = path.resolve(
    projectRoot,
    process.argv[2] ?? 'assets-source/portrait.heic',
  );
  const outputDirectory = path.resolve(
    projectRoot,
    process.argv[3] ?? 'public/assets/portrait',
  );
  const intermediatePath = path.resolve(
    projectRoot,
    process.argv[4] ?? 'assets-source/portrait-decoded.png',
  );
  const source = await verifyApprovedPortraitSource(inputPath);
  const intermediate = await decodeHeicToPng({
    inputPath,
    outputPath: intermediatePath,
  });
  const outputs = await processPortrait({
    inputPath: intermediatePath,
    outputDirectory,
  });
  console.log(JSON.stringify({ source, intermediate, outputs }, null, 2));
}
