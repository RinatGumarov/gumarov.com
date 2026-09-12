import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { personalPhotos, processPersonalPhotos } from './process-images.mjs';

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function temporaryDirectory(prefix) {
  const directory = await mkdtemp(path.join(tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

describe('personal photo pipeline', () => {
  /*
   * The one property of these derivatives that cannot be checked by looking at
   * them: the originals are personal photographs, and their EXIF carries
   * capture times and, for some of them, GPS coordinates. Sharp only drops
   * metadata because nothing here asks it to keep it, which is exactly the
   * kind of default a later edit can reverse without anyone noticing.
   */
  it('writes metadata-free 4:3 derivatives at every declared width', async () => {
    const inputDirectory = await temporaryDirectory('photo-source-');
    const outputDirectory = await temporaryDirectory('photo-output-');
    const photo = personalPhotos[0];

    await sharp({
      create: {
        width: photo.crop.left + photo.crop.width,
        height: photo.crop.top + photo.crop.height,
        channels: 3,
        background: '#2d6a8f',
      },
    })
      .withMetadata({ exif: { IFD0: { Copyright: 'fixture' } } })
      .jpeg()
      .toFile(path.join(inputDirectory, photo.file));

    const written = await processPersonalPhotos({
      inputDirectory,
      outputDirectory,
      photos: [photo],
    });
    const widths = photo.widths ?? [480, 768];

    expect(written).toHaveLength(widths.length * 3);
    expect((await readdir(outputDirectory)).sort()).toEqual(
      [...written].sort(),
    );

    for (const width of widths) {
      for (const extension of ['avif', 'webp', 'jpg']) {
        const metadata = await sharp(
          path.join(outputDirectory, `${photo.slug}-${width}.${extension}`),
        ).metadata();

        expect(metadata.width).toBe(width);
        expect(metadata.height).toBe(Math.round((width * 3) / 4));
        for (const kind of ['exif', 'xmp', 'iptc', 'icc', 'orientation']) {
          expect(metadata[kind]).toBeUndefined();
        }
      }
    }
  }, 60_000);
});
