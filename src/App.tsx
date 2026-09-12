import { getContent, type Locale } from './content';
import { Contact } from './components/Contact';
import { Footer } from './components/Footer';
import { Hero } from './components/Hero';
import { Navigation } from './components/Navigation';
import { PerformanceLab } from './components/PerformanceLab';
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
 * The About strip is three frames in one row on desktop and a 1 + 2 stack on
 * mobile, so a frame is at most half the strip's column and the strip is a bit
 * over half the section. The widths below follow that, and stop at the widest
 * any single frame is ever displayed — no frame pulls a desktop-sized raster to
 * fill a third of a phone screen.
 */
const stripPhotoSizes =
  '(min-width: 75em) 250px, (min-width: 54rem) 22vw, calc(50vw - 26px)';
// The lead frame is the only one that spans the full width on mobile.
const leadStripPhotoSizes =
  '(min-width: 75em) 250px, (min-width: 54rem) 22vw, calc(100vw - 40px)';

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
}: {
  slug: string;
  alt: string;
  widths: readonly number[];
  sizes: string;
  fallbackWidth?: number;
}): PersonalPhoto {
  return {
    src: `/assets/personal/${slug}-${fallbackWidth}.jpg`,
    srcSet: assetSrcSet('personal', slug, widths, 'jpg'),
    sources: {
      avif: assetSrcSet('personal', slug, widths, 'avif'),
      webp: assetSrcSet('personal', slug, widths, 'webp'),
    },
    sizes,
    width: fallbackWidth,
    height: Math.round((fallbackWidth * 3) / 4),
    alt,
  };
}

/**
 * The three About frames, in render order: surf, snowboard, drift-front.
 *
 * The surf and drift-front sources carry wider derivatives than the shared
 * 480/768 pair, left over from the full-bleed composition this section
 * replaced. They are deliberately not offered here: at these display sizes the
 * browser would never pick them, and listing a 1920w candidate a layout can
 * never use is how a strip of thumbnails ends up downloading a wallpaper.
 */
function buildPersonalMedia(
  content: ReturnType<typeof getContent>,
): PersonalPhotos {
  const [lead, middle, last] = content.personal.photos;

  return [
    buildPersonalPhoto({
      slug: lead.slug,
      alt: lead.alt,
      widths: [480, 768],
      sizes: leadStripPhotoSizes,
    }),
    buildPersonalPhoto({
      slug: middle.slug,
      alt: middle.alt,
      widths: [480, 768],
      sizes: stripPhotoSizes,
    }),
    buildPersonalPhoto({
      slug: last.slug,
      alt: last.alt,
      widths: [480, 768],
      sizes: stripPhotoSizes,
    }),
  ];
}

export function App({ locale }: { locale: Locale }) {
  // The page's single motion gate. Its answer is passed down rather than
  // re-derived, so no component installs a second root-mutating gate.
  const motionEnabled = useMotionEnhancementGate();
  useSectionHash(sectionIds);
  const content = getContent(locale);
  const personalPhotos = buildPersonalMedia(content);

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

        <PerformanceLab content={content.performanceLab} />

        <PersonalStrip content={content.personal} photos={personalPhotos} />

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
