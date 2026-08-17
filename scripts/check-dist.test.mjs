import { createHash, randomBytes } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import sharp from 'sharp';
import { renderPageMetadata, siteUrl } from './page-metadata.mjs';

const checkerPath = path.resolve(process.cwd(), 'scripts/check-dist.mjs');
const approvedPortraitSourceSha256 =
  '82a737263a795f74b39bca2b78710cfdca336d8408566f458c8bb4e8c35d9310';
const approvedPersonalSources = [
  {
    slug: 'surf',
    sha256: '52a7de95ba7da0e95f9ef9fd245e47723883ca912acbd678db16a740065023f4',
  },
  {
    slug: 'skate',
    sha256: '86ee2c416cea3a0cf1ab8560ba540e3c30592dae069aa0bbb6baa8dec0a3ad7f',
  },
  {
    slug: 'snowboard',
    sha256: '8fceebec257df1f33f90bbf553a269b40abc9e37bd190cd1c6826ed4543b0258',
  },
  {
    slug: 'drift-rear',
    sha256: '1c881495bd421e7ca056efb1fecf09cbc1e428bb779360f32e719ec051fa2224',
  },
  {
    slug: 'powder',
    sha256: 'd8f6176cbde98511e66ee297e79ac99b1e1c1b9334ef9cdbbbf94abca729468e',
  },
  {
    slug: 'drift-front',
    sha256: '371ce8799176881205728e5fbd6cafd4b8e8f9d3af30968c40815e1e73e1b575',
  },
];

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

/*
 * These suites encode AVIF/WebP/JPEG with Sharp and spawn the distribution
 * checker as a subprocess. Shared CI runners need far more than Vitest's
 * 5s default, so the whole suite gets an explicit ceiling.
 */
const slowSuiteTimeout = 60_000;

