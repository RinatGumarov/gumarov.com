import { getContent, type Locale } from './content';
import { Contact } from './components/Contact';
import { Footer } from './components/Footer';
import { Hero } from './components/Hero';
import { Navigation } from './components/Navigation';
import { PersonalStrip, type PersonalPhotos } from './components/PersonalStrip';
import { SelectedWork } from './components/SelectedWork';
import { WorkPrinciples } from './components/WorkPrinciples';

export type { Locale } from './content';

const neutralPersonalFallback =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

const personalPhotoPlaceholders: PersonalPhotos = [
  { src: neutralPersonalFallback, width: 800, height: 600, alt: '' },
  { src: neutralPersonalFallback, width: 800, height: 600, alt: '' },
  { src: neutralPersonalFallback, width: 800, height: 600, alt: '' },
];

export function App({ locale }: { locale: Locale }) {
  const content = getContent(locale);

  return (
    <>
      <Navigation locale={locale} labels={content.nav} />
      <main id="main-content" data-locale={locale} tabIndex={-1}>
        <Hero content={content.hero} />

        <SelectedWork
          heading={content.projectsHeading}
          projects={content.projects}
        />

        <WorkPrinciples content={content.principles} />

        <PersonalStrip
          content={content.personal}
          photos={personalPhotoPlaceholders}
        />

        <Contact content={content.contact} />
      </main>

      <Footer
        locale={locale}
        contact={content.contact}
        privacy={content.footer.privacy}
      />
    </>
  );
}
