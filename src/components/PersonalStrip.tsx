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

export type PersonalPhotos = readonly PersonalPhoto[];

interface PersonalStripProps {
  content: {
    heading: string;
    body: string;
    items: readonly string[];
  };
  /** The full-width surf frame that opens the section (plan §3.7/§4). */
  lead: PersonalPhoto;
  /** Shown beside the body copy, below the lead frame. */
  portrait: PersonalPhoto;
  /**
   * Exactly five photos in the plan's §3.7 order: drift-front, skate,
   * snowboard, powder, drift-rear. The same order drives the desktop
   * asymmetric grid (7+5, then 4+4+4) and the mobile two-column stack.
   */
  activity: PersonalPhotos;
}

interface PhotoFrameProps {
  photo: PersonalPhoto;
  className: string | undefined;
  failed: boolean;
  onError: () => void;
}

function PhotoFrame({ photo, className, failed, onError }: PhotoFrameProps) {
  const image = (
    <img
      src={photo.src}
      srcSet={photo.srcSet}
      sizes={photo.sizes}
      width={photo.width}
      height={photo.height}
      alt={photo.alt}
      loading="lazy"
      decoding="async"
      onError={onError}
    />
  );

  return (
    <figure
      className={className}
      data-image-state={failed ? 'failed' : undefined}
      data-motion-parallax-layer="true"
    >
      {photo.sources ? (
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
          {image}
        </picture>
      ) : (
        image
      )}
    </figure>
  );
}

export function PersonalStrip(_props: PersonalStripProps) {
  const { content, lead, portrait, activity } = _props;
  const { observed, ref } = useViewedOnce<HTMLElement>();
  const stripMotion = usePointerParallax<HTMLDivElement>();
  const [failedPhotos, setFailedPhotos] = useState<readonly string[]>([]);

  const markFailed = (id: string) => () =>
    setFailedPhotos((failed) =>
      failed.includes(id) ? failed : [...failed, id],
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
      <div className={styles.headingRow} data-motion-reveal="copy">
        <p className={styles.index} aria-hidden="true">
          03 /
        </p>
        <h2 id="personal-heading">{content.heading}</h2>
      </div>

      <div
        ref={stripMotion.ref}
        className={styles.visual}
        data-motion-parallax="true"
        data-motion-reveal="visual"
        onPointerMove={stripMotion.onPointerMove}
        onPointerLeave={stripMotion.onPointerLeave}
      >
        <PhotoFrame
          photo={lead}
          className={styles.lead}
          failed={failedPhotos.includes('lead')}
          onError={markFailed('lead')}
        />

        {/*
         * Body copy comes after the lead photo (plan §3.7: the mandatory
         * text never overlays the variable photograph), paired here with
         * the portrait in the same row on desktop.
         */}
        <div className={styles.introRow}>
          <div className={styles.copy} data-motion-reveal="copy">
            <p className={styles.summary}>{content.body}</p>
            <ul className={styles.interests}>
              {content.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <PhotoFrame
            photo={portrait}
            className={styles.portraitFrame}
            failed={failedPhotos.includes('portrait')}
            onError={markFailed('portrait')}
          />
        </div>

        <div className={styles.activityGrid}>
          {activity.map((photo, index) => (
            <PhotoFrame
              key={`${index}-${photo.alt}`}
              photo={photo}
              className={styles.frame}
              failed={failedPhotos.includes(`activity-${index}`)}
              onError={markFailed(`activity-${index}`)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
