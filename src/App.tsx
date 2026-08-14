import { getContent, type Locale } from './content';
import { Contact } from './components/Contact';
import { Hero } from './components/Hero';
import { Navigation } from './components/Navigation';

export type { Locale } from './content';

export function App({ locale }: { locale: Locale }) {
  const content = getContent(locale);

  return (
    <>
      <Navigation locale={locale} labels={content.nav} />
      <main id="main-content" data-locale={locale} tabIndex={-1}>
        <Hero content={content.hero} />

        <section
          className="section-frame"
          id="work"
          aria-labelledby="projects-heading"
        >
          <h2 className="section-heading" id="projects-heading">
            {content.projectsHeading}
          </h2>
          <div className="project-list">
            {content.projects.map((project) => (
              <article className="project-card" key={project.slug}>
                <p>{project.eyebrow}</p>
                <h3>
                  <a href={project.href}>{project.name}</a>
                </h3>
                <p>{project.summary}</p>
                <p>{project.contribution}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          className="section-frame"
          id="about"
          aria-labelledby="principles-heading"
        >
          <h2 className="section-heading" id="principles-heading">
            {content.principles.heading}
          </h2>
          <ol className="principle-list">
            {content.principles.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </section>

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
