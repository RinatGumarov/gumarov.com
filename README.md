# Gumarov Personal Landing

The source for `gumarov.com`, a bilingual personal landing for Rinat Gumarov,
Senior Frontend Engineer. The first release presents selected frontend and
product work for founders, hiring teams, and professional collaborators.

## Local development

Use Node.js 22 and pnpm 10:

```bash
pnpm install --frozen-lockfile
pnpm dev
```

## Quality commands

| Command               | Purpose                                                       |
| --------------------- | ------------------------------------------------------------- |
| `pnpm test`           | Run unit and component tests.                                 |
| `pnpm test:watch`     | Run Vitest in watch mode.                                     |
| `pnpm test:e2e`       | Run Playwright end-to-end tests.                              |
| `pnpm test:a11y`      | Run the focused Playwright accessibility suite.               |
| `pnpm media:portrait` | Regenerate approved responsive portrait derivatives.          |
| `pnpm typecheck`      | Type-check the TypeScript project.                            |
| `pnpm lint`           | Run ESLint with warnings treated as failures.                 |
| `pnpm format:check`   | Check formatting with Prettier.                               |
| `pnpm build`          | Build the client with Vite during the bootstrap phase.        |
| `pnpm verify`         | Run formatting, linting, type-checking, tests, and the build. |
| `pnpm preview`        | Preview the production build locally.                         |

`build:client`, `build:ssr`, and `prerender` define the future static-rendering
contract. The bootstrap `build` command intentionally remains `vite build`
until the SSR and prerender pipeline is introduced.

## Privacy

The landing is designed to remain useful without analytics, storage, motion,
or optional client-side integrations. Analytics is not configured in this
repository baseline. If introduced later, it must be allowlisted, cookieless,
and documented before use.

## Asset provenance

Only approved, licensable assets belong in the public repository. Original
portrait and activity photographs stay in the ignored `assets-source/`
directory; published derivatives must have metadata removed. Do not add stock
stand-ins for personal photographs, confidential product material, or
unverified claims. Font files and their licenses must ship together.

### Production portrait

- Approved source: Rinat-provided `IMG_7655.heic`, copied byte-for-byte to the
  ignored `assets-source/portrait.heic` before processing.
- Source SHA-256: `82a737263a795f74b39bca2b78710cfdca336d8408566f458c8bb4e8c35d9310`
  (`1,109,592` bytes; primary image `2316×3088`).
- Lossless decode: the installed official libheif `heif-dec` binary, exposed as
  `heif-convert`, runs with `--disable-limits` and writes the ignored
  `assets-source/portrait-decoded.png`. The PNG is `2316×3088`, `5,956,158`
  bytes, and has SHA-256
  `5c3ac0971451e64b058b9090a5050ad06c5a6c518feae66fe02aeba73e0befd6`.
- Sharp processing: fixed centered `4:5` cover crop, Lanczos3 resize, sRGB,
  brightness `0.92`, and saturation `0.88`. The script does not use attention
  detection, generated pixels, retouching, tinting, or retained metadata.

| Output               |   Bytes | SHA-256                                                            |
| -------------------- | ------: | ------------------------------------------------------------------ |
| `portrait-480.avif`  |  17,165 | `b04d949e2496a40d9e85a08502a14e903c1d8963b48cc3c3a231b817957d73fb` |
| `portrait-480.webp`  |  25,314 | `fc2302b679f55b3b655e8a188c2180b663a3d270bea920c4f47d3e77fb84fb7b` |
| `portrait-480.jpg`   |  38,372 | `6bb5c78a0a3f912b132c6330163b90fa6f6ffa63f654836b56c3f9884f2885b4` |
| `portrait-768.avif`  |  39,194 | `8368a77e5a0f9239a5059c56b9860c1197f5549a59d30bcd987094657709342c` |
| `portrait-768.webp`  |  59,064 | `6f4d3370903a8af7fdfedab8876369713b768c6f17052674aa35dbeb8551b5e7` |
| `portrait-768.jpg`   |  89,083 | `ff41db2cd26bd54981baca46858be10baceb83239c9443143701e6e3272c4057` |
| `portrait-1024.avif` |  65,777 | `ecfe605c830aa150c97c80a012c9370fc0dfcbc434776b6c7de5c7abea49eebe` |
| `portrait-1024.webp` | 100,276 | `7ed1c477a15d05bb448588364e62840a6c5f1f201a919156ab8095d29338d6b9` |
| `portrait-1024.jpg`  | 151,291 | `499ac60a65648cd5af5d0d990203ca2bd96a1b4304a021bc65cddd01e123af67` |

The two complete processing runs produced identical intermediate and output
hashes. Neither the HEIC nor the decoded PNG is committed. No project
screenshots are committed: the approved project scenes remain CSS-native
geometry because redistribution rights and provenance for third-party
screenshots have not been cleared.

### Fonts

The complete upstream WOFF2 files remain un-subset because each covers Latin
and Cyrillic and the measured initial route transfer remains within `700 KiB`.
Only the above-the-fold Onest file is preloaded.

| Font                         | Official upstream revision and source                                                                                                                                                                                                                                                                                       | Shipped file                                                      | SHA-256                                                            | License                                                                      |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Onest Variable 2.001         | [`simpals/onest` tag `2.001`, commit `8739b1910618a15335e4cc48842052d0ee739ade`](https://github.com/simpals/onest/releases/tag/2.001), archive [`onest-2.001.zip`](https://github.com/simpals/onest/releases/download/2.001/onest-2.001.zip)                                                                                | `public/assets/fonts/Onest-Variable.woff2` (`83,980` bytes)       | `cb4d777c1b146887a2902ef01ba91cb3fb0c85e9804e95794eb289a1966c0782` | Exact upstream `OFL.txt` as `Onest-OFL-1.1.txt` (SIL OFL 1.1)                |
| IBM Plex Mono Variable Roman | [`IBM/plex` commit `bf260093582f04622aacc1e9f9ca604d7ccd0c42`](https://github.com/IBM/plex/tree/bf260093582f04622aacc1e9f9ca604d7ccd0c42), [upstream WOFF2](https://github.com/IBM/plex/blob/bf260093582f04622aacc1e9f9ca604d7ccd0c42/packages/plex-mono-variable/fonts/complete/woff2/IBM%20Plex%20Mono%20Var-Roman.woff2) | `public/assets/fonts/IBMPlexMono-Variable.woff2` (`83,488` bytes) | `ef55d69e81baa6523a9b6e015d746e707bc7e9579f18703a169cb18c36dd567b` | Exact upstream root `LICENSE.txt` as `IBMPlexMono-OFL-1.1.txt` (SIL OFL 1.1) |

### Personal-photo publication gate

The three personal strip slots intentionally remain neutral placeholders. Site
publication is blocked until Rinat supplies and approves exactly 2–3 personal
photos, their crops, and localized English/Russian alt text. Candidate material
should come from Rinat’s own surf, snowboard, skate, motorcycle, drift, or BMW
E30 photos; stock, generated, or invented substitutes are not permitted. This
publication gate does not block local Tasks 8–13.

## Deployment

Deployment is intentionally not configured yet. This repository does not
create a remote, publish a site, configure DNS, enable analytics, or change
external accounts.