describe(
  'distribution checker',
  () => {
    it('requires every exact metadata-free portrait variant at its declared dimensions', async () => {
      const missingFixture = await createDistributionFixture();
      await rm(
        path.join(
          missingFixture.distDirectory,
          'assets/portrait/portrait-768.webp',
        ),
      );

      const missingResult = runChecker(missingFixture.distDirectory);

      expect(missingResult.stderr).toContain(
        'Required portrait asset is missing: assets/portrait/portrait-768.webp',
      );
      expect(missingResult.status).toBe(1);

      const dimensionsFixture = await createDistributionFixture();
      await sharp({
        create: {
          width: 20,
          height: 20,
          channels: 3,
          background: '#123456',
        },
      })
        .avif()
        .toFile(
          path.join(
            dimensionsFixture.distDirectory,
            'assets/portrait/portrait-1024.avif',
          ),
        );

      const dimensionsResult = runChecker(dimensionsFixture.distDirectory);

      expect(dimensionsResult.stderr).toContain(
        'Portrait asset assets/portrait/portrait-1024.avif is 20x20; expected 1024x1280.',
      );
      expect(dimensionsResult.status).toBe(1);

      const metadataFixture = await createDistributionFixture();
      await sharp({
        create: {
          width: 480,
          height: 600,
          channels: 3,
          background: '#123456',
        },
      })
        .jpeg()
        .withExif({ IFD0: { Make: 'Fixture Camera' } })
        .toFile(
          path.join(
            metadataFixture.distDirectory,
            'assets/portrait/portrait-480.jpg',
          ),
        );

      const metadataResult = runChecker(metadataFixture.distDirectory);

      expect(metadataResult.stderr).toContain(
        'Portrait asset assets/portrait/portrait-480.jpg contains EXIF metadata.',
      );
      expect(metadataResult.status).toBe(1);

      const iccFixture = await createDistributionFixture();
      await sharp({
        create: {
          width: 480,
          height: 600,
          channels: 3,
          background: '#123456',
        },
      })
        .jpeg()
        .withIccProfile('srgb')
        .toFile(
          path.join(
            iccFixture.distDirectory,
            'assets/portrait/portrait-480.jpg',
          ),
        );

      const iccResult = runChecker(iccFixture.distDirectory);

      expect(iccResult.stderr).toContain(
        'Portrait asset assets/portrait/portrait-480.jpg contains ICC metadata.',
      );
      expect(iccResult.status).toBe(1);

      const orientationFixture = await createDistributionFixture();
      await sharp({
        create: {
          width: 480,
          height: 600,
          channels: 3,
          background: '#123456',
        },
      })
        .jpeg()
        .withMetadata({ orientation: 6 })
        .toFile(
          path.join(
            orientationFixture.distDirectory,
            'assets/portrait/portrait-480.jpg',
          ),
        );

      const orientationResult = runChecker(orientationFixture.distDirectory);

      expect(orientationResult.stderr).toContain(
        'Portrait asset assets/portrait/portrait-480.jpg contains orientation metadata.',
      );
      expect(orientationResult.status).toBe(1);
    });

    it('requires every approved personal photo variant at its declared dimensions', async () => {
      const missingFixture = await createDistributionFixture();
      await rm(
        path.join(
          missingFixture.distDirectory,
          'assets/personal/surf-768.webp',
        ),
      );

      const missingResult = runChecker(missingFixture.distDirectory);

      expect(missingResult.stderr).toContain(
        'Required personal asset is missing: assets/personal/surf-768.webp',
      );
      expect(missingResult.status).toBe(1);

      const dimensionsFixture = await createDistributionFixture();
      await sharp({
        create: { width: 20, height: 20, channels: 3, background: '#123456' },
      })
        .avif()
        .toFile(
          path.join(
            dimensionsFixture.distDirectory,
            'assets/personal/skate-480.avif',
          ),
        );

      const dimensionsResult = runChecker(dimensionsFixture.distDirectory);

      expect(dimensionsResult.stderr).toContain(
        'Personal asset assets/personal/skate-480.avif is 20x20; expected 480x360.',
      );
      expect(dimensionsResult.status).toBe(1);

      const metadataFixture = await createDistributionFixture();
      await sharp({
        create: { width: 768, height: 576, channels: 3, background: '#123456' },
      })
        .withExif({ IFD0: { Make: 'Fixture Camera' } })
        .jpeg({ quality: 10 })
        .toFile(
          path.join(
            metadataFixture.distDirectory,
            'assets/personal/snowboard-768.jpg',
          ),
        );

      const metadataResult = runChecker(metadataFixture.distDirectory);

      expect(metadataResult.stderr).toContain(
        'Personal asset assets/personal/snowboard-768.jpg contains EXIF metadata.',
      );
      expect(metadataResult.status).toBe(1);
    });

    it('requires localized personal photo alt text as an image attribute', async () => {
      const fixture = await createDistributionFixture({
        omittedValuesByRoute: {
          'ru/index.html': new Set(['Ринат на волне.']),
        },
      });

      const result = runChecker(fixture.distDirectory);

      expect(result.stderr).toContain(
        'ru/index.html: missing image alt text personal.photos[0].alt "Ринат на волне."',
      );
      // Alt text must not be accepted merely because it appears as page text.
      expect(result.stderr).not.toContain(
        'missing visible content personal.photos[0].alt',
      );
      expect(result.status).toBe(1);
    });

    it('rejects a distribution built with the Playwright analytics token', async () => {
      // `pnpm test:e2e` rebuilds dist through Playwright's webServer, which
      // injects a placeholder key. If that build is what gets uploaded, real
      // visitors ship the test token and call PostHog for nothing.
      const fixture = await createDistributionFixture();
      await writeFile(
        path.join(fixture.distDirectory, 'assets', 'leaked.js'),
        'const k="phc_playwright_public_transport_token";export default k;',
      );

      const result = runChecker(fixture.distDirectory);

      expect(result.stderr).toContain(
        'assets/leaked.js: built with the Playwright placeholder analytics token',
      );
      expect(result.status).toBe(1);
    });

    it('charges a dynamically imported chunk to the deferred budget', async () => {
      // Random bytes so gzip cannot shrink the fixture below the budget it is
      // meant to exercise.
      const fixture = await createDistributionFixture();
      await writeFile(
        path.join(fixture.distDirectory, 'assets', 'deferred.js'),
        randomBytes(200 * 1024),
      );

      const result = runChecker(fixture.distDirectory);

      expect(result.stderr).not.toContain('Compressed JavaScript is');
      expect(result.stderr).not.toContain('Deferred JavaScript is');
      expect(result.status).toBe(0);
    });

    it('rejects a deferred chunk beyond the deferred budget', async () => {
      const fixture = await createDistributionFixture();
      await writeFile(
        path.join(fixture.distDirectory, 'assets', 'deferred.js'),
        randomBytes(320 * 1024),
      );

      const result = runChecker(fixture.distDirectory);

      expect(result.stderr).toContain('Deferred JavaScript is');
      expect(result.status).toBe(1);
    });

    it('charges a modulepreloaded chunk to the eager budget', async () => {
      const fixture = await createDistributionFixture({
        headByRoute: {
          'ru/index.html':
            '<link rel="modulepreload" href="/assets/eager.js" />',
        },
      });
      await writeFile(
        path.join(fixture.distDirectory, 'assets', 'eager.js'),
        randomBytes(160 * 1024),
      );

      const result = runChecker(fixture.distDirectory);

      expect(result.stderr).toContain('Compressed JavaScript is');
      expect(result.status).toBe(1);
    });

    it('rejects a personal photo whose source is not the approved one', async () => {
      const fixture = await createDistributionFixture();
      const manifestPath = path.join(
        fixture.distDirectory,
        'assets/personal/approved-manifest.json',
      );
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
      manifest.sources[1].sha256 = 'b'.repeat(64);
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

      const result = runChecker(fixture.distDirectory);

      expect(result.stderr).toContain(
        'assets/personal/approved-manifest.json: source SHA-256 for skate is not the pinned approved source.',
      );
      expect(result.status).toBe(1);
    });

    it('rejects unrelated metadata-free pixels that do not match the approved output manifest', async () => {
      const missingManifestFixture = await createDistributionFixture();
      await rm(
        path.join(
          missingManifestFixture.distDirectory,
          'assets/portrait/approved-manifest.json',
        ),
      );

      const missingManifestResult = runChecker(
        missingManifestFixture.distDirectory,
      );

      expect(missingManifestResult.stderr).toContain(
        'Approved portrait manifest is missing or invalid: assets/portrait/approved-manifest.json',
      );
      expect(missingManifestResult.status).toBe(1);

      const fixture = await createDistributionFixture();
      const assetPath = path.join(
        fixture.distDirectory,
        'assets/portrait/portrait-480.webp',
      );
      await sharp({
        create: {
          width: 480,
          height: 600,
          channels: 3,
          background: '#654321',
        },
      })
        .webp({ quality: 10 })
        .toFile(assetPath);

      const result = runChecker(fixture.distDirectory);

      expect(result.stderr).toContain(
        'Portrait asset assets/portrait/portrait-480.webp SHA-256 does not match the approved manifest.',
      );
      expect(result.status).toBe(1);
    });

    it('fails for omitted values across the built visible-content contract', async () => {
      const omittedRequirements = [
        { path: 'hero.body', value: 'Required contract-only sentence.' },
        { path: 'nav.about', value: 'About' },
        {
          path: 'projects[0].contribution',
          value: 'TradingView contribution',
        },
        { path: 'principles.items[0]', value: 'Working principle.' },
        { path: 'personal.body', value: 'Personal story.' },
        { path: 'contact.heading', value: 'Let’s talk' },
      ];
      const fixture = await createDistributionFixture({
        omittedValuesByRoute: {
          'en/index.html': new Set(
            omittedRequirements.map((requirement) => requirement.value),
          ),
        },
        extraEnglishHeroBody: 'Required contract-only sentence.',
      });

      const result = runChecker(fixture.distDirectory);

      for (const requirement of omittedRequirements) {
        expect(result.stderr).toContain(
          `en/index.html: missing visible content ${requirement.path} ${JSON.stringify(requirement.value)}`,
        );
      }
      expect(result.status).toBe(1);
    });

    it.each([
      {
        label: 'project',
        path: 'projects[0].href',
        destination: 'https://www.tradingview.com/',
      },
      {
        label: 'Telegram',
        path: 'contact.telegramHref',
        destination: 'https://t.me/RinatGumarov',
      },
      {
        label: 'email',
        path: 'contact.emailHref',
        destination: 'mailto:hi@gumarov.com',
      },
    ])(
      'requires the $label destination in an exact href attribute',
      async ({ path: contentPath, destination }) => {
        const fixture = await createDistributionFixture({
          transformHtmlByRoute: {
            'en/index.html': (html) =>
              replaceDestinationLinkWithUnrelatedText(html, destination),
          },
        });

        const result = runChecker(fixture.distDirectory);

        expect(result.stderr).toContain(
          `en/index.html: missing destination ${contentPath} href=${JSON.stringify(destination)}`,
        );
        expect(result.status).toBe(1);
      },
    );

    it('requires the visible email address in rendered text independently of mailto', async () => {
      const fixture = await createDistributionFixture({
        transformHtmlByRoute: {
          'en/index.html': (html) =>
            html
              .replace(
                '<a href="mailto:hi@gumarov.com">mailto:hi@gumarov.com</a>',
                '<a href="mailto:hi@gumarov.com">Email destination</a>',
              )
              .replace('<p>hi@gumarov.com</p>', ''),
        },
      });

      const result = runChecker(fixture.distDirectory);

      expect(result.stderr).toContain(
        'en/index.html: missing visible content contact.emailAddress "hi@gumarov.com"',
      );
      expect(result.status).toBe(1);
    });

    it('budgets actual image sources inside semantic hero markup regardless of path', async () => {
      const fixture = await createDistributionFixture({
        heroMarkup:
          '<picture><source srcset="/media/portrait-small.jpg 480w, /media/portrait-large.jpg 1024w" /><img src="/media/portrait-small.jpg" alt="" /></picture>',
      });
      const mediaDirectory = path.join(fixture.distDirectory, 'media');
      await mkdir(mediaDirectory, { recursive: true });
      await writeFile(
        path.join(mediaDirectory, 'portrait-large.jpg'),
        Buffer.alloc(301 * 1024),
      );
      await writeFile(
        path.join(mediaDirectory, 'portrait-small.jpg'),
        Buffer.alloc(10 * 1024),
      );

      const result = runChecker(fixture.distDirectory);

      expect(result.stderr).toContain(
        'Hero source media/portrait-large.jpg is 301.0 KiB; budget is 300.0 KiB.',
      );
      expect(result.status).toBe(1);
    });

    it('budgets responsive hero sources emitted by React SSR', async () => {
      const heroMarkup = renderToStaticMarkup(
        createElement(
          'picture',
          null,
          createElement('source', {
            srcSet:
              '/media/portrait-small.jpg 480w, /media/portrait-large.jpg 1024w',
          }),
          createElement('img', {
            src: '/media/portrait-small.jpg',
            alt: '',
          }),
        ),
      );
      expect(heroMarkup).toContain('srcSet=');

      const fixture = await createDistributionFixture({ heroMarkup });
      const mediaDirectory = path.join(fixture.distDirectory, 'media');
      await mkdir(mediaDirectory, { recursive: true });
      await writeFile(
        path.join(mediaDirectory, 'portrait-large.jpg'),
        Buffer.alloc(301 * 1024),
      );
      await writeFile(
        path.join(mediaDirectory, 'portrait-small.jpg'),
        Buffer.alloc(10 * 1024),
      );

      const result = runChecker(fixture.distDirectory);

      expect(result.stderr).toContain(
        'Hero source media/portrait-large.jpg is 301.0 KiB; budget is 300.0 KiB.',
      );
      expect(result.status).toBe(1);
    });

    it('accepts an embedded data-image hero fallback as an inline asset', async () => {
      const fallback =
        'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
      const fixture = await createDistributionFixture({
        heroMarkup: `<picture><source srcset="${fallback}" /><img src="${fallback}" alt="" /></picture>`,
      });

      const result = runChecker(fixture.distDirectory);

      expect(result.stderr).not.toContain('initial asset is missing');
      expect(result.stderr).not.toContain('Hero source is missing');
      expect(result.status).toBe(0);
    });

    it('still budgets local hero sources listed after an inline fallback', async () => {
      const fallback =
        'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
      const fixture = await createDistributionFixture({
        heroMarkup: `<picture><source srcset="${fallback} 1x, /media/portrait-large.jpg 2x" /><img src="${fallback}" alt="" /></picture>`,
      });
      const mediaDirectory = path.join(fixture.distDirectory, 'media');
      await mkdir(mediaDirectory, { recursive: true });
      await writeFile(
        path.join(mediaDirectory, 'portrait-large.jpg'),
        Buffer.alloc(301 * 1024),
      );

      const result = runChecker(fixture.distDirectory);

      expect(result.stderr).toContain(
        'Hero source media/portrait-large.jpg is 301.0 KiB; budget is 300.0 KiB.',
      );
      expect(result.status).toBe(1);
    });

    it.each([
      {
        label: 'og:image',
        removed:
          '<meta property="og:image" content="https://gumarov.com/og-en.jpg" />',
      },
      {
        label: 'og:locale',
        removed: '<meta property="og:locale" content="en_US" />',
      },
      {
        label: 'og:title',
        removed: '<meta property="og:title" content="Fixture page" />',
      },
      {
        label: 'og:description',
        removed:
          '<meta property="og:description" content="Fixture page description." />',
      },
      {
        label: 'twitter:card',
        removed: '<meta name="twitter:card" content="summary_large_image" />',
      },
      {
        label: 'favicon',
        removed: '<link rel="icon" href="/favicon.svg" type="image/svg+xml" />',
      },
      {
        label: 'web app manifest',
        removed: '<link rel="manifest" href="/site.webmanifest" />',
      },
      {
        label: 'canonical https://gumarov.com/en/',
        removed: '<link rel="canonical" href="https://gumarov.com/en/" />',
      },
      {
        label: 'reciprocal Russian alternate',
        removed:
          '<link rel="alternate" hreflang="ru" href="https://gumarov.com/ru/" />',
      },
    ])(
      'requires $label in every prerendered document',
      async ({ label, removed }) => {
        const fixture = await createDistributionFixture({
          transformHtmlByRoute: {
            'en/index.html': (html) => html.replace(removed, ''),
          },
        });

        const result = runChecker(fixture.distDirectory);

        expect(result.stderr).toContain(`en/index.html: missing ${label}`);
        expect(result.status).toBe(1);
      },
    );

    it('rejects social imagery that is missing, resized, or unapproved', async () => {
      const missingFixture = await createDistributionFixture();
      await rm(path.join(missingFixture.distDirectory, 'og-ru.jpg'));

      const missingResult = runChecker(missingFixture.distDirectory);

      expect(missingResult.stderr).toContain(
        'Required brand asset is missing: og-ru.jpg',
      );
      expect(missingResult.status).toBe(1);

      const resizedFixture = await createDistributionFixture();
      await sharp({
        create: { width: 600, height: 315, channels: 3, background: '#0d1117' },
      })
        .jpeg({ quality: 60 })
        .toFile(path.join(resizedFixture.distDirectory, 'og-en.jpg'));

      const resizedResult = runChecker(resizedFixture.distDirectory);

      expect(resizedResult.stderr).toContain(
        'Brand asset og-en.jpg is 600x315; expected 1200x630.',
      );
      expect(resizedResult.stderr).toContain(
        'Brand asset og-en.jpg SHA-256 does not match the approved manifest.',
      );
      expect(resizedResult.status).toBe(1);

      const monogramFixture = await createDistributionFixture();
      await writeFile(
        path.join(monogramFixture.distDirectory, 'favicon.svg'),
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><script>fetch("https://example.com")</script></svg>\n',
      );

      const monogramResult = runChecker(monogramFixture.distDirectory);

      expect(monogramResult.stderr).toContain(
        'Brand asset favicon.svg embeds scripts or external content.',
      );
      expect(monogramResult.stderr).toContain(
        'Brand asset favicon.svg SHA-256 does not match the approved manifest.',
      );
      expect(monogramResult.status).toBe(1);
    });

    it('rejects a web app manifest that drifts from the content or icons', async () => {
      const fixture = await createDistributionFixture();
      await writeFile(
        path.join(fixture.distDirectory, 'site.webmanifest'),
        `${JSON.stringify({
          name: 'Unrelated application',
          short_name: 'Fixture site',
          description: 'Fixture page description.',
          lang: 'en',
          dir: 'ltr',
          start_url: '/',
          scope: '/',
          display: 'minimal-ui',
          background_color: '#ffffff',
          theme_color: '#080b0f',
          icons: [
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          ],
        })}\n`,
      );

      const result = runChecker(fixture.distDirectory);

      expect(result.stderr).toContain(
        'site.webmanifest: member name is "Unrelated application".',
      );
      expect(result.stderr).toContain(
        'site.webmanifest: member background_color is "#ffffff".',
      );
      expect(result.stderr).toContain(
        'site.webmanifest: no 192x192 icon is declared.',
      );
      expect(result.status).toBe(1);
    });

    it('requires a GitHub Pages CNAME and .nojekyll file', async () => {
      const missingFixture = await createDistributionFixture();
      await rm(path.join(missingFixture.distDirectory, 'CNAME'), {
        force: true,
      });
      await rm(path.join(missingFixture.distDirectory, '.nojekyll'), {
        force: true,
      });
      const result = runChecker(missingFixture.distDirectory);

      expect(result.stderr).toContain('Required Pages file is missing: CNAME');
      expect(result.stderr).toContain(
        'Required Pages file is missing: .nojekyll',
      );
      expect(result.status).toBe(1);

      const wrongHost = await createDistributionFixture();
      await writeFile(
        path.join(wrongHost.distDirectory, 'CNAME'),
        'example.com\n',
      );
      await writeFile(path.join(wrongHost.distDirectory, '.nojekyll'), '');
      const wrongHostResult = runChecker(wrongHost.distDirectory);

      expect(wrongHostResult.stderr).toContain(
        'CNAME must contain only gumarov.com',
      );
      expect(wrongHostResult.status).toBe(1);
    });

    it('fails when headings or contact details need JavaScript to appear', async () => {
      const fixture = await createDistributionFixture({
        transformHtmlByRoute: {
          'ru/index.html': (html) =>
            html
              .replace(
                '<h3>TradingView</h3>',
                '<script>document.write("<h3>TradingView</h3>")</script>',
              )
              .replace(
                '<p>@RinatGumarov</p>',
                '<script>document.write("<p>@RinatGumarov</p>")</script>',
              ),
        },
      });

      const result = runChecker(fixture.distDirectory);

      expect(result.stderr).toContain(
        'ru/index.html: heading "TradingView" is missing without JavaScript',
      );
      expect(result.stderr).toContain(
        'ru/index.html: Telegram handle "@RinatGumarov" is missing without JavaScript',
      );
      expect(result.status).toBe(1);
    });

    it('rejects stylesheets that hide content before motion support is confirmed', async () => {
      const fixture = await createDistributionFixture();
      const assetsDirectory = path.join(fixture.distDirectory, 'assets');
      await mkdir(assetsDirectory, { recursive: true });
      await writeFile(
        path.join(assetsDirectory, 'ungated.css'),
        "[data-motion-reveal='copy']{opacity:0}\n[data-motion-state='enabled'] [data-motion-enter='copy']{animation:fade 1s both}\n",
      );

      const result = runChecker(fixture.distDirectory);

      expect(result.stderr).toContain(
        "assets/ungated.css: rule \"[data-motion-reveal='copy']\" changes the initial state without the [data-motion-state='enabled'] gate.",
      );
      expect(result.stderr).not.toContain(
        "[data-motion-enter='copy']\" changes",
      );
      expect(result.status).toBe(1);
    });

    it('rejects hero copy enter motion that hides the LCP heading', async () => {
      const fixture = await createDistributionFixture();
      const assetsDirectory = path.join(fixture.distDirectory, 'assets');
      await mkdir(assetsDirectory, { recursive: true });
      await writeFile(
        path.join(assetsDirectory, 'lcp.css'),
        "@keyframes motion-hero-copy-enter{from{opacity:0;transform:translate3d(0,1.25rem,0)}to{opacity:1;transform:none}}[data-motion-state='enabled'] [data-motion-enter='copy']{animation:motion-hero-copy-enter 640ms both}\n",
      );

      const result = runChecker(fixture.distDirectory);

      expect(result.stderr).toContain(
        'assets/lcp.css: hero copy animation "motion-hero-copy-enter" hides the LCP heading.',
      );
      expect(result.status).toBe(1);
    });

    it('rejects webfont face rules inlined into the document', async () => {
      const fixture = await createDistributionFixture({
        headByRoute: {
          'en/index.html':
            '<style>@font-face{font-family:Onest;src:url("/assets/fonts/Onest-Variable.woff2") format("woff2");font-display:optional}</style>',
        },
      });
      const fontsDirectory = path.join(
        fixture.distDirectory,
        'assets',
        'fonts',
      );
      await mkdir(fontsDirectory, { recursive: true });
      await writeFile(
        path.join(fontsDirectory, 'Onest-Variable.woff2'),
        'woff2-fixture',
      );

      const result = runChecker(fixture.distDirectory);

      expect(result.stderr).toContain(
        'en/index.html: inlined CSS must not declare @font-face',
      );
      expect(result.status).toBe(1);
    });

    it('rejects webfont face rules encoded as a data stylesheet', async () => {
      const encoded = Buffer.from(
        '@font-face{font-family:Onest;src:url("/assets/fonts/Onest-Variable.woff2") format("woff2");font-display:optional}',
      ).toString('base64');
      const fixture = await createDistributionFixture({
        headByRoute: {
          'en/index.html': `<link rel="stylesheet" href="data:text/css;base64,${encoded}" media="print" />`,
        },
      });

      const result = runChecker(fixture.distDirectory);

      expect(result.stderr).toContain(
        'en/index.html: inlined CSS must not declare @font-face',
      );
      expect(result.status).toBe(1);
    });

    it('rejects the Onest webfont on the critical CSS path', async () => {
      const fixture = await createDistributionFixture({
        headByRoute: {
          'en/index.html':
            '<style>:root{--font-sans:Onest,ui-sans-serif,sans-serif}</style>',
        },
      });

      const result = runChecker(fixture.distDirectory);

      expect(result.stderr).toContain(
        'en/index.html: inlined CSS must not reference Onest',
      );
      expect(result.status).toBe(1);
    });

    it('rejects a webfont preload in front of the LCP heading', async () => {
      const fixture = await createDistributionFixture({
        headByRoute: {
          'en/index.html':
            '<link rel="preload" href="/assets/fonts/Onest-Variable.woff2" as="font" type="font/woff2" crossorigin />',
        },
      });
      const fontsDirectory = path.join(
        fixture.distDirectory,
        'assets',
        'fonts',
      );
      await mkdir(fontsDirectory, { recursive: true });
      await writeFile(
        path.join(fontsDirectory, 'Onest-Variable.woff2'),
        'woff2-fixture',
      );

      const result = runChecker(fixture.distDirectory);

      expect(result.stderr).toContain(
        'en/index.html: do not preload webfonts in front of the LCP heading',
      );
      expect(result.status).toBe(1);
    });

    it('allows deferred Onest swap outside inlined critical CSS', async () => {
      const fixture = await createDistributionFixture();
      const fontsDirectory = path.join(
        fixture.distDirectory,
        'assets',
        'fonts',
      );
      await mkdir(fontsDirectory, { recursive: true });
      await writeFile(
        path.join(fontsDirectory, 'faces.css'),
        "@font-face{font-family:Onest;src:url('/assets/fonts/Onest-Variable.woff2') format('woff2');font-display:swap}\n@font-face{font-family:'Onest Fallback';src:local('Arial');size-adjust:107%}\n",
      );
      await writeFile(
        path.join(fontsDirectory, 'Onest-Variable.woff2'),
        'woff2-fixture',
      );

      const result = runChecker(fixture.distDirectory);

      expect(result.stderr).not.toContain('font-display');
      expect(result.status).toBe(0);
    });

    it('rejects a render-blocking external stylesheet', async () => {
      const fixture = await createDistributionFixture({
        headByRoute: {
          'en/index.html': '<link rel="stylesheet" href="/assets/app.css" />',
        },
      });
      const assetsDirectory = path.join(fixture.distDirectory, 'assets');
      await mkdir(assetsDirectory, { recursive: true });
      await writeFile(
        path.join(assetsDirectory, 'app.css'),
        'body{margin:0}\n',
      );

      const result = runChecker(fixture.distDirectory);

      expect(result.stderr).toContain(
        'en/index.html: render-blocking stylesheet /assets/app.css',
      );
      expect(result.status).toBe(1);
    });

    it('requires a skip link to the main landmark', async () => {
      const fixture = await createDistributionFixture({
        transformHtmlByRoute: {
          'en/index.html': (html) =>
            html.replace(/<a href="#main-content">[^<]*<\/a>/u, ''),
        },
      });

      const result = runChecker(fixture.distDirectory);

      expect(result.stderr).toContain(
        'en/index.html: missing skip link to #main-content',
      );
      expect(result.status).toBe(1);
    });

    it('requires banner, main, and contentinfo landmarks in document order', async () => {
      const fixture = await createDistributionFixture({
        transformHtmlByRoute: {
          'ru/index.html': (html) =>
            html
              .replace('<header>', '<div data-not-banner>')
              .replace('</header>', '</div>'),
        },
      });

      const result = runChecker(fixture.distDirectory);

      expect(result.stderr).toContain(
        'ru/index.html: missing banner landmark before main',
      );
      expect(result.status).toBe(1);
    });

    it('requires exactly one h1 in the prerendered document', async () => {
      const fixture = await createDistributionFixture({
        transformHtmlByRoute: {
          'en/index.html': (html) =>
            html.replace('<h1>', '<h2>').replace('</h1>', '</h2>'),
        },
      });

      const result = runChecker(fixture.distDirectory);

      expect(result.stderr).toContain('en/index.html: expected exactly one h1');
      expect(result.status).toBe(1);
    });

    it('enforces each route transfer budget through recursive CSS dependencies', async () => {
      const fixture = await createDistributionFixture({
        headByRoute: {
          'ru/index.html': '<link rel="stylesheet" href="/assets/ru.css" />',
        },
      });
      const assetsDirectory = path.join(fixture.distDirectory, 'assets');
      const mediaDirectory = path.join(fixture.distDirectory, 'media');
      await mkdir(assetsDirectory, { recursive: true });
      await mkdir(mediaDirectory, { recursive: true });
      await writeFile(
        path.join(assetsDirectory, 'ru.css'),
        '@import url("/assets/nested.css");',
      );
      await writeFile(
        path.join(assetsDirectory, 'nested.css'),
        '.hero { background-image: url("/media/large-background.bin"); }',
      );
      await writeFile(
        path.join(mediaDirectory, 'large-background.bin'),
        Buffer.alloc(701 * 1024),
      );

      const result = runChecker(fixture.distDirectory);

      expect(result.stderr).toContain('ru/index.html: initial transfer is');
      expect(result.status).toBe(1);
    });

    it('budgets assets referenced from inlined styles', async () => {
      const fixture = await createDistributionFixture({
        headByRoute: {
          'en/index.html':
            '<style>.hero { background-image: url("/media/large-background.bin"); }</style>',
        },
      });
      const mediaDirectory = path.join(fixture.distDirectory, 'media');
      await mkdir(mediaDirectory, { recursive: true });
      await writeFile(
        path.join(mediaDirectory, 'large-background.bin'),
        Buffer.alloc(701 * 1024),
      );

      const result = runChecker(fixture.distDirectory);

      expect(result.stderr).toContain('en/index.html: initial transfer is');
      expect(result.status).toBe(1);
    });
  },
  slowSuiteTimeout,
);

