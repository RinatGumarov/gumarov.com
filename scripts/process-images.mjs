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
 */
export const approvedPersonalPhotos = [
  {
    slug: 'surf',
    file: 'surf.jpg',
    sha256: '52a7de95ba7da0e95f9ef9fd245e47723883ca912acbd678db16a740065023f4',
    crop: { left: 1000, top: 200, width: 4000, height: 3000 },
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

    for (const width of personalWidths) {
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

const isDirectInvocation =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isDirectInvocation && process.argv[2] === '--personal') {
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
