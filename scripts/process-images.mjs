import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, readFile, rm, stat } from 'node:fs/promises';
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

const isDirectInvocation =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isDirectInvocation) {
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
