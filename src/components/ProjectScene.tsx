import { useCallback, useEffect, useRef, useState } from 'react';
import type { Locale, Project, ScreenshotProjectSlug } from '../content';
import { observeProjectViewOnce } from '../lib/analytics';
import { usePointerParallax } from '../lib/motion';
import { useViewedOnce } from '../lib/useViewedOnce';
import { ProofRow } from './ProofRow';
import styles from './ProjectScene.module.css';

interface ProjectSceneProps {
  project: Project;
  locale: Locale;
  /** Localized description; present only for a project in screenshot mode. */
  screenshotAlt?: string;
  /** Localized caption shown beneath the screenshot; present alongside the alt. */
  screenshotCaption?: string;
}

/*
 * Per project, not per variant: TradingView is a 2:1 desktop capture running
 * the content width, Splithub a near-square crop of the app, so neither the
 * `sizes` hint nor the intrinsic dimensions can be shared.
 */
const screenshots: Record<ScreenshotProjectSlug, ScreenshotGeometry> = {
  tradingview: {
    slug: 'tradingview',
    widths: [640, 960, 1440],
    fallbackWidth: 960,
    width: 1440,
    height: 720,
    sizes: '(min-width: 80rem) 1136px, 92vw',
  },
  splithub: {
    // A crop of the phone and its two floating notifications, lifted from the
    // Splithub capture; `scripts/process-images.mjs` holds the rectangle.
    slug: 'splithub-app',
    widths: [312, 624],
    fallbackWidth: 624,
    width: 624,
    height: 624,
    sizes: '(min-width: 56rem) 532px, min(532px, calc(100vw - 56px))',
  },
};

interface ScreenshotGeometry {
  slug: string;
  widths: readonly number[];
  fallbackWidth: number;
  width: number;
  height: number;
  sizes: string;
}

