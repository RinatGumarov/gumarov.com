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
      >
        <div className={styles.interface} aria-hidden="true">
          <div className={styles.interfaceTop}>
            <span />
            <span />
            <span />
          </div>
          <div className={styles.interfaceBody}>
            <div className={styles.interfaceRail}>
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className={styles.interfaceCanvas}>
              <span className={styles.panelPrimary} />
              <span className={styles.panelSecondary} />
              <span className={styles.signal} />
              <span className={styles.marker} />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
