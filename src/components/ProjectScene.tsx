import { useCallback, useEffect, useRef, useState } from 'react';
import type { Locale, Project, ProjectVariant } from '../content';
import { observeProjectViewOnce } from '../lib/analytics';
import { usePointerParallax } from '../lib/motion';
import { useViewedOnce } from '../lib/useViewedOnce';
import { ProofRow } from './ProofRow';
import styles from './ProjectScene.module.css';

interface ProjectSceneProps {
  project: Project;
  locale: Locale;
  /** Localized description; absent while a project has no approved capture. */
  screenshotAlt?: string;
  /** Localized caption shown beneath the screenshot; absent along with the alt. */
  screenshotCaption?: string;
}

/*
 * Each variant gives the frame a different share of the page, so each needs its
 * own `sizes` hint: the lead frame runs the full content width, the two
 * side-by-side scenes take seven of twelve columns, and the closing compact row
 * shows a thumbnail that must not pull a 1440px source.
 */
const variantScreenshotSizes: Record<ProjectVariant, string> = {
  lead: '(min-width: 80rem) 1184px, 92vw',
  major: '(min-width: 56rem) 56vw, 100vw',
  product: '(min-width: 56rem) 56vw, 100vw',
  compact: '(min-width: 56rem) 200px, 18rem',
};

export function ProjectScene({
  project,
  locale,
  screenshotAlt,
  screenshotCaption,
}: ProjectSceneProps) {
  const [screenshotFailed, setScreenshotFailed] = useState(false);
  const showsScreenshot = Boolean(screenshotAlt) && !screenshotFailed;
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

  // An explicit map rather than a computed key, so every class is statically
  // resolvable and a new variant fails to compile instead of silently
  // rendering unstyled.
  const visualVariantClass: Record<ProjectVariant, string | undefined> = {
    lead: styles.leadVisual,
    major: styles.majorVisual,
    product: styles.productVisual,
    compact: styles.compactVisual,
  };
  const screenshotSizes = variantScreenshotSizes[variant];

  const visual = (
    <div
      ref={visualMotion.ref}
      className={`${styles.visual} ${visualVariantClass[variant]}`}
      role={showsScreenshot ? undefined : 'img'}
      aria-label={
        showsScreenshot ? undefined : `${project.name}: ${project.eyebrow}`
      }
      data-visual-kind={
        showsScreenshot ? 'product-screenshot' : 'abstract-geometry'
      }
      data-image-state={screenshotFailed ? 'failed' : undefined}
      data-motion-parallax="true"
      data-motion-reveal="visual"
      onPointerMove={visualMotion.onPointerMove}
      onPointerLeave={visualMotion.onPointerLeave}
    >
      {showsScreenshot ? (
        <picture className={styles.screenshot}>
          <source
            type="image/avif"
            sizes={screenshotSizes}
            srcSet={`/assets/projects/${project.slug}-640.avif 640w, /assets/projects/${project.slug}-960.avif 960w, /assets/projects/${project.slug}-1440.avif 1440w`}
          />
          <source
            type="image/webp"
            sizes={screenshotSizes}
            srcSet={`/assets/projects/${project.slug}-640.webp 640w, /assets/projects/${project.slug}-960.webp 960w, /assets/projects/${project.slug}-1440.webp 1440w`}
          />
          <img
            src={`/assets/projects/${project.slug}-960.jpg`}
            srcSet={`/assets/projects/${project.slug}-640.jpg 640w, /assets/projects/${project.slug}-960.jpg 960w, /assets/projects/${project.slug}-1440.jpg 1440w`}
            sizes={screenshotSizes}
            alt={screenshotAlt ?? ''}
            width="1440"
            height="720"
            loading="lazy"
            decoding="async"
            onError={() => setScreenshotFailed(true)}
          />
        </picture>
      ) : null}
      <div
        className={styles.geometry}
        aria-hidden="true"
        data-motion-parallax-layer="true"
      >
        <span className={styles.lightPlane} data-geometry-layer="light-plane" />
        <span className={styles.depthPlane} data-geometry-layer="depth-plane" />
        <span className={styles.arc} data-geometry-layer="arc" />
        <span className={styles.lineField} data-geometry-layer="line-field" />
        <span className={styles.nodes} data-geometry-layer="nodes">
          <span />
          <span />
          <span />
        </span>
      </div>
    </div>
  );

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

  /**
   * The named outbound link every scene carries, so the destination is a
   * deliberate "Visit <product>" rather than only the title itself.
   */
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

  /*
   * A caption describes the capture, so it is dropped when the capture is gone
   * — the link stays, keeping the fallback readable rather than captioned.
   */
  const figure = (figureClassName: string | undefined) => (
    <figure className={[styles.figure, figureClassName].join(' ')}>
      {visual}
      <figcaption className={styles.caption} data-motion-reveal="copy">
        {showsScreenshot && screenshotCaption ? (
          <span>{screenshotCaption}</span>
        ) : null}
        {outboundLink}
      </figcaption>
    </figure>
  );

  const sceneProps = {
    ref: setSceneRef,
    'data-project-slug': project.slug,
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
            <p className={styles.summary}>{project.summary}</p>
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
          <p className={styles.summary}>{project.summary}</p>
          <p className={styles.contribution}>{project.contribution}</p>
        </div>
        <div className={styles.compactMeta} data-motion-reveal="copy">
          {capabilities}
          {outboundLink}
        </div>
        {visual}
      </article>
    );
  }

  // `major` and `product` share a side-by-side composition and differ in which
  // side the frame takes and whether a metrics row sits inside the copy.
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
        <p className={styles.summary}>{project.summary}</p>
        <p className={styles.contribution}>{project.contribution}</p>
        {project.metrics ? (
          <ProofRow points={project.metrics} className={styles.metrics} />
        ) : null}
        {capabilities}
      </div>

      {figure(isProduct ? styles.productFigure : styles.majorFigure)}
    </article>
  );
}
