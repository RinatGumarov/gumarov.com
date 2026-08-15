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
| `pnpm media:brand`    | Regenerate the monogram icons and localized social cards.     |
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
hashes. `public/assets/portrait/approved-manifest.json` records the pinned
source, lossless decode, transform parameters, and every approved output hash;
the distribution build rejects missing, changed, mis-sized, or metadata-bearing
portrait derivatives. Neither the HEIC nor the decoded PNG is committed. No
project screenshots are committed: the approved project scenes remain
CSS-native geometry because redistribution rights and provenance for
third-party screenshots have not been cleared.

### Personal photographs

Rinat selected six of his own activity photographs for the "Beyond the screen"
film strip and approved the crops below.

Each original is copied byte-for-byte into the ignored
`assets-source/personal/` directory before processing. Sharp auto-orients,
extracts the fixed rectangle recorded below, resizes with Lanczos3 to `4:3`,
converts to sRGB, applies the same brightness `0.92` / saturation `0.88` as the
portrait, and excludes all metadata. No attention detection, generated pixels,
or retouching is involved, so re-running the pipeline cannot re-frame a photo.

The two drift photographs came from event photographers and carried a credit
bar across the bottom of the frame (`LET'S DRIFT.ru`, credited to `AK.VET666`
and `TATA_PHOTOSPB`). Rinat confirmed he may publish them and asked for the bar
to be removed, so each crop height stops short of it: the bar begins at row
`1819` of `1887` in `drift-front` and row `1640` of `1706` in `drift-rear`.

| Slug          | Original                              |      Bytes | Source SHA-256                                                     | Extracted rectangle (`left`, `top`, `w`×`h`) |
| ------------- | ------------------------------------- | ---------: | ------------------------------------------------------------------ | -------------------------------------------- |
| `surf`        | `IMG_9902.JPG`                        | 14,033,254 | `52a7de95ba7da0e95f9ef9fd245e47723883ca912acbd678db16a740065023f4` | `1000`, `200`, `4000×3000` (of `6000×4000`)  |
| `skate`       | `IMG_9080.JPG`                        |  8,871,629 | `86ee2c416cea3a0cf1ab8560ba540e3c30592dae069aa0bbb6baa8dec0a3ad7f` | `0`, `390`, `3680×2760` (of `3680×5444`)     |
| `snowboard`   | `IMG_1374.JPG`                        |  2,097,553 | `8fceebec257df1f33f90bbf553a269b40abc9e37bd190cd1c6826ed4543b0258` | `480`, `0`, `2880×2160` (of `3840×2160`)     |
| `drift-rear`  | `IMG_9993.PNG`                        |  6,173,850 | `1c881495bd421e7ca056efb1fecf09cbc1e428bb779360f32e719ec051fa2224` | `200`, `0`, `2160×1620` (of `2560×1706`)     |
| `powder`      | `vlcsnap-2025-02-12-18h10m09s416.PNG` | 12,043,027 | `d8f6176cbde98511e66ee297e79ac99b1e1c1b9334ef9cdbbbf94abca729468e` | `480`, `0`, `2880×2160` (of `3840×2160`)     |
| `drift-front` | `IMG_0748.JPG`                        |    503,123 | `371ce8799176881205728e5fbd6cafd4b8e8f9d3af30968c40815e1e73e1b575` | `240`, `0`, `2400×1800` (of `2880×1887`)     |

