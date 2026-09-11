import type { Locale, Project, ProjectScreenshot } from '../content';
import { ProjectScene } from './ProjectScene';
import styles from './SelectedWork.module.css';

interface SelectedWorkProps {
  heading: string;
  projects: readonly Project[];
  screenshots: readonly ProjectScreenshot[];
  locale: Locale;
}

export function SelectedWork({
  heading,
  projects,
  screenshots,
  locale,
}: SelectedWorkProps) {
  return (
    <section
      className={styles.selectedWork}
      id="work"
      aria-labelledby="projects-heading"
    >
      <div className={styles.header}>
        <p aria-hidden="true">01 /</p>
        <h2 id="projects-heading">{heading}</h2>
      </div>
      <div className={styles.scenes}>
        {projects.map((project) => {
          const screenshot = screenshots.find(
            (shot) => shot.slug === project.slug,
          );

          return (
            <ProjectScene
              key={project.slug}
              project={project}
              locale={locale}
              screenshotAlt={screenshot?.alt}
              screenshotCaption={screenshot?.caption}
            />
          );
        })}
      </div>
    </section>
  );
}
