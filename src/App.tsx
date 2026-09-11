import { getContent, type Locale } from './content';
import { Contact } from './components/Contact';
import { EngineeringDetails } from './components/EngineeringDetails';
import { Footer } from './components/Footer';
import { Hero } from './components/Hero';
import { Navigation } from './components/Navigation';
import {
  PersonalStrip,
  type PersonalPhoto,
  type PersonalPhotos,
} from './components/PersonalStrip';
import { ProofRow } from './components/ProofRow';
import { SelectedWork } from './components/SelectedWork';
import { useMotionEnhancementGate } from './lib/motion';
import { useSectionHash } from './lib/useSectionHash';

export type { Locale } from './content';

// The anchors the navigation and footer link to.
const sectionIds = ['work', 'about', 'contact'] as const;

/**
 * The personal section is no longer three equal frames (plan §4): the surf
 * lead frame, the portrait, and the five activity photos each need their own
 * `sizes` because they're displayed at different widths.
 */
const leadPhotoSizes =
  '(min-width: 75em) 1184px, (min-width: 48em) calc(100vw - 64px), calc(100vw - 40px)';
const portraitPhotoSizes = '(min-width: 54rem) 280px, 240px';
// The first activity row (drift-front, skate) spans 7+5 of 12 columns on
// desktop, wide enough that drift-front crosses the 600 CSS px mark (plan §7).
const largeActivityPhotoSizes =
  '(min-width: 75em) 740px, (min-width: 54rem) 58vw, calc(50vw - 32px)';
// The second row (snowboard, powder, drift-rear) is 4 of 12 columns on
// desktop and shares the two-column mobile grid, except drift-rear which is
// the last photo and spans the full row on mobile.
const smallActivityPhotoSizes =
  '(min-width: 75em) 320px, (min-width: 54rem) 30vw, calc(50vw - 32px)';
const driftRearPhotoSizes =
  '(min-width: 75em) 320px, (min-width: 54rem) 30vw, calc(100vw - 40px)';

function assetSrcSet(
  directory: string,
  slug: string,
  widths: readonly number[],
  extension: string,
) {
  return widths
    .map(
      (width) => `/assets/${directory}/${slug}-${width}.${extension} ${width}w`,
    )
    .join(', ');
}

function buildPersonalPhoto({
  slug,
  alt,
  widths,
  sizes,
  fallbackWidth = 768,
  aspect,
}: {
  slug: string;
  alt: string;
  widths: readonly number[];
  sizes: string;
  fallbackWidth?: number;
  aspect: 'photo' | 'portrait';
}): PersonalPhoto {
  const directory = aspect === 'portrait' ? 'portrait' : 'personal';
  const height =
    aspect === 'portrait'
      ? Math.round(fallbackWidth * 1.25)
      : Math.round((fallbackWidth * 3) / 4);

  return {
    src: `/assets/${directory}/${slug}-${fallbackWidth}.jpg`,
    srcSet: assetSrcSet(directory, slug, widths, 'jpg'),
    sources: {
      avif: assetSrcSet(directory, slug, widths, 'avif'),
      webp: assetSrcSet(directory, slug, widths, 'webp'),
    },
    sizes,
    width: fallbackWidth,
    height,
    alt,
  };
}

interface PersonalMedia {
  lead: PersonalPhoto;
  portrait: PersonalPhoto;
  activity: PersonalPhotos;
}

function buildPersonalMedia(
  content: ReturnType<typeof getContent>,
): PersonalMedia {
  const altBySlug = new Map<string, string>(
    content.personal.photos.map(({ slug, alt }) => [slug, alt]),
  );
  const altFor = (slug: string) => altBySlug.get(slug) ?? '';

  const lead = buildPersonalPhoto({
    slug: 'surf',
    alt: altFor('surf'),
    widths: [480, 768, 960, 1440, 1920],
    sizes: leadPhotoSizes,
    aspect: 'photo',
  });

  const portrait = buildPersonalPhoto({
    slug: 'portrait',
    alt: content.hero.identity,
    widths: [480, 768, 1024],
    sizes: portraitPhotoSizes,
    aspect: 'portrait',
  });

  // Plan §3.7 order: drift-front, skate, snowboard, powder, drift-rear. The
  // same order is used in this data and in the DOM.
  const activity: PersonalPhotos = [
    buildPersonalPhoto({
      slug: 'drift-front',
      alt: altFor('drift-front'),
      widths: [480, 768, 1200],
      sizes: largeActivityPhotoSizes,
      aspect: 'photo',
    }),
    buildPersonalPhoto({
      slug: 'skate',
      alt: altFor('skate'),
      widths: [480, 768],
      sizes: largeActivityPhotoSizes,
      aspect: 'photo',
    }),
    buildPersonalPhoto({
      slug: 'snowboard',
      alt: altFor('snowboard'),
      widths: [480, 768],
      sizes: smallActivityPhotoSizes,
      aspect: 'photo',
    }),
    buildPersonalPhoto({
      slug: 'powder',
      alt: altFor('powder'),
      widths: [480, 768],
      sizes: smallActivityPhotoSizes,
      aspect: 'photo',
    }),
    buildPersonalPhoto({
      slug: 'drift-rear',
      alt: altFor('drift-rear'),
      widths: [480, 768],
      sizes: driftRearPhotoSizes,
      aspect: 'photo',
    }),
  ];

  return { lead, portrait, activity };
}

export function App({ locale }: { locale: Locale }) {
  // The page's single motion gate. Its answer is passed down rather than
  // re-derived, so no component installs a second root-mutating gate.
  const motionEnabled = useMotionEnhancementGate();
  useSectionHash(sectionIds);
  const content = getContent(locale);
  const personalMedia = buildPersonalMedia(content);

  return (
    <>
      <Navigation locale={locale} labels={content.nav} />
      <main id="main-content" data-locale={locale} tabIndex={-1}>
        <Hero content={content.hero} motionEnabled={motionEnabled} />

        <ProofRow points={content.hero.proofPoints} />

        <SelectedWork
          heading={content.projectsHeading}
          projects={content.projects}
          screenshots={content.projectScreenshots}
          locale={locale}
        />

        <EngineeringDetails content={content.engineering} />

        <PersonalStrip
          content={content.personal}
          lead={personalMedia.lead}
          portrait={personalMedia.portrait}
          activity={personalMedia.activity}
        />

        <Contact content={content.contact} locale={locale} />
      </main>

      <Footer
        locale={locale}
        contact={content.contact}
        privacy={content.footer.privacy}
      />
    </>
  );
}
