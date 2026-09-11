import { useId } from 'react';

/**
 * The hero's decorative engineering drawing (plan §5): a 48px grid, an editor
 * outline on the left, a chart polyline on the right, and three guides joining
 * them. One geometry, rendered twice by `Hero` — once as the resting drawing
 * and once as the cyan copy the lens reveals — so the two layers can never
 * drift apart.
 *
 * It is a drawing of its own invention, not a depiction of any real internal
 * architecture or a running terminal. Every node is decorative: the element is
 * `aria-hidden`, not focusable, and takes no pointer events (see
 * `Hero.module.css`). Strokes stay 1px at any scale through
 * `vector-effect: non-scaling-stroke`, applied in CSS so the attribute does not
 * have to be repeated on every node.
 */
export function HeroBlueprint({
  className,
  layer,
}: {
  className?: string;
  /** `base` is the resting drawing; `lens` is the cyan copy under the mask. */
  layer: 'base' | 'lens';
}) {
  // Two instances share this file, so the pattern id has to be per-instance.
  const gridId = `hero-grid-${useId()}`;

  return (
    <svg
      className={className}
      data-hero-blueprint={layer}
      viewBox="0 0 1200 600"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      role="presentation"
    >
      <defs>
        <pattern
          id={gridId}
          width="48"
          height="48"
          patternUnits="userSpaceOnUse"
        >
          <path d="M48 0H0v48" fill="none" stroke="currentColor" />
        </pattern>
      </defs>

      <rect width="1200" height="600" fill={`url(#${gridId})`} />

      <g fill="none" stroke="currentColor">
        {/* Editor outline, left. */}
        <rect x="96" y="144" width="432" height="336" />
        <path d="M96 192h432" />
        <circle cx="120" cy="168" r="5" />
        <circle cx="144" cy="168" r="5" />
        <circle cx="168" cy="168" r="5" />
        <path d="M216 192v288" />
        <path d="M132 240h60" />
        <path d="M132 288h60" />
        <path d="M132 336h48" />
        <path d="M132 384h60" />
        <path d="M132 432h36" />
        <path d="M456 192v288" />
        <path d="M240 240h192" />
        <path d="M264 264h144" />
        <path d="M240 288h168" />
        <path d="M264 312h96" />
        <path d="M264 336h168" />
        <path d="M288 360h120" />
        <path d="M264 384h120" />
        <path d="M288 408h144" />
        <path d="M240 432h192" />

        {/* Chart panel, right. */}
        <rect x="672" y="192" width="384" height="288" />
        <path d="M672 240h384" />
        <path d="M720 264v168h288" />
        <polyline points="720 408 768 372 816 384 864 324 912 340 960 288 1008 300 1056 264" />
        <circle cx="864" cy="324" r="5" />
        <circle cx="1056" cy="264" r="5" />

        {/* Three guides joining the two outlines. */}
        <path d="M528 240h72v48h72" />
        <path d="M528 336h144" />
        <path d="M528 432h72v-48h72" />
        <circle cx="600" cy="288" r="4" />
        <circle cx="600" cy="336" r="4" />
        <circle cx="600" cy="384" r="4" />

        {/* Corner registration ticks. */}
        <path d="M48 96h48M48 96v48" />
        <path d="M1152 96h-48M1152 96v48" />
        <path d="M48 528h48M48 528v-48" />
        <path d="M1152 528h-48M1152 528v-48" />

        {/* Dimension line under the editor outline. */}
        <path d="M96 528h432" />
        <path d="M96 520v16" />
        <path d="M528 520v16" />
      </g>
    </svg>
  );
}
