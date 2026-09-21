import { useEffect, useRef, useState, type CSSProperties } from 'react';
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

/*
 * Every run of whitespace that is a break opportunity — which is all of them
 * except a non-breaking space. Splitting on a non-breaking space would let the
 * pair it joins land on two different lines, which is the one thing the
 * character exists to prevent, so the pair stays inside a single word instead.
 */
const wordGap = /([^\S\u00a0]+)/u;

/**
 * The heading's phrases, cut into one box per word.
 *
 * The split happens here rather than after hydration, so the words are in the
 * served markup and the heading is never re-rendered in front of the visitor.
 * The whitespace is not swallowed by the boxes: it stays between them as the
 * text nodes it always was, so the heading keeps exactly the break
 * opportunities it had and `text-wrap: balance` balances the same lines. The
 * index rides along as a custom property because the stagger is the only thing
 * about a word that differs from its neighbour.
 */
function toWords(lines: readonly [string, string]) {
  let wordCount = 0;

  const split = (line: string) =>
    line.split(wordGap).map((part, partIndex) => {
      /*
       * Splitting on a capturing group alternates strictly — word, gap, word —
       * so the odd positions are the whitespace, and an empty even position is
       * the artefact of a line that starts or ends with a gap.
       */
      if (partIndex % 2 === 1 || part === '') return part;

      const wordIndex = wordCount;
      wordCount += 1;
      return (
        <span
          key={partIndex}
          data-motion-word="true"
          aria-hidden="true"
          style={{ '--word-index': String(wordIndex) } as CSSProperties}
        >
          {part}
        </span>
      );
    });

  return [split(lines[0]), split(lines[1])] as const;
}

interface HeroProps {
  content: LandingContent['hero'];
  /** From the application's one `useMotionEnhancementGate()`, never re-derived. */
  motionEnabled: boolean;
}

export function Hero({ content, motionEnabled }: HeroProps) {
  const [portraitFailed, setPortraitFailed] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const portraitRef = useRef<HTMLImageElement>(null);

  /*
   * The avatar is eager and above the fold, so it can fail before React
   * hydrates and that `error` never reaches the handler below. `complete` with
   * no intrinsic width is exactly "this one already failed".
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

  const [firstPhrase, secondPhrase] = toWords(content.titleLines);

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
       * The SVG is the composition; the canvas over it is an enhancement that
       * may never arrive. Both are decorative: hidden from assistive
       * technology, transparent to pointer events, painted behind the copy.
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
        {/*
         * The words are boxes for the animation and nothing more, so they are
         * hidden from assistive technology and the h1 carries the whole phrase
         * as its label: one heading, read as one phrase, rather than a run of
         * fragments. The label is the only place the text is duplicated — the
         * words themselves are still the document's copy of it, in order, so
         * selecting the heading copies the phrase and a crawler reads it once.
         */}
        <h1
          className={styles.title}
          id="hero-heading"
          aria-label={content.titleLines.join(' ')}
        >
          <span className={styles.titleLine}>{firstPhrase}</span>{' '}
          <span className={`${styles.titleLine} ${styles.titleLineAccent}`}>
            {secondPhrase}
          </span>
        </h1>
        <p className={styles.body} data-motion-enter="subcopy">
          {content.body}
        </p>
        <div className={styles.actions} data-motion-enter="subcopy">
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
