import { useRef, useState } from 'react';
import type { LandingContent } from '../content';
import { useHeroLens } from '../lib/useHeroLens';
import { HeroBlueprint } from './HeroBlueprint';
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
  /**
   * The boolean from the application's single `useMotionEnhancementGate()`.
   * The hero never runs a gate of its own — there is exactly one
   * root-mutating gate on the page, and it lives in `App`.
   */
  motionEnabled: boolean;
}

export function Hero({ content, motionEnabled }: HeroProps) {
  const [portraitFailed, setPortraitFailed] = useState(false);
  const heroRef = useRef<HTMLElement>(null);

  useHeroLens(heroRef, motionEnabled);

  return (
    <section
      ref={heroRef}
      className={styles.hero}
      data-hero="landing"
      data-motion-hero="true"
      aria-labelledby="hero-heading"
    >
      {/*
       * The engineering drawing (plan §5). Purely decorative: hidden from
       * assistive technology, transparent to pointer events, and painted
       * below the copy, so the heading, the body and both calls to action
       * stay exactly where they are and stay clickable.
       */}
      <div
        className={styles.decor}
        aria-hidden="true"
        data-motion-enter="decor"
      >
        <HeroBlueprint className={styles.decorBase} layer="base" />
        <HeroBlueprint className={styles.decorLens} layer="lens" />
        <div className={styles.decorScrim} />
      </div>

      <div className={styles.identityRow} data-motion-enter="portrait">
        {/*
         * No pointer parallax here. The lens is the hero's only
         * pointer-driven motion (plan §5: «Дополнительный parallax hero:
         * отсутствует: не суммировать с линзой»), so one mouse move drives one
         * effect — and nothing in the hero reads layout on every pointer move.
         */}
        <div className={styles.portrait} aria-hidden="true">
          <picture data-image-state={portraitFailed ? 'failed' : undefined}>
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
