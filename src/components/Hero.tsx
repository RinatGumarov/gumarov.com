import { useState } from 'react';
import type { LandingContent } from '../content';
import { usePointerParallax } from '../lib/motion';
import styles from './Hero.module.css';

const portraitSources = {
  avif: '/assets/portrait/portrait-480.avif 480w, /assets/portrait/portrait-768.avif 768w, /assets/portrait/portrait-1024.avif 1024w',
  webp: '/assets/portrait/portrait-480.webp 480w, /assets/portrait/portrait-768.webp 768w, /assets/portrait/portrait-1024.webp 1024w',
  jpeg: '/assets/portrait/portrait-480.jpg 480w, /assets/portrait/portrait-768.jpg 768w, /assets/portrait/portrait-1024.jpg 1024w',
};
const portraitSizes =
  '(max-width: 46rem) min(100vw - 4rem, 28rem), (max-width: 64rem) 38vw, 30vw';

interface HeroProps {
  content: LandingContent['hero'];
}

export function Hero(_props: HeroProps) {
  const { content } = _props;
  const portraitMotion = usePointerParallax<HTMLPictureElement>();
  const [portraitFailed, setPortraitFailed] = useState(false);

  return (
    <section
      className={styles.hero}
      data-hero="landing"
      data-motion-hero="true"
      aria-labelledby="hero-heading"
    >
      <div className={styles.copy} data-motion-enter="copy">
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

      <figure
        className={styles.portrait}
        aria-hidden="true"
        data-motion-enter="portrait"
      >
        <picture
          ref={portraitMotion.ref}
          data-image-state={portraitFailed ? 'failed' : undefined}
          data-motion-parallax="true"
          data-motion-parallax-layer="true"
          onPointerMove={portraitMotion.onPointerMove}
          onPointerLeave={portraitMotion.onPointerLeave}
        >
          <source
            type="image/avif"
            srcSet={portraitSources.avif}
            sizes={portraitSizes}
          />
          <source
            type="image/webp"
            srcSet={portraitSources.webp}
            sizes={portraitSizes}
          />
          <img
            src="/assets/portrait/portrait-768.jpg"
            srcSet={portraitSources.jpeg}
            sizes={portraitSizes}
            alt=""
            width="768"
            height="960"
            loading="eager"
            fetchPriority="high"
            decoding="async"
            onError={() => setPortraitFailed(true)}
          />
        </picture>
        <figcaption>
          <span>RG</span>
          <span>01</span>
        </figcaption>
      </figure>
    </section>
  );
}
