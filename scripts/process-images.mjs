import { execFile } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import sharp from 'sharp';

const execFileAsync = promisify(execFile);

const portraitWidths = [480, 768, 1024];
const imageFormats = [
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
  const written = [];

  for (const width of portraitWidths) {
    const height = Math.round(width * 1.25);

    for (const format of imageFormats) {
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
      written.push(fileName);
    }
  }

  return written;
}

export async function decodeHeicToPng({
  decoderPath = 'heif-convert',
  inputPath,
  outputPath,
}) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await rm(outputPath, { force: true });
  await execFileAsync(decoderPath, ['--disable-limits', inputPath, outputPath]);
  return outputPath;
}

const personalWidths = [480, 768];

/**
 * Fixed crop rectangles measured once against the auto-oriented source pixels.
 * They keep each subject inside the 4:3 frame without a gravity heuristic, so
 * re-running the pipeline cannot silently re-frame a photo.
 *
 * Every derivative keeps the same 4:3 crop: the surf frame's desktop 16:9
 * presentation is an `object-fit: cover` in CSS, not a second, narrower
 * rectangle extracted here.
 */
export const personalPhotos = [
  {
    slug: 'surf',
    file: 'surf.jpg',
    crop: { left: 1000, top: 200, width: 4000, height: 3000 },
  },
  {
    slug: 'snowboard',
    file: 'snowboard.jpg',
    crop: { left: 480, top: 0, width: 2880, height: 2160 },
  },
  {
    slug: 'drift-front',
    file: 'drift-front.jpg',
    // Source is 2880x1887 with an event photographer's credit bar occupying
    // the bottom 68px (from row 1819). Height 1800 clears it with margin.
    crop: { left: 240, top: 0, width: 2400, height: 1800 },
  },
];

export async function processPersonalPhotos({
  inputDirectory,
  outputDirectory,
  photos = personalPhotos,
}) {
  await mkdir(outputDirectory, { recursive: true });
  const written = [];

  for (const photo of photos) {
    const inputPath = path.join(inputDirectory, photo.file);

    for (const width of personalWidths) {
      const height = Math.round((width * 3) / 4);

      for (const format of imageFormats) {
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
        written.push(fileName);
      }
    }
  }

  return written;
}

const projectWidths = [640, 960, 1440];

/**
 * Product screenshots for the work scenes. Each crop starts below the browser
 * chrome — row 310 of the 3024x1964 captures — so no tab bar, address bar or
 * bookmark strip reaches the site. Full source width is kept and the height
 * fixed at 2:1, so no interface is cut mid-word.
 */
export const projectScreenshots = [
  {
    slug: 'tradingview',
    file: 'tradingview.png',
    crop: { left: 0, top: 310, width: 3024, height: 1512 },
  },
  {
    // The landing composite is not rendered on the page, but it is the only
    // Splithub source in the repository and `--splithub-app` cuts from it.
    slug: 'splithub',
    file: 'splithub.png',
    crop: { left: 0, top: 310, width: 3024, height: 1512 },
  },
];

export async function processProjectScreenshots({
  inputDirectory,
  outputDirectory,
  screenshots = projectScreenshots,
}) {
  await mkdir(outputDirectory, { recursive: true });
  const written = [];

  for (const shot of screenshots) {
    const inputPath = path.join(inputDirectory, shot.file);

    for (const width of projectWidths) {
      const height = Math.round(width / 2);

      for (const format of imageFormats) {
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
        written.push(fileName);
      }
    }
  }

  return written;
}

/*
 * The one derivative cut from another derivative: the Splithub source capture
 * lives outside this repository, so the largest pixels available are the
 * 1440x720 JPEG this pipeline already produced. That caps the crop at its
 * native 624px — nothing here upscales. If the original 3024px capture is ever
 * added to `assets-source/projects/`, re-cut this from it after `--projects`.
 */
export const splithubAppCrop = {
  slug: 'splithub-app',
  source: 'assets/projects/splithub-1440.jpg',
  // Bounds the device (x 864-1168, y 111-720) and both notification cards
  // (x 720-891 / y 138-188 and x 1125-1308 / y 632-682) with a small margin,
  // so nothing in the composition is cut.
  crop: { left: 696, top: 96, width: 624, height: 624 },
  widths: [312, 624],
};

export async function processSplithubAppCrop({
  sourcePath,
  outputDirectory,
  descriptor = splithubAppCrop,
}) {
  await mkdir(outputDirectory, { recursive: true });
  const written = [];

  for (const width of descriptor.widths) {
    const height = Math.round(
      (width * descriptor.crop.height) / descriptor.crop.width,
    );

    for (const format of imageFormats) {
      const fileName = `${descriptor.slug}-${width}.${format.extension}`;
      const outputPath = path.join(outputDirectory, fileName);
      // Flat interface pixels, like the other project captures: no modulate
      // pass, so the application stays exactly as it was captured.
      const image = sharp(sourcePath)
        .extract(descriptor.crop)
        .resize({ width, height, fit: 'cover', kernel: sharp.kernel.lanczos3 })
        .toColourspace('srgb');

      await format.encode(image).toFile(outputPath);
      written.push(fileName);
    }
  }

  return written;
}

const isDirectInvocation =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

function resolveArgument(index, fallback) {
  return path.resolve(projectRoot, process.argv[index] ?? fallback);
}

if (isDirectInvocation && process.argv[2] === '--projects') {
  console.log(
    await processProjectScreenshots({
      inputDirectory: resolveArgument(3, 'assets-source/projects'),
      outputDirectory: resolveArgument(4, 'public/assets/projects'),
    }),
  );
} else if (isDirectInvocation && process.argv[2] === '--splithub-app') {
  console.log(
    await processSplithubAppCrop({
      sourcePath: path.join(projectRoot, 'public', splithubAppCrop.source),
      outputDirectory: resolveArgument(3, 'public/assets/projects'),
    }),
  );
} else if (isDirectInvocation && process.argv[2] === '--personal') {
  console.log(
    await processPersonalPhotos({
      inputDirectory: resolveArgument(3, 'assets-source/personal'),
      outputDirectory: resolveArgument(4, 'public/assets/personal'),
    }),
  );
} else if (isDirectInvocation) {
  // The portrait arrives as HEIC, which Sharp cannot read, so it is decoded
  // losslessly to PNG first and the PNG is what the derivatives come from.
  const intermediatePath = resolveArgument(
    4,
    'assets-source/portrait-decoded.png',
  );
  await decodeHeicToPng({
    inputPath: resolveArgument(2, 'assets-source/portrait.heic'),
    outputPath: intermediatePath,
  });
  console.log(
    await processPortrait({
      inputPath: intermediatePath,
      outputDirectory: resolveArgument(3, 'public/assets/portrait'),
    }),
  );
}
