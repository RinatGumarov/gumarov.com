import { usePointerParallax } from '../lib/motion';
import { useViewedOnce } from '../lib/useViewedOnce';
import styles from './PersonalStrip.module.css';

export interface PersonalPhoto {
  src: string;
  width: number;
  height: number;
  /** Localized description for meaningful photos; decorative placeholders use an empty string. */
  alt: string;
}

export type PersonalPhotos = readonly [
  PersonalPhoto,
  PersonalPhoto,
  PersonalPhoto,
];

interface PersonalStripProps {
  content: {
    heading: string;
    body: string;
    items: readonly string[];
  };
  photos: PersonalPhotos;
}

export function PersonalStrip(_props: PersonalStripProps) {
  const { content, photos } = _props;
  const { observed, ref } = useViewedOnce<HTMLElement>();
  const stripMotion = usePointerParallax<HTMLDivElement>();

  return (
    <section
      ref={ref}
      className={styles.personal}
      aria-labelledby="personal-heading"
      data-motion-personal="true"
      data-motion-viewed={observed ? 'true' : undefined}
    >
      <div className={styles.copy} data-motion-reveal="copy">
        <p className={styles.index} aria-hidden="true">
          03 /
        </p>
        <h2 id="personal-heading">{content.heading}</h2>
        <p className={styles.summary}>{content.body}</p>
        <ul className={styles.interests}>
          {content.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div
        ref={stripMotion.ref}
        className={styles.filmStrip}
        data-motion-parallax="true"
        data-motion-reveal="visual"
        onPointerMove={stripMotion.onPointerMove}
        onPointerLeave={stripMotion.onPointerLeave}
      >
        {photos.map((photo, index) => (
          <figure
            className={styles.frame}
            data-motion-parallax-layer="true"
            key={index}
          >
            <img
              src={photo.src}
              width={photo.width}
              height={photo.height}
              alt={photo.alt}
              loading="lazy"
              decoding="async"
            />
          </figure>
        ))}
      </div>
    </section>
  );
}
