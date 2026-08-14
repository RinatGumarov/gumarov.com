import { getContent, type Locale } from './content';

export type { Locale } from './content';

export function App({ locale }: { locale: Locale }) {
  const content = getContent(locale);

  return (
    <main data-locale={locale}>
      <header>
        <a href={`/${locale}/`} aria-label="Rinat Gumarov">
          Rinat Gumarov
        </a>
        <nav aria-label="Primary navigation">
          <a href="#work">{content.nav.work}</a>
          <a href="#about">{content.nav.about}</a>
          <a href="#contact">{content.nav.contact}</a>
        </nav>
      </header>

      <section aria-labelledby="hero-heading">
        <p>{content.hero.eyebrow}</p>
        <h1 id="hero-heading">{content.hero.title}</h1>
        <p>{content.hero.body}</p>
        <p>
          <a href="#work">{content.hero.workCta}</a>{' '}
          <a href="#contact">{content.hero.contactCta}</a>
        </p>
      </section>

      <section id="work" aria-labelledby="projects-heading">
        <h2 id="projects-heading">{content.projectsHeading}</h2>
        {content.projects.map((project) => (
          <article key={project.slug}>
            <p>{project.eyebrow}</p>
            <h3>
              <a href={project.href}>{project.name}</a>
            </h3>
            <p>{project.summary}</p>
            <p>{project.contribution}</p>
          </article>
        ))}
      </section>

      <section id="about" aria-labelledby="principles-heading">
        <h2 id="principles-heading">{content.principles.heading}</h2>
        <ul>
          {content.principles.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="personal-heading">
        <h2 id="personal-heading">{content.personal.heading}</h2>
        <p>{content.personal.body}</p>
        <ul>
          {content.personal.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section id="contact" aria-labelledby="contact-heading">
        <h2 id="contact-heading">{content.contact.heading}</h2>
        <p>{content.contact.body}</p>
        <address>
          <a href={content.contact.telegramHref}>
            {content.contact.telegramLabel}: {content.contact.telegramHandle}
          </a>{' '}
          <a href={content.contact.emailHref}>
            {content.contact.emailLabel}: {content.contact.emailAddress}
          </a>
        </address>
      </section>
    </main>
  );
}
