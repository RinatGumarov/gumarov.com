import { useState } from 'react';
import type { LandingContent } from '../content';
import { usePointerParallax } from '../lib/motion';
import styles from './Hero.module.css';

const portraitSources = {
  avif: '/assets/portrait/portrait-480.avif 480w, /assets/portrait/portrait-768.avif 768w, /assets/portrait/portrait-1024.avif 1024w',
  webp: '/assets/portrait/portrait-480.webp 480w, /assets/portrait/portrait-768.webp 768w, /assets/portrait/portrait-1024.webp 1024w',
  jpeg: '/assets/portrait/portrait-480.jpg 480w, /assets/portrait/portrait-768.jpg 768w, /assets/portrait/portrait-1024.jpg 1024w',
};
// The portrait is a fixed 56x70 decorative avatar beside the name at every
// breakpoint (plan §3.2), not a viewport-scaled hero visual, so it always
// requests the smallest generated candidate.
const portraitSizes = '56px';

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
      <div className={styles.identityRow} data-motion-enter="portrait">
        <div className={styles.portrait} aria-hidden="true">
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
        </div>
        <div className={styles.identityText}>
          <p className={styles.identity}>{content.identity}</p>
          <p className={styles.eyebrow}>{content.eyebrow}</p>
        </div>
      </div>

      <div className={styles.copy} data-motion-enter="copy">
        <h1 className={styles.title} id="hero-heading">
          <span className={styles.titleLine}>{content.titleLines[0]}</span>{' '}
          <span className={`${styles.titleLine} ${styles.titleLineAccent}`}>
            {content.titleLines[1]}
          </span>
        </h1>
        <p className={styles.body}>{content.body}</p>
        <div className={styles.actions}>
          <a className={styles.primaryAction} href="#work">
            {content.workCta}
            <span aria-hidden="true">↘</span>
          </a>
          <a className={styles.secondaryAction} href="#contact">
            {content.contactCta}
            <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
    </section>
  );
}
