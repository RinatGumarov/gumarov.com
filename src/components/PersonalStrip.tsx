import { useState } from 'react';
import { usePointerParallax } from '../lib/motion';
import { useViewedOnce } from '../lib/useViewedOnce';
import styles from './PersonalStrip.module.css';

export interface PersonalPhoto {
  src: string;
  srcSet: string;
  sources: { avif: string; webp: string };
  sizes: string;
  width: number;
  height: number;
  alt: string;
}

/**
 * A tuple, not an array: the strip's desktop row and its mobile 1 + 2 stack are
 * both written for exactly three frames.
 */
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

/** The About section: a short paragraph beside a compact three-frame strip. */
export function PersonalStrip({ content, photos }: PersonalStripProps) {
  // Three frames stack under the copy on a phone, which makes the strip taller
  // than the screen it is read on.
  const { observed, ref, scoped } = useViewedOnce<HTMLElement>({ tall: true });
  const stripMotion = usePointerParallax<HTMLDivElement>();
  const [failedPhotos, setFailedPhotos] = useState<readonly number[]>([]);

  const markFailed = (index: number) => () =>
    setFailedPhotos((failed) =>
      failed.includes(index) ? failed : [...failed, index],
    );

  return (
    <section
      ref={ref}
      id="about"
      className={styles.personal}
      aria-labelledby="personal-heading"
      data-motion-scope={scoped ? 'personal' : undefined}
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
        data-personal-frames={photos.length}
        onPointerMove={stripMotion.onPointerMove}
        onPointerLeave={stripMotion.onPointerLeave}
      >
        {photos.map((photo, index) => (
          <figure
            key={photo.alt}
            className={styles.frame}
            data-image-state={
              failedPhotos.includes(index) ? 'failed' : undefined
            }
            data-motion-parallax-layer="true"
          >
            <picture>
              <source
                type="image/avif"
                srcSet={photo.sources.avif}
                sizes={photo.sizes}
              />
              <source
                type="image/webp"
                srcSet={photo.sources.webp}
                sizes={photo.sizes}
              />
              <img
                src={photo.src}
                srcSet={photo.srcSet}
                sizes={photo.sizes}
                width={photo.width}
                height={photo.height}
                alt={photo.alt}
                loading="lazy"
                decoding="async"
                onError={markFailed(index)}
              />
            </picture>
          </figure>
        ))}
      </div>
    </section>
  );
}
