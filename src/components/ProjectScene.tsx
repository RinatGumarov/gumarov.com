import type { Project } from '../content';
import styles from './ProjectScene.module.css';

interface ProjectSceneProps {
  index: number;
  project: Project;
}

export function ProjectScene({ index, project }: ProjectSceneProps) {
  const headingId = `project-${project.slug}-heading`;

  return (
    <article
      className={styles.scene}
      data-project-slug={project.slug}
      aria-labelledby={headingId}
    >
      <div className={styles.copy}>
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
        className={styles.visual}
        role="img"
        aria-label={`${project.name}: ${project.eyebrow}`}
        data-visual-kind="abstract-geometry"
      >
        <div className={styles.geometry} aria-hidden="true">
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
