import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';
import {
  processBrandAssets,
  renderMonogramSvg,
  verifyApprovedPortraitDerivative,
} from './process-brand-assets.mjs';

const projectRoot = process.cwd();
const temporaryDirectories = [];

/** `stats()` reports on the whole input, so each region is materialised first. */
async function sampleRegion(image, region) {
  const cropped = await sharp(image).extract(region).png().toBuffer();
  const { channels } = await sharp(cropped).stats();
  return channels.map((channel) => channel.mean);
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('brand asset pipeline', () => {
  it('emits deterministic, metadata-free icons and localized social cards', async () => {
    const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'brand-assets-'));
    temporaryDirectories.push(fixtureRoot);
    const cards = [
      {
        file: 'og-en.jpg',
        name: 'Rinat Gumarov',
        role: 'Senior Frontend Engineer',
        headline: 'Complex interfaces for ambitious products.',
        contact: 'gumarov.com · @RinatGumarov',
      },
      {
        file: 'og-ru.jpg',
        name: 'Ринат Гумаров',
        role: 'Senior Frontend Engineer',
        headline: 'Сложные интерфейсы для амбициозных продуктов.',
        contact: 'gumarov.com · @RinatGumarov',
      },
    ];
    const options = {
      projectRoot,
      portraitFile: 'public/assets/portrait/portrait-1024.jpg',
      cards,
    };

    const first = await processBrandAssets({
      ...options,
      publicDirectory: path.join(fixtureRoot, 'first'),
    });
    const second = await processBrandAssets({
      ...options,
      publicDirectory: path.join(fixtureRoot, 'second'),
    });

    expect(first.map((output) => output.file)).toEqual([
      'favicon.svg',
      'icon-192.png',
      'icon-512.png',
      'og-en.jpg',
      'og-ru.jpg',
    ]);
    expect(first.map((output) => output.sha256)).toEqual(
      second.map((output) => output.sha256),
    );

    for (const output of first) {
      const contents = await readFile(
        path.join(fixtureRoot, 'first', output.file),
      );
      expect(createHash('sha256').update(contents).digest('hex')).toBe(
        output.sha256,
      );

      if (output.file.endsWith('.svg')) continue;

      const metadata = await sharp(contents).metadata();
      expect(metadata.format).toBe(
        output.file.endsWith('.png') ? 'png' : 'jpeg',
      );
      expect(metadata.exif).toBeUndefined();
      expect(metadata.icc).toBeUndefined();
      expect(metadata.orientation).toBeUndefined();
    }

    const icon = first.find((output) => output.file === 'icon-512.png');
    expect(icon).toMatchObject({ width: 512, height: 512 });
    for (const card of ['og-en.jpg', 'og-ru.jpg']) {
      const output = first.find((entry) => entry.file === card);
      expect(output).toMatchObject({ width: 1200, height: 630 });
      expect(output.bytes).toBeLessThanOrEqual(300 * 1024);
    }

    const englishCard = await readFile(
      path.join(fixtureRoot, 'first', 'og-en.jpg'),
    );
    const russianCard = await readFile(
      path.join(fixtureRoot, 'first', 'og-ru.jpg'),
    );
    expect(englishCard.equals(russianCard)).toBe(false);

    const approvedCrop = await sharp(
      path.join(projectRoot, 'public/assets/portrait/portrait-1024.jpg'),
    )
      .resize({
        width: 430,
        height: 630,
        fit: 'cover',
        position: 'centre',
        kernel: sharp.kernel.lanczos3,
      })
      .toBuffer();
    const sampledRegion = { top: 96, width: 48, height: 48 };
    const cardSample = await sampleRegion(englishCard, {
      ...sampledRegion,
      left: 1140,
    });
    const approvedSample = await sampleRegion(approvedCrop, {
      ...sampledRegion,
      left: 370,
    });

    for (const [channel, mean] of cardSample.entries()) {
      expect(Math.abs(mean - approvedSample[channel])).toBeLessThan(6);
    }
  });

  it('keeps the monogram free of fonts, scripts, and remote references', () => {
    const monogram = renderMonogramSvg();

    expect(monogram).toMatch(/^<svg[^>]*viewBox="0 0 64 64"/u);
    expect(monogram).not.toMatch(/<text|font-family|<script|<image/u);
    expect(monogram).not.toMatch(/\b(?:href|src|url\()/u);
    expect(monogram).toContain('#46d9f5');
  });

  it('refuses a portrait that is not an approved derivative', async () => {
    const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'brand-approval-'));
    temporaryDirectories.push(fixtureRoot);
    await mkdir(path.join(fixtureRoot, 'media'), { recursive: true });
    await sharp({
      create: { width: 64, height: 80, channels: 3, background: '#123456' },
    })
      .jpeg()
      .toFile(path.join(fixtureRoot, 'media/portrait-1024.jpg'));
    await writeFile(
      path.join(fixtureRoot, 'approved-manifest.json'),
      JSON.stringify({
        schemaVersion: 1,
        source: { sha256: 'unrelated' },
        outputs: [
          {
            file: 'assets/portrait/portrait-1024.jpg',
            sha256: 'a'.repeat(64),
          },
        ],
      }),
    );

    await expect(
      verifyApprovedPortraitDerivative({
        projectRoot: fixtureRoot,
        portraitFile: 'media/portrait-1024.jpg',
        approvedManifestFile: 'approved-manifest.json',
      }),
    ).rejects.toThrow('Social cards must use an approved portrait derivative');
  });
});
