import { useEffect, useRef, useState } from 'react';
import type { LandingContent } from '../content';
import { useHeroVisual } from '../lib/hero-visual';
import { HeroRibbon } from './HeroRibbon';
import styles from './Hero.module.css';

const portraitSources = {
  avif: '/assets/portrait/portrait-480.avif 480w, /assets/portrait/portrait-768.avif 768w, /assets/portrait/portrait-1024.avif 1024w',
  webp: '/assets/portrait/portrait-480.webp 480w, /assets/portrait/portrait-768.webp 768w, /assets/portrait/portrait-1024.webp 1024w',
  jpeg: '/assets/portrait/portrait-480.jpg 480w, /assets/portrait/portrait-768.jpg 768w, /assets/portrait/portrait-1024.jpg 1024w',
};
/*
 * The page's only avatar, and a small one: 44px square beside the name at every
 * breakpoint, so it always requests the smallest generated candidate. It is not
 * repeated in the About section.
 */
const portraitSizes = '44px';

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const portraitRef = useRef<HTMLImageElement>(null);

  /*
   * The avatar is eager and above the fold, so on a prerendered page it can
   * finish — or fail — before React hydrates, and an `error` that has already
   * fired never reaches the handler below. Without this the frame keeps a
   * broken-image glyph instead of falling back to its empty ground. Read once
   * on mount: `complete` with no intrinsic width is exactly "this one failed".
   */
  useEffect(() => {
    const image = portraitRef.current;
    if (image?.complete && image.naturalWidth === 0) setPortraitFailed(true);
  }, []);

  const visualState = useHeroVisual({
    hostRef: heroRef,
    canvasRef,
    enabled: motionEnabled,
  });

  return (
    <section
      ref={heroRef}
      className={styles.hero}
      data-hero="landing"
      data-motion-hero="true"
      data-hero-visual={visualState}
      aria-labelledby="hero-heading"
    >
      {/*
       * The optical ribbon. Purely decorative: hidden from assistive
       * technology, transparent to pointer events, and painted behind the copy,
       * so the heading, the paragraph and both calls to action stay exactly
       * where they are and stay clickable.
       *
       * The SVG is the composition. The canvas over it is an enhancement that
       * may never arrive — it is only mounted into once a fine pointer has
       * moved inside a visible hero and WebGL has answered — and the two
       * crossfade, so there is no moment where the hero has no object in it.
       */}
      <div
        className={styles.decor}
        aria-hidden="true"
        data-motion-enter="decor"
      >
        <div className={styles.stage}>
          <HeroRibbon
            className={styles.ribbon}
            shadowClassName={styles.ribbonShadow}
          />
          <canvas ref={canvasRef} className={styles.canvas} />
          <div className={styles.sheen} />
        </div>
        <div className={styles.scrim} />
      </div>

      <div className={styles.identityRow} data-motion-enter="portrait">
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
              ref={portraitRef}
              src="/assets/portrait/portrait-480.jpg"
              srcSet={portraitSources.jpeg}
              sizes={portraitSizes}
              alt=""
              width="480"
              height="600"
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