| Output                 |  Bytes | SHA-256                                                            |
| ---------------------- | -----: | ------------------------------------------------------------------ |
| `surf-480.avif`        | 12,826 | `e4ae63d0fcc47245dcd3e3510f2bbe613f30b140d76ac5f656311dc8a4846a13` |
| `surf-480.webp`        | 17,490 | `6f8252c7277724fc99177e3dc4920448d40a21e2fce3e1103a047405df548498` |
| `surf-480.jpg`         | 23,233 | `e77fee4838d6c8daf51b75e22294047b1304b1f8c38cbb2e05e7574053e8ebfc` |
| `surf-768.avif`        | 28,129 | `73b5f97221299c87a80f743646ed01d9705ce9f33b71c272b69cb616bfa3fc22` |
| `surf-768.webp`        | 38,424 | `1c0de3faaeac94884de1be6fa9070350ac619bb482438eed10ff80c9cf611568` |
| `surf-768.jpg`         | 52,970 | `71e40eafb34583c31f57950f7c0e8d571e1318e364c894c7ffdd8c43b091ac41` |
| `skate-480.avif`       |  8,997 | `932fc64814ce7f6adee1c14d50846e2c72a82cf6045d69afacdff0e6f647c576` |
| `skate-480.webp`       | 12,202 | `32d44dc0695eeb90b6acd51b101cce9cd692bd53090eeda89f4d3d7ff5da7431` |
| `skate-480.jpg`        | 19,801 | `9a174fd4bff75f9cb5e1d80422671cc0222246226be033babfba125d8ce328ab` |
| `skate-768.avif`       | 15,997 | `623f675069c76374de5e7b0356933ead69263eb0f115ac99be22ced9af07ccca` |
| `skate-768.webp`       | 24,462 | `a73fc83c8427201a6f3aa9129bede9cc6da9db4cb28dc0b1adbfae3ad92e8c66` |
| `skate-768.jpg`        | 44,641 | `6e66191cf5b72631a426584b12bdde2db621f6156e16c513e3630760f5c20fe1` |
| `snowboard-480.avif`   | 22,411 | `32a8bb8e9fe59ef44f112bf2fb0c3476a4b92b6abd3d6d4dbee724c5c3a4ce0e` |
| `snowboard-480.webp`   | 27,318 | `fdf8b7e344312c18701dd0c583c02675e7899e785959ef4f6e19767caf6a3100` |
| `snowboard-480.jpg`    | 33,512 | `6aa372e27db47a8b2409b573af206c87e7a061c5016adf21a72253a7e8c77e3c` |
| `snowboard-768.avif`   | 50,281 | `27eb93d13975610b51db9bfa14257725caf7e0d23cd1f6cc7b50fba59101ff7b` |
| `snowboard-768.webp`   | 61,184 | `102eaa6e42639c54cee14e0d4462e778d58dbf813e2a2b2f74fe8bdbe93059ca` |
| `snowboard-768.jpg`    | 77,834 | `4aaadc58bf4a5ba0fd272e45c9481c08b045d321aa9c740f41f555e6de89cf9d` |
| `drift-rear-480.avif`  | 13,072 | `b2be62b80841155776d66778b65978b98b6264e96c010bbcfc2033222eb2a7e2` |
| `drift-rear-480.webp`  | 19,676 | `ca05b37df26dd602fe903e1c1688ab23c8f8bd392ceec7333b377922649ee537` |
| `drift-rear-480.jpg`   | 27,820 | `6176a2fdb21d9246ffbaaab060c79578b490746ebdd0399318c20160aa47be57` |
| `drift-rear-768.avif`  | 23,320 | `1988a5f0e021d2e73fd708e99356b1d6ea0da7b36659e0d5e88265e974f677d1` |
| `drift-rear-768.webp`  | 37,546 | `09e309c223dcbd1aa3b851b4ad360d9f560576864b1dcec112e8bceb9d4fa69c` |
| `drift-rear-768.jpg`   | 58,512 | `039ec18dbf24e195cdd433b0e939e04243204d32d1c7afae60cd9e48d1279936` |
| `powder-480.avif`      | 18,484 | `2e5712218dc37222f4ebe5692e19b94f921fa191ca461f7d904c5efb313e250c` |
| `powder-480.webp`      | 22,772 | `f5df5b071e39fa925b443702d1d3ff6f7986d95f2b5542b5089a8a8f0cb409a2` |
| `powder-480.jpg`       | 29,699 | `cbf138478eaf9b42bdd25adc113c316f2d4614f7cceb718720cee881d4da3087` |
| `powder-768.avif`      | 41,894 | `ebeda809ae2c0bb132cf5851563870619c3634814cb20e4c4cea6a7396128862` |
| `powder-768.webp`      | 50,446 | `169b32645a75816a1ff14956a3de8f0116997e708a8f0283b4ac35dc3b9e9dd2` |
| `powder-768.jpg`       | 69,680 | `a00d5e5817a69d95163c9f29157d9a190162e44c1d796c1cd06ada98184b9864` |
| `drift-front-480.avif` | 15,689 | `0def860d7707558a7e61fec34609c868826aa77c47a48be0e6ecc965530fcc05` |
| `drift-front-480.webp` | 22,740 | `d6c37000b2e204d570d1d876bb2933c3cb9fafac4ca2fa4497564ed3535ba8b2` |
| `drift-front-480.jpg`  | 30,805 | `876e1010879a8d13f4adbca82b34ade075f6ae1f325e941d58de84de82a912d3` |
| `drift-front-768.avif` | 30,483 | `388ba597070960ff2d4d29df9001ea88b9c9e827c846e75118e9146a77e8c9f8` |
| `drift-front-768.webp` | 45,914 | `d385e9584acad77b6b76ab80bf8dd0243d0555c6bca829ed78985c9c78dfef15` |
| `drift-front-768.jpg`  | 70,376 | `d81a3d4adb2b0382a1b4af7c0ef8bc68fde8ec399a853471d4e1ae9ff0763180` |

Regenerate with `node scripts/process-images.mjs --personal`. A second complete
run produced byte-identical outputs. `public/assets/personal/approved-manifest.json`
records the pinned source hashes, crops, and output hashes, and the
distribution build rejects missing, changed, mis-sized, or metadata-bearing
personal derivatives.

### Fonts

The complete upstream WOFF2 files remain un-subset because each covers Latin
and Cyrillic and the measured initial route transfer remains within `700 KiB`.
Self-hosted Onest and IBM Plex Mono load after first paint from
`/assets/fonts/faces.css` (idle, not a render-blocking preload) so Lantern LCP
can paint the hero heading with a system font. The heading stays on
`ui-sans-serif` / `system-ui`; body and mono type swap to the brand faces with
size-adjusted fallbacks.