export function ProjectScene({
  project,
  locale,
  screenshotAlt,
  screenshotCaption,
}: ProjectSceneProps) {
  const [screenshotFailed, setScreenshotFailed] = useState(false);
  // Text mode renders no figure and no substitute graphic: the copy is the
  // scene. See `ProjectMedia`.
  const showsScreenshot =
    project.media === 'screenshot' &&
    Boolean(screenshotAlt) &&
    !screenshotFailed;
  const headingId = `project-${project.slug}-heading`;
  const { variant } = project;
  const { observed, ref: motionRef } = useViewedOnce<HTMLElement>();
  const analyticsRef = useRef<HTMLElement>(null);
  const visualMotion = usePointerParallax<HTMLDivElement>();
  const setSceneRef = useCallback(
    (element: HTMLElement | null) => {
      motionRef.current = element;
      analyticsRef.current = element;
    },
    [motionRef],
  );

  useEffect(() => {
    const element = analyticsRef.current;
    if (!element) return;

    return observeProjectViewOnce(element, {
      name: 'project_viewed',
      properties: { slug: project.slug, locale },
    });
  }, [locale, project.slug]);

  const shot = screenshots[project.slug as ScreenshotProjectSlug];

  // The capture sits inset on a neutral plate: a bright interface dropped
  // straight onto a near-black page reads as a pasted-in rectangle.
  const visual = shot ? (
    <div
      ref={visualMotion.ref}
      className={`${styles.visual} ${project.slug === 'splithub' ? styles.appVisual : styles.wideVisual}`}
      data-visual-kind="product-screenshot"
      data-image-state={screenshotFailed ? 'failed' : undefined}
      data-motion-parallax="true"
      data-motion-reveal="visual"
      onPointerMove={visualMotion.onPointerMove}
      onPointerLeave={visualMotion.onPointerLeave}
    >
      <picture className={styles.screenshot}>
        <source
          type="image/avif"
          sizes={shot.sizes}
          srcSet={shot.widths
            .map(
              (width) =>
                `/assets/projects/${shot.slug}-${width}.avif ${width}w`,
            )
            .join(', ')}
        />
        <source
          type="image/webp"
          sizes={shot.sizes}
          srcSet={shot.widths
            .map(
              (width) =>
                `/assets/projects/${shot.slug}-${width}.webp ${width}w`,
            )
            .join(', ')}
        />
        <img
          src={`/assets/projects/${shot.slug}-${shot.fallbackWidth}.jpg`}
          srcSet={shot.widths
            .map(
              (width) => `/assets/projects/${shot.slug}-${width}.jpg ${width}w`,
            )
            .join(', ')}
          sizes={shot.sizes}
          alt={screenshotAlt ?? ''}
          width={shot.width}
          height={shot.height}
          loading="lazy"
          decoding="async"
          onError={() => setScreenshotFailed(true)}
        />
      </picture>
    </div>
  ) : null;

  const titleHeading = (
    <h3 className={styles.title} id={headingId}>
      <a href={project.href} target="_blank" rel="noopener noreferrer">
        {project.name}
        <span aria-hidden="true">↗</span>
      </a>
    </h3>
  );

  const eyebrow = <p className={styles.eyebrow}>{project.eyebrow}</p>;

  const capabilities = (
    <p className={styles.capabilities}>
      <span aria-hidden="true">//</span>
      {project.capabilities}
    </p>
  );

  // Named outbound link, so the destination is a deliberate "Visit <product>"
  // rather than only the title.
  const outboundLink = (
    <a
      className={styles.outboundLink}
      href={project.href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {project.linkLabel}
      <span aria-hidden="true">↗</span>
    </a>
  );

  // A caption describes the capture, so both are dropped together rather than
  // captioning an empty box.
  const figure = (figureClassName: string | undefined) =>
    showsScreenshot ? (
      <figure className={[styles.figure, figureClassName].join(' ')}>
        {visual}
        <figcaption className={styles.caption} data-motion-reveal="copy">
          {screenshotCaption ? <span>{screenshotCaption}</span> : null}
          {outboundLink}
        </figcaption>
      </figure>
    ) : (
      <p
        className={[styles.figure, styles.captionOnly, figureClassName].join(
          ' ',
        )}
        data-motion-reveal="copy"
      >
        {outboundLink}
      </p>
    );

  const sceneProps = {
    ref: setSceneRef,
    'data-project-slug': project.slug,
    'data-project-media': project.media,
    'data-motion-project': 'true',
    'data-motion-viewed': observed ? 'true' : undefined,
    'aria-labelledby': headingId,
  } as const;

  if (variant === 'lead') {
    return (
      <article
        {...sceneProps}
        className={`${styles.scene} ${styles.leadScene}`}
      >
        <div className={styles.leadHeader} data-motion-reveal="copy">
          <div className={styles.leadIntro}>
            {eyebrow}
            {titleHeading}
          </div>
          <div className={styles.leadDescription}>
            {project.summary ? (
              <p className={styles.summary}>{project.summary}</p>
            ) : null}
            <p className={styles.contribution}>{project.contribution}</p>
            {capabilities}
          </div>
        </div>

        {figure(styles.leadFigure)}

        {project.proofs ? (
          <ul className={styles.leadProofs}>
            {project.proofs.map((proof) => (
              <li key={proof.title}>
                <h4>{proof.title}</h4>
                <p>{proof.body}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </article>
    );
  }

  // The compact row that closes the sequence: name, one sentence, one link,
  // and no column held open for a thumbnail that is not coming.
  if (variant === 'compact') {
    return (
      <article
        {...sceneProps}
        className={`${styles.scene} ${styles.compactScene}`}
      >
        <div className={styles.compactIntro} data-motion-reveal="copy">
          {eyebrow}
          {titleHeading}
        </div>
        <div className={styles.compactBody} data-motion-reveal="copy">
          <p className={styles.contribution}>{project.contribution}</p>
        </div>
        <div className={styles.compactMeta} data-motion-reveal="copy">
          {capabilities}
          {outboundLink}
        </div>
      </article>
    );
  }

  // A `major` scene in text mode sets summary and contribution in two columns
  // sized by the type, rather than by a screenshot that is not there.
  if (variant === 'major' && project.media === 'text') {
    return (
      <article
        {...sceneProps}
        className={`${styles.scene} ${styles.textScene}`}
      >
        <div className={styles.textIntro} data-motion-reveal="copy">
          {eyebrow}
          {titleHeading}
          {project.summary ? (
            <p className={styles.textLead}>{project.summary}</p>
          ) : null}
        </div>
        <div className={styles.textDetail} data-motion-reveal="copy">
          <p className={styles.contribution}>{project.contribution}</p>
          {capabilities}
          {outboundLink}
        </div>
      </article>
    );
  }

  const isProduct = variant === 'product';

  return (
    <article
      {...sceneProps}
      className={`${styles.scene} ${isProduct ? styles.productScene : styles.majorScene}`}
    >
      <div
        className={isProduct ? styles.productCopy : styles.majorCopy}
        data-motion-reveal="copy"
        data-motion-sticky="true"
      >
        {eyebrow}
        {titleHeading}
        {project.summary ? (
          <p className={styles.summary}>{project.summary}</p>
        ) : null}
        <p className={styles.contribution}>{project.contribution}</p>
        {project.metrics ? (
          <div className={styles.metricsRow}>
            <ProofRow points={project.metrics} className={styles.metrics} />
            {project.availability ? (
              <p className={styles.availability}>{project.availability}</p>
            ) : null}
          </div>
        ) : null}
        {capabilities}
      </div>

      {figure(isProduct ? styles.productFigure : styles.majorFigure)}
    </article>
  );
}
