import { useState } from 'react';
import { usePointerParallax } from '../lib/motion';
import { useViewedOnce } from '../lib/useViewedOnce';
import styles from './PersonalStrip.module.css';

export interface PersonalPhoto {
  src: string;
  /** Responsive JPEG candidates; omitted while a slot is still a placeholder. */
  srcSet?: string;
  /** Modern-format candidates offered ahead of the JPEG fallback. */
  sources?: { avif: string; webp: string };
  sizes?: string;
  width: number;
  height: number;
  /** Localized description for meaningful photos; decorative placeholders use an empty string. */
  alt: string;
}

/**
 * Exactly three frames: surf, snowboard, drift-front. A tuple rather than an
 * array, because "three" is the composition — the strip's desktop grid, its
 * mobile 1+2 stack and the section's height budget are all written for three
 * frames, and a fourth would silently reflow all three.
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

/**
 * The About section: a short paragraph beside a compact three-frame strip.
 *
 * There is no portrait here. The page shows exactly one avatar and it belongs
 * to the hero, so this section carries only the activities — repeating the
 * portrait added no story and cost the section a column.
 */
export function PersonalStrip({ content, photos }: PersonalStripProps) {
  const { observed, ref } = useViewedOnce<HTMLElement>();
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
              {photo.sources ? (
                <>
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
                </>
              ) : null}
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