| Font                         | Official upstream revision and source                                                                                                                                                                                                                                                                                       | Shipped file                                                      | SHA-256                                                            | License                                                                      |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Onest Variable 2.001         | [`simpals/onest` tag `2.001`, commit `8739b1910618a15335e4cc48842052d0ee739ade`](https://github.com/simpals/onest/releases/tag/2.001), archive [`onest-2.001.zip`](https://github.com/simpals/onest/releases/download/2.001/onest-2.001.zip)                                                                                | `public/assets/fonts/Onest-Variable.woff2` (`83,980` bytes)       | `cb4d777c1b146887a2902ef01ba91cb3fb0c85e9804e95794eb289a1966c0782` | Exact upstream `OFL.txt` as `Onest-OFL-1.1.txt` (SIL OFL 1.1)                |
| IBM Plex Mono Variable Roman | [`IBM/plex` commit `bf260093582f04622aacc1e9f9ca604d7ccd0c42`](https://github.com/IBM/plex/tree/bf260093582f04622aacc1e9f9ca604d7ccd0c42), [upstream WOFF2](https://github.com/IBM/plex/blob/bf260093582f04622aacc1e9f9ca604d7ccd0c42/packages/plex-mono-variable/fonts/complete/woff2/IBM%20Plex%20Mono%20Var-Roman.woff2) | `public/assets/fonts/IBMPlexMono-Variable.woff2` (`83,488` bytes) | `ef55d69e81baa6523a9b6e015d746e707bc7e9579f18703a169cb18c36dd567b` | Exact upstream root `LICENSE.txt` as `IBMPlexMono-OFL-1.1.txt` (SIL OFL 1.1) |

### Icons and social cards

`pnpm media:brand` regenerates every shareable brand asset from committed,
approved inputs. The monogram is a monoline `RG` drawn with SVG paths in the
existing token palette, so it needs no font at render time and stays legible as
a favicon; it is not a separate logo system. Sharp rasterizes the same artwork
into the two PWA icons. The social cards reuse the approved
`portrait-1024.jpg` derivative through a fixed centered cover crop, and the
card copy comes from `meta.socialCard` in the typed content model, typeset with
the self-hosted Onest and IBM Plex Mono files. No pixel is retouched,
generated, or sourced from stock imagery.

| Output         |  Bytes | SHA-256                                                            |
| -------------- | -----: | ------------------------------------------------------------------ |
| `favicon.svg`  |    552 | `b4a919ed20cff42a98711ef7855b737cbf229c8deccdad44da1cecfa6c2f945e` |
| `icon-192.png` |  3,695 | `4f9b6464fa55e7aaff43431b1b2c6d31ae45e288e37faf52472b4cca6fecb765` |
| `icon-512.png` |  9,604 | `2edf66405d4c0e3a60092790b61d85022a4c6e04a816ec01afaa95eac6ecd3da` |
| `og-en.jpg`    | 71,849 | `1d027a80b3d175494cb2d60bbea5dee74c9276078780f4452713ef64b5688337` |
| `og-ru.jpg`    | 73,625 | `336b3fe9ad91325f5f4e990ecc47ca3a0ce4675ce716818d1c44f19b64dc1bb1` |

`public/assets/brand/approved-manifest.json` records the pinned portrait
lineage and every output hash, and the distribution build rejects missing,
resized, or unapproved brand assets exactly as it does for the portrait.

### Metadata and static resilience

`scripts/page-metadata.mjs` builds one localized head block per prerendered
route from the typed content model: title, description, canonical URL,
reciprocal `en`/`ru` alternates with the English root as `x-default`, the
Open Graph and Twitter card set, the icon and manifest links, and `Person`
structured data. `https://gumarov.com/en/` and `https://gumarov.com/ru/` are
the locale canonicals and the root stays `x-default`.

The distribution check strips every `<script>` element from each built
document and requires that the headings, all four project names, the Telegram
handle, and the email address survive in the remaining markup. It also rejects
any stylesheet rule that hides motion-enhanced content without the
`[data-motion-state='enabled']` gate, so nothing is hidden before CSS
animation support is confirmed. Failed portrait or personal-strip images hide
only the image box and leave the framed container background and all
surrounding copy in place.

### Personal-photo publication gate

The three personal strip slots intentionally remain neutral placeholders. Site
publication is blocked until Rinat supplies and approves exactly 2–3 personal
photos, their crops, and localized English/Russian alt text. Candidate material
should come from Rinat’s own surf, snowboard, skate, motorcycle, drift, or BMW
E30 photos; stock, generated, or invented substitutes are not permitted. This
publication gate does not block local Tasks 8–13.

## Deployment

GitHub Actions workflows in `.github/workflows/` run the local quality gates
and can publish `dist/` through official Pages artifact actions. See
`docs/deployment.md` for the runbook and rollback. This repository still does
not create a remote, change DNS, enable analytics, or publish until Task 14
is explicitly approved.

`public/CNAME` contains only `gumarov.com`. `public/.nojekyll` is required so
Pages serves the Vite output unchanged. The deploy upload includes hidden
files so `.nojekyll` is part of the artifact.
