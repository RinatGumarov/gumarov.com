import type { LandingContent } from '../content';
import styles from './Hero.module.css';

const neutralPortraitFallback =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

interface HeroProps {
  content: LandingContent['hero'];
}

export function Hero(_props: HeroProps) {
  const { content } = _props;

  return (
    <section
      className={styles.hero}
      data-hero="landing"
      aria-labelledby="hero-heading"
    >
      <div className={styles.copy}>
        <p className={styles.eyebrow}>{content.eyebrow}</p>
        <h1 className={styles.title} id="hero-heading">
          {content.title}
        </h1>
        <p className={styles.body}>{content.body}</p>
        <div className={styles.actions}>
          <a className={styles.primaryAction} href="#work">
            {content.workCta}
            <span aria-hidden="true">↘</span>
          </a>
          <a className={styles.secondaryAction} href="#contact">
            {content.contactCta}
          </a>
        </div>
      </div>

      <figure className={styles.portrait} aria-hidden="true">
        <picture>
          <source media="(min-width: 64rem)" srcSet={neutralPortraitFallback} />
          <source media="(min-width: 40rem)" srcSet={neutralPortraitFallback} />
          <img src={neutralPortraitFallback} alt="" width="800" height="1000" />
        </picture>
        <figcaption>
          <span>RG</span>
          <span>01</span>
        </figcaption>
      </figure>
    </section>
  );
}