async function createDistributionFixture(options = {}) {
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'check-dist-'));
  temporaryDirectories.push(fixtureRoot);
  const distDirectory = path.join(fixtureRoot, 'dist');
  const serverDirectory = path.join(fixtureRoot, 'dist-ssr');
  await mkdir(path.join(distDirectory, 'en'), { recursive: true });
  await mkdir(path.join(distDirectory, 'ru'), { recursive: true });
  await mkdir(serverDirectory, { recursive: true });
  await writeFile(path.join(fixtureRoot, 'package.json'), '{"type":"module"}');
  await writeValidPortraitAssets(distDirectory);
  await writeValidPersonalAssets(distDirectory);
  await writeValidProjectAssets(distDirectory);

  const contentByLocale = {
    en: createContent(
      'en',
      options.extraEnglishHeroBody ?? 'English fixture body.',
    ),
    ru: createContent('ru', 'Русский текст для проверочного документа.'),
  };

  await writeValidBrandAssets(distDirectory, contentByLocale.en);

  await writeFile(
    path.join(serverDirectory, 'entry-server.js'),
    `const content = ${JSON.stringify(contentByLocale)};\nexport function getContent(locale) { return content[locale]; }\n`,
  );

  const routes = [
    { file: 'index.html', locale: 'en', pathname: '/', root: true },
    { file: 'en/index.html', locale: 'en', pathname: '/en/' },
    { file: 'ru/index.html', locale: 'ru', pathname: '/ru/' },
  ];

  for (const route of routes) {
    const outputPath = path.join(distDirectory, route.file);
    let html = renderFixtureDocument({
      ...route,
      content: contentByLocale[route.locale],
      head: options.headByRoute?.[route.file] ?? '',
      heroMarkup: options.heroMarkup ?? '',
      omittedValues: options.omittedValuesByRoute?.[route.file] ?? new Set(),
    });
    html = options.transformHtmlByRoute?.[route.file]?.(html) ?? html;
    await writeFile(outputPath, html);
  }

  return { distDirectory };
}

