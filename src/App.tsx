import { getContent, type Locale } from './content';
import { Contact } from './components/Contact';
import { Footer } from './components/Footer';
import { Hero } from './components/Hero';
import { Navigation } from './components/Navigation';
import { PersonalStrip, type PersonalPhotos } from './components/PersonalStrip';
import { SelectedWork } from './components/SelectedWork';
import { WorkPrinciples } from './components/WorkPrinciples';
import { useMotionEnhancementGate } from './lib/motion';

export type { Locale } from './content';

/**
 * Three frames share the strip, so each one is roughly a third of the visual
 * column. 480w covers phones and tablets; 768w covers wide desktops and 2x.
 */
const personalPhotoSizes = '(min-width: 60rem) 22rem, 30vw';

function buildPersonalPhotos(
  descriptions: ReturnType<typeof getContent>['personal']['photos'],
): PersonalPhotos {
  const frames = descriptions.map(({ slug, alt }) => ({
    src: `/assets/personal/${slug}-768.jpg`,
    srcSet: `/assets/personal/${slug}-480.jpg 480w, /assets/personal/${slug}-768.jpg 768w`,
    sources: {
      avif: `/assets/personal/${slug}-480.avif 480w, /assets/personal/${slug}-768.avif 768w`,
      webp: `/assets/personal/${slug}-480.webp 480w, /assets/personal/${slug}-768.webp 768w`,
    },
    sizes: personalPhotoSizes,
    width: 768,
    height: 576,
    alt,
  }));

  return [frames[0], frames[1], frames[2]] as unknown as PersonalPhotos;
}

export function App({ locale }: { locale: Locale }) {
  useMotionEnhancementGate();
  const content = getContent(locale);
  const personalPhotos = buildPersonalPhotos(content.personal.photos);

  return (
    <>
      <Navigation locale={locale} labels={content.nav} />
      <main id="main-content" data-locale={locale} tabIndex={-1}>
        <Hero content={content.hero} />

        <SelectedWork
          heading={content.projectsHeading}
          projects={content.projects}
          locale={locale}
        />

        <WorkPrinciples content={content.principles} />

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
