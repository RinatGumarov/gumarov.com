import { useCallback, useEffect, useRef } from 'react';
import type { Locale, Project } from '../content';
import { observeProjectViewOnce } from '../lib/analytics';
import { usePointerParallax } from '../lib/motion';
import { useViewedOnce } from '../lib/useViewedOnce';
import styles from './ProjectScene.module.css';

interface ProjectSceneProps {
  index: number;
  project: Project;
  locale: Locale;
}

export function ProjectScene({ index, project, locale }: ProjectSceneProps) {
  const headingId = `project-${project.slug}-heading`;
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

  return (
    <article
      ref={setSceneRef}
      className={styles.scene}
      data-project-slug={project.slug}
      data-motion-project="true"
      data-motion-viewed={observed ? 'true' : undefined}
      aria-labelledby={headingId}
    >
      <div
        className={styles.copy}
        data-motion-reveal="copy"
        data-motion-sticky="true"
      >
        <p className={styles.eyebrow}>
          <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
          {project.eyebrow}
        </p>
        <h3 className={styles.title} id={headingId}>
          <a href={project.href} target="_blank" rel="noopener noreferrer">
            {project.name}
            <span aria-hidden="true">↗</span>
          </a>
        </h3>
        <p className={styles.summary}>{project.summary}</p>
        <p className={styles.contribution}>{project.contribution}</p>
        <p className={styles.capabilities}>
          <span aria-hidden="true">//</span>
          {project.capabilities}
        </p>
      </div>

      <div
        ref={visualMotion.ref}
        className={styles.visual}
        role="img"
        aria-label={`${project.name}: ${project.eyebrow}`}
        data-visual-kind="abstract-geometry"
        data-motion-parallax="true"
        data-motion-reveal="visual"
        onPointerMove={visualMotion.onPointerMove}
        onPointerLeave={visualMotion.onPointerLeave}
      >
        <div
          className={styles.geometry}
          aria-hidden="true"
          data-motion-parallax-layer="true"
        >
          <span
            className={styles.lightPlane}
            data-geometry-layer="light-plane"
          />
          <span
            className={styles.depthPlane}
            data-geometry-layer="depth-plane"
          />
          <span className={styles.arc} data-geometry-layer="arc" />
          <span className={styles.lineField} data-geometry-layer="line-field" />
          <span className={styles.nodes} data-geometry-layer="nodes">
            <span />
            <span />
            <span />
          </span>
        </div>
      </div>
    </article>
  );
}
