import { createHash } from 'node:crypto';
import {
  access,
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';
import {
  decodeHeicToPng,
  processPersonalPhotos,
  processPortrait,
  verifyApprovedSource,
} from './process-images.mjs';

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('portrait image pipeline', () => {
  it('rejects an unapproved HEIC before invoking the decoder', async () => {
    const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'heic-approval-'));
    temporaryDirectories.push(fixtureRoot);
    const inputPath = path.join(fixtureRoot, 'unapproved.heic');
    const outputDirectory = path.join(fixtureRoot, 'outputs');
    const intermediatePath = path.join(fixtureRoot, 'decoded.png');
    const markerPath = path.join(fixtureRoot, 'decoder-was-invoked');
    const decoderPath = path.join(fixtureRoot, 'heif-convert');

    await writeFile(inputPath, 'unapproved portrait fixture');
    await writeFile(
      decoderPath,
      `#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
await writeFile(${JSON.stringify(markerPath)}, 'invoked');
`,
    );
    await chmod(decoderPath, 0o755);

    const result = spawnSync(
      process.execPath,
      [
        path.resolve(process.cwd(), 'scripts/process-images.mjs'),
        inputPath,
        outputDirectory,
        intermediatePath,
      ],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${fixtureRoot}${path.delimiter}${process.env.PATH ?? ''}`,
        },
      },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'Approved portrait source SHA-256 mismatch: expected 82a737263a795f74b39bca2b78710cfdca336d8408566f458c8bb4e8c35d9310',
    );
    await expect(access(markerPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('decodes HEIC through the limits-disabled lossless PNG boundary', async () => {
    const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'heic-decoder-'));
    temporaryDirectories.push(fixtureRoot);
    const inputPath = path.join(fixtureRoot, 'fixture.heic');
    const outputPath = path.join(fixtureRoot, 'decoded.png');
    const decoderPath = path.join(fixtureRoot, 'controlled-decoder.mjs');

    await sharp({
      create: {
        width: 32,
        height: 40,
        channels: 3,
        background: '#123456',
      },
    })
      .png()
      .toFile(inputPath);
    await writeFile(
      decoderPath,
      `#!/usr/bin/env node
import { copyFile } from 'node:fs/promises';
if (process.argv[2] !== '--disable-limits') process.exit(42);
await copyFile(process.argv[3], process.argv[4]);
`,
    );
    await chmod(decoderPath, 0o755);

    const result = await decodeHeicToPng({
      decoderPath,
      inputPath,
      outputPath,
    });

    expect(result).toMatchObject({
      width: 32,
      height: 40,
      format: 'png',
    });
    expect(result.sha256).toBe(sha256(await readFile(outputPath)));
  });

  it('emits deterministic, metadata-free 4:5 images from a fixed centered crop', async () => {
    const fixtureRoot = await mkdtemp(
      path.join(tmpdir(), 'portrait-pipeline-'),
    );
    temporaryDirectories.push(fixtureRoot);
    const inputPath = path.join(fixtureRoot, 'fixture.png');
    const firstOutput = path.join(fixtureRoot, 'first');
    const secondOutput = path.join(fixtureRoot, 'second');

    await sharp(
      Buffer.from(`
        <svg width="1000" height="600" xmlns="http://www.w3.org/2000/svg">
          <rect width="260" height="600" fill="#ff0000" />
          <rect x="260" width="480" height="600" fill="#00ff00" />
          <rect x="740" width="260" height="600" fill="#0000ff" />
        </svg>
      `),
    )
      .png()
      .withExif({
        IFD0: { Make: 'Fixture Camera', Model: 'Metadata Must Be Removed' },
      })
      .toFile(inputPath);

    const firstManifest = await processPortrait({
      inputPath,
      outputDirectory: firstOutput,
    });
    const secondManifest = await processPortrait({
      inputPath,
      outputDirectory: secondOutput,
    });

    expect(firstManifest).toHaveLength(9);
    expect(secondManifest).toHaveLength(9);

    for (const width of [480, 768, 1024]) {
      for (const format of ['avif', 'webp', 'jpeg']) {
        const extension = format === 'jpeg' ? 'jpg' : format;
        const fileName = `portrait-${width}.${extension}`;
        const firstPath = path.join(firstOutput, fileName);
        const secondPath = path.join(secondOutput, fileName);
        const firstBytes = await readFile(firstPath);
        const secondBytes = await readFile(secondPath);
        const metadata = await sharp(firstBytes).metadata();

        expect(metadata.format).toBe(format === 'avif' ? 'heif' : format);
        expect(metadata.width).toBe(width);
        expect(metadata.height).toBe(width * 1.25);
        expect(metadata.exif).toBeUndefined();
        expect(metadata.xmp).toBeUndefined();
        expect(metadata.iptc).toBeUndefined();
        expect(metadata.icc).toBeUndefined();
        expect(metadata.orientation).toBeUndefined();
        expect(firstBytes.byteLength).toBeLessThanOrEqual(300 * 1024);
        expect(sha256(firstBytes)).toBe(sha256(secondBytes));
      }
    }

    const cropSamples = await sharp(path.join(firstOutput, 'portrait-480.jpg'))
      .extract({ left: 20, top: 299, width: 440, height: 1 })
      .resize({ width: 3, height: 1, fit: 'fill', kernel: 'nearest' })
      .removeAlpha()
      .raw()
      .toBuffer();
    for (let index = 0; index < cropSamples.length; index += 3) {
      expect(cropSamples[index + 1] - cropSamples[index]).toBeGreaterThan(120);
      expect(cropSamples[index + 1] - cropSamples[index + 2]).toBeGreaterThan(
        120,
      );
    }
  });
});

describe('personal photo pipeline', () => {
  it('rejects a personal source whose bytes are not the approved ones', async () => {
    const fixtureRoot = await mkdtemp(
      path.join(tmpdir(), 'personal-approval-'),
    );
    temporaryDirectories.push(fixtureRoot);
    const inputPath = path.join(fixtureRoot, 'surf.jpg');
    await writeFile(inputPath, 'not the approved photo');

    await expect(
      verifyApprovedSource(inputPath, 'a'.repeat(64)),
    ).rejects.toThrow(/Approved source SHA-256 mismatch/);
  });

  it('emits deterministic, metadata-free 4:3 images from each fixed crop', async () => {
    const fixtureRoot = await mkdtemp(
      path.join(tmpdir(), 'personal-pipeline-'),
    );
    temporaryDirectories.push(fixtureRoot);
    const inputDirectory = path.join(fixtureRoot, 'sources');
    const firstOutput = path.join(fixtureRoot, 'first');
    const secondOutput = path.join(fixtureRoot, 'second');

    // A 900x900 fixture: the middle horizontal band is green, the outer bands
    // red and blue. A crop of that band must yield a purely green result, which
    // proves the declared rectangle is honoured instead of a centred cover.
    await mkdir(inputDirectory, { recursive: true });
    const fixturePath = path.join(inputDirectory, 'surf.jpg');
    await sharp(
      Buffer.from(`
        <svg width="900" height="900" xmlns="http://www.w3.org/2000/svg">
          <rect width="900" height="300" fill="#ff0000" />
          <rect y="300" width="900" height="300" fill="#00ff00" />
          <rect y="600" width="900" height="300" fill="#0000ff" />
        </svg>
      `),
    )
      .jpeg()
      .withExif({
        IFD0: { Make: 'Fixture Camera', Model: 'Metadata Must Be Removed' },
      })
      .toFile(fixturePath);

    const photos = [
      {
        slug: 'surf',
        file: 'surf.jpg',
        crop: { left: 0, top: 300, width: 400, height: 300 },
      },
    ];

    const firstManifest = await processPersonalPhotos({
      inputDirectory,
      outputDirectory: firstOutput,
      photos,
    });
    const secondManifest = await processPersonalPhotos({
      inputDirectory,
      outputDirectory: secondOutput,
      photos,
    });

    expect(firstManifest).toHaveLength(6);
    expect(secondManifest).toHaveLength(6);

    for (const width of [480, 768]) {
      for (const format of ['avif', 'webp', 'jpeg']) {
        const extension = format === 'jpeg' ? 'jpg' : format;
        const fileName = `surf-${width}.${extension}`;
        const firstBytes = await readFile(path.join(firstOutput, fileName));
        const secondBytes = await readFile(path.join(secondOutput, fileName));
        const metadata = await sharp(firstBytes).metadata();

        expect(metadata.format).toBe(format === 'avif' ? 'heif' : format);
        expect(metadata.width).toBe(width);
        expect(metadata.height).toBe(Math.round((width * 3) / 4));
        expect(metadata.exif).toBeUndefined();
        expect(metadata.xmp).toBeUndefined();
        expect(metadata.iptc).toBeUndefined();
        expect(metadata.icc).toBeUndefined();
        expect(metadata.orientation).toBeUndefined();
        expect(firstBytes.byteLength).toBeLessThanOrEqual(120 * 1024);
        expect(sha256(firstBytes)).toBe(sha256(secondBytes));
      }
    }

    const [red, green, blue] = await sharp(
      path.join(firstOutput, 'surf-480.jpg'),
    )
      .resize({ width: 1, height: 1, fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer();
    expect(green - red).toBeGreaterThan(120);
    expect(green - blue).toBeGreaterThan(120);
  });
});

function sha256(contents) {
  return createHash('sha256').update(contents).digest('hex');
}