async function writeValidPortraitAssets(distDirectory) {
  const portraitDirectory = path.join(distDirectory, 'assets/portrait');
  await mkdir(portraitDirectory, { recursive: true });
  const outputs = [];

  for (const width of [480, 768, 1024]) {
    for (const format of ['avif', 'webp', 'jpeg']) {
      const extension = format === 'jpeg' ? 'jpg' : format;
      const file = `portrait-${width}.${extension}`;
      const outputPath = path.join(portraitDirectory, file);
      await sharp({
        create: {
          width,
          height: width * 1.25,
          channels: 3,
          background: '#123456',
        },
      })
        .toFormat(format, { quality: 10 })
        .toFile(outputPath);
      const contents = await readFile(outputPath);
      outputs.push({
        file: `assets/portrait/${file}`,
        format,
        width,
        height: width * 1.25,
        bytes: contents.byteLength,
        sha256: createHash('sha256').update(contents).digest('hex'),
      });
    }
  }

  await writeFile(
    path.join(portraitDirectory, 'approved-manifest.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        source: { sha256: approvedPortraitSourceSha256 },
        outputs,
      },
      null,
      2,
    )}\n`,
  );
}

const approvedProjectSources = [
  {
    slug: 'tradingview',
    sha256: '63f9d90139adf8b99fffb0bebe931648f6c89311d25e9eca3434568adb7fde99',
  },
  {
    slug: 'stoic',
    sha256: '4f29598e25d5aa6ddd65956de6a7721fd7c0f0c87cd0ce29525efe8828f6fa22',
  },
  {
    slug: 'splithub',
    sha256: '141a6b0b5a86296f4dfd1f49165eeb94c27b22af3e870c1623a8204d9c977d22',
  },
  {
    slug: 'evercity',
    sha256: 'dc6bd17beb17bb2791a076aeef8a110e3dee0e5f2b99441b2d5276cdb4f0a9be',
  },
];

async function writeValidProjectAssets(distDirectory) {
  const directory = path.join(distDirectory, 'assets/projects');
  await mkdir(directory, { recursive: true });
  const outputs = [];

  for (const { slug } of approvedProjectSources) {
    for (const width of [640, 960, 1440]) {
      for (const format of ['avif', 'webp', 'jpeg']) {
        const extension = format === 'jpeg' ? 'jpg' : format;
        const file = `${slug}-${width}.${extension}`;
        const outputPath = path.join(directory, file);
        await sharp({
          create: {
            width,
            height: Math.round(width / 2),
            channels: 3,
            background: '#123456',
          },
        })
          .toFormat(format, { quality: 10 })
          .toFile(outputPath);
        const contents = await readFile(outputPath);
        outputs.push({
          file: `assets/projects/${file}`,
          slug,
          format,
          width,
          height: Math.round(width / 2),
          bytes: contents.byteLength,
          sha256: createHash('sha256').update(contents).digest('hex'),
        });
      }
    }
  }

  await writeFile(
    path.join(directory, 'approved-manifest.json'),
    `${JSON.stringify(
      { schemaVersion: 1, sources: approvedProjectSources, outputs },
      null,
      2,
    )}\n`,
  );
}

async function writeValidPersonalAssets(distDirectory) {
  const personalDirectory = path.join(distDirectory, 'assets/personal');
  await mkdir(personalDirectory, { recursive: true });
  const outputs = [];

  for (const { slug } of approvedPersonalSources) {
    for (const width of [480, 768]) {
      for (const format of ['avif', 'webp', 'jpeg']) {
        const extension = format === 'jpeg' ? 'jpg' : format;
        const file = `${slug}-${width}.${extension}`;
        const outputPath = path.join(personalDirectory, file);
        await sharp({
          create: {
            width,
            height: Math.round((width * 3) / 4),
            channels: 3,
            background: '#123456',
          },
        })
          .toFormat(format, { quality: 10 })
          .toFile(outputPath);
        const contents = await readFile(outputPath);
        outputs.push({
          file: `assets/personal/${file}`,
          slug,
          format,
          width,
          height: Math.round((width * 3) / 4),
          bytes: contents.byteLength,
          sha256: createHash('sha256').update(contents).digest('hex'),
        });
      }
    }
  }

  await writeFile(
    path.join(personalDirectory, 'approved-manifest.json'),
    `${JSON.stringify(
      { schemaVersion: 1, sources: approvedPersonalSources, outputs },
      null,
      2,
    )}\n`,
  );
}

async function writeValidBrandAssets(distDirectory, englishContent) {
  const outputs = [];
  const record = async (file, contents) => {
    await writeFile(path.join(distDirectory, file), contents);
    outputs.push({
      file,
      bytes: contents.byteLength,
      sha256: createHash('sha256').update(contents).digest('hex'),
    });
  };

  await record(
    'favicon.svg',
    Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><rect width="64" height="64" rx="14" fill="#0d1117" /></svg>\n',
    ),
  );

  for (const size of [192, 512]) {
    await record(
      `icon-${size}.png`,
      await sharp({
        create: {
          width: size,
          height: size,
          channels: 3,
          background: '#0d1117',
        },
      })
        .png()
        .toBuffer(),
    );
  }

  for (const locale of ['en', 'ru']) {
    await record(
      `og-${locale}.jpg`,
      await sharp({
        create: {
          width: 1200,
          height: 630,
          channels: 3,
          background: '#0d1117',
        },
      })
        .jpeg({ quality: 60 })
        .toBuffer(),
    );
  }

  await mkdir(path.join(distDirectory, 'assets/brand'), { recursive: true });
  await writeFile(
    path.join(distDirectory, 'assets/brand/approved-manifest.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        source: { sha256: approvedPortraitSourceSha256 },
        outputs,
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    path.join(distDirectory, 'site.webmanifest'),
    `${JSON.stringify(
      {
        name: englishContent.meta.title,
        short_name: englishContent.meta.siteName,
        description: englishContent.meta.description,
        lang: 'en',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'minimal-ui',
        background_color: '#080b0f',
        theme_color: '#080b0f',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(path.join(distDirectory, 'CNAME'), 'gumarov.com\n');
  await writeFile(path.join(distDirectory, '.nojekyll'), '');
}

function createContent(locale, heroBody) {
  const isRussian = locale === 'ru';
  return {
    meta: {
      title: isRussian ? 'Проверочная страница' : 'Fixture page',
      description: isRussian
        ? 'Описание проверочной страницы.'
        : 'Fixture page description.',
      siteName: isRussian ? 'Проверочный сайт' : 'Fixture site',
      ogLocale: isRussian ? 'ru_RU' : 'en_US',
      ogAlternateLocale: isRussian ? 'en_US' : 'ru_RU',
      ogImage: isRussian ? '/og-ru.jpg' : '/og-en.jpg',
      ogImageAlt: isRussian
        ? 'Проверочная карточка для соцсетей.'
        : 'Fixture social card.',
      socialCard: {
        name: isRussian ? 'Ринат Гумаров' : 'Rinat Gumarov',
        role: 'Senior Frontend Engineer',
        headline: isRussian ? 'Проверочный заголовок.' : 'Fixture headline.',
        contact: 'gumarov.com · @RinatGumarov',
      },
    },
    nav: {
      work: isRussian ? 'Проекты' : 'Work',
      about: isRussian ? 'Обо мне' : 'About',
      contact: isRussian ? 'Контакты' : 'Contact',
    },
    hero: {
      eyebrow: 'React · TypeScript',
      title: isRussian
        ? 'Senior Frontend Engineer, который создаёт амбициозные продукты.'
        : 'Senior Frontend Engineer building ambitious products.',
      body: heroBody,
      workCta: isRussian ? 'Смотреть проекты' : 'View work',
      contactCta: isRussian ? 'Связаться' : 'Contact me',
    },
    projectsHeading: isRussian ? 'Избранные проекты' : 'Selected work',
    projects: [
      ['tradingview', 'TradingView', 'https://www.tradingview.com/'],
      ['stoic', 'Stoic', 'https://stoic.ai/'],
      ['splithub', 'SplitHub', 'https://splithub.app/'],
      ['evercity', 'Evercity', 'https://evercity.io/'],
    ].map(([slug, name, href]) => ({
      slug,
      name,
      eyebrow: `${name} eyebrow`,
      summary: `${name} summary`,
      contribution: `${name} contribution`,
      href,
    })),
    principles: {
      heading: isRussian ? 'Как я работаю' : 'How I work',
      items: [isRussian ? 'Принцип работы.' : 'Working principle.'],
    },
    personal: {
      heading: isRussian ? 'Вне экрана' : 'Beyond the screen',
      body: isRussian ? 'Личный текст.' : 'Personal story.',
      items: [isRussian ? 'Сёрфинг' : 'Surfing'],
      photos: [
        {
          slug: 'surf',
          alt: isRussian ? 'Ринат на волне.' : 'Rinat riding a wave.',
        },
      ],
    },
    contact: {
      heading: isRussian ? 'Давайте поговорим' : 'Let’s talk',
      body: isRussian ? 'Контактный текст.' : 'Contact body.',
      telegramLabel: 'Telegram',
      telegramHref: 'https://t.me/RinatGumarov',
      telegramHandle: '@RinatGumarov',
      emailLabel: 'Email',
      emailHref: 'mailto:hi@gumarov.com',
      emailAddress: 'hi@gumarov.com',
    },
  };
}

function renderFixtureDocument({
  file,
  locale,
  pathname,
  root,
  content,
  head,
  heroMarkup,
  omittedValues,
}) {
  const visibleValues = collectVisibleStrings(content).filter(
    (value) => !omittedValues.has(value),
  );
  const headingElements = collectHeadingElements(content);
  const renderedValues = visibleValues
    .map((value) => {
      if (/^(?:https?:|mailto:)/u.test(value)) {
        return `<a href="${escapeHtml(value)}">${escapeHtml(value)}</a>`;
      }

      const element = headingElements.get(value) ?? 'p';
      return `<${element}>${escapeHtml(value)}</${element}>`;
    })
    .join('');
  const personalFrames = content.personal.photos
    .filter((photo) => !omittedValues.has(photo.alt))
    .map(
      (photo) =>
        `<figure><img src="/assets/personal/${photo.slug}-768.jpg" width="768" height="576" alt="${escapeHtml(photo.alt)}" loading="lazy" /></figure>`,
    )
    .join('');
  const bootstrap = root
    ? `<script data-root-locale-bootstrap>(()=>{if(window.location.pathname!=='/')return;let locale=null;try{locale=window.localStorage.getItem('preferred-locale')}catch{}if(locale!=='en'&&locale!=='ru'){const languages=Array.isArray(window.navigator.languages)?window.navigator.languages:[window.navigator.language];locale=languages.some((language)=>typeof language==='string'&&language.toLowerCase().startsWith('ru'))?'ru':'en'}if(locale==='ru')window.location.replace(\`/ru/\${window.location.search}\${window.location.hash}\`)})();</script>`
    : '';

  const pageMetadata = renderPageMetadata({
    canonical: `${siteUrl}${pathname}`,
    content,
  }).join('');

  return `<!doctype html><html lang="${locale}"><head>${pageMetadata}${head}${bootstrap}</head><body><div id="root"><a href="#main-content">Skip to content</a><header></header><main id="main-content" data-fixture-route="${file}"><section data-hero>${heroMarkup}</section>${renderedValues}${personalFrames}</main><footer></footer></div></body></html>`;
}

function collectHeadingElements(content) {
  return new Map([
    [content.hero.title, 'h1'],
    [content.projectsHeading, 'h2'],
    [content.principles.heading, 'h2'],
    [content.personal.heading, 'h2'],
    [content.contact.heading, 'h2'],
    ...content.projects.map((project) => [project.name, 'h3']),
  ]);
}

function collectVisibleStrings(content) {
  const { meta: _meta, ...visibleContent } = content;
  const values = [];
  visit(visibleContent, null, values);
  return values;
}

function visit(value, key, values) {
  if (typeof value === 'string') {
    // `alt` is rendered as an image attribute, not as page text.
    if (key !== 'slug' && key !== 'alt' && value !== '') values.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) visit(item, null, values);
    return;
  }
  if (value && typeof value === 'object') {
    for (const [childKey, childValue] of Object.entries(value)) {
      visit(childValue, childKey, values);
    }
  }
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#x27;');
}

function replaceDestinationLinkWithUnrelatedText(html, destination) {
  const escapedDestination = escapeHtml(destination);
  return html.replace(
    `<a href="${escapedDestination}">${escapedDestination}</a>`,
    `<span data-destination="${escapedDestination}">${escapedDestination}</span>`,
  );
}

function runChecker(distDirectory) {
  return spawnSync(process.execPath, [checkerPath, distDirectory], {
    encoding: 'utf8',
  });
}
