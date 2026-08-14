import { getContent, type Locale } from './content';
import { Contact } from './components/Contact';
import { Hero } from './components/Hero';
import { Navigation } from './components/Navigation';
import { SelectedWork } from './components/SelectedWork';
import { WorkPrinciples } from './components/WorkPrinciples';

export type { Locale } from './content';

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

        <section className="section-frame" aria-labelledby="personal-heading">
          <h2 className="section-heading" id="personal-heading">
            {content.personal.heading}
          </h2>
          <p className="personal-copy">{content.personal.body}</p>
          <ul className="personal-list">
            {content.personal.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <Contact content={content.contact} />
      </main>

      <footer className="site-footer">
        <div className="site-footer__frame">
          <a href={`/${locale}/`}>Rinat Gumarov</a>
          <span>Senior Frontend Engineer</span>
        </div>
      </footer>
    </>
  );
}
