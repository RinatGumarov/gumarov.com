import type { Project } from '../content';
import { ProjectScene } from './ProjectScene';
import styles from './SelectedWork.module.css';

interface SelectedWorkProps {
  heading: string;
  projects: readonly Project[];
}

export function SelectedWork({ heading, projects }: SelectedWorkProps) {
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
        {projects.map((project, index) => (
          <ProjectScene key={project.slug} index={index} project={project} />
        ))}
      </div>
    </section>
  );
}
