import { useId } from 'react';

/**
 * The hero's optical ribbon, drawn as SVG.
 *
 * This is the composition the page ships with: it renders on the server, it is
 * what a visitor sees with JavaScript disabled, with reduced motion, on a
 * touch device and whenever WebGL is unavailable, and it is what the enhanced
 * layer fades in over. It therefore has to be finished on its own rather than a
 * placeholder — everything below is geometry and light, not a loading state.
 *
 * The shape is generated from one centreline instead of hand-written path data.
 * A cubic Bézier gives the centre, an analytic tangent gives the normal at each
 * sample, and every other line in the drawing — both edges, the interior
 * strands, the lit rim — is the same centreline offset along that normal. They
 * cannot drift apart, and the interior strands genuinely follow the surface
 * rather than approximating it.
 *
 * Every node is decorative: the host marks the layer `aria-hidden` and takes no
 * pointer events (see `Hero.module.css`).
 */

const viewBoxWidth = 740;
const viewBoxHeight = 780;

/**
 * The centreline, as a cubic Bézier in view-box units. Both ends sit outside
 * the view box on purpose: a band that crosses the frame and continues past it
 * reads as a ribbon, where one that closes to a point at both ends reads as a
 * lens.
 */
const centreCurve = [
  { x: 150, y: 1070 },
  { x: 320, y: 700 },
  { x: 340, y: 120 },
  { x: 670, y: -150 },
] as const;

const maximumHalfWidth = 178;
const sampleCount = 112;

interface Sample {
  x: number;
  y: number;
  nx: number;
  ny: number;
  halfWidth: number;
}

function cubicAt(t: number, a: number, b: number, c: number, d: number) {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
}

function cubicSlopeAt(t: number, a: number, b: number, c: number, d: number) {
  const u = 1 - t;
  return 3 * u * u * (b - a) + 6 * u * t * (c - b) + 3 * t * t * (d - c);
}

/**
 * The ribbon's half-width along its length.
 *
 * Two things happen at once. The band narrows steadily as it rises, which is
 * simple perspective — the far end of a flat surface is smaller. And it pinches
 * hard around the middle, which is the twist: that is the point where the
 * surface turns nearly edge-on to the viewer before opening out again. Without
 * the pinch the shape is a tapering wedge; with it, the band has a front and a
 * back.
 */
function halfWidthAt(t: number) {
  const clamped = Math.min(1, Math.max(0, t));
  const perspective = 0.98 - 0.52 * clamped;
  const twist = 1 - 0.46 * Math.exp(-(((clamped - 0.54) / 0.155) ** 2));
  return maximumHalfWidth * perspective * twist;
}

function sampleRibbon(): Sample[] {
  const [p0, p1, p2, p3] = centreCurve;
  const samples: Sample[] = [];

  for (let index = 0; index <= sampleCount; index += 1) {
    const t = index / sampleCount;
    const x = cubicAt(t, p0.x, p1.x, p2.x, p3.x);
    const y = cubicAt(t, p0.y, p1.y, p2.y, p3.y);
    const dx = cubicSlopeAt(t, p0.x, p1.x, p2.x, p3.x);
    const dy = cubicSlopeAt(t, p0.y, p1.y, p2.y, p3.y);
    const length = Math.hypot(dx, dy) || 1;

    samples.push({
      x,
      y,
      // Left-hand normal, so negative offsets are the lit upper edge.
      nx: dy / length,
      ny: -dx / length,
      halfWidth: halfWidthAt(t),
    });
  }

  return samples;
}

const ribbonSamples = sampleRibbon();

function round(value: number) {
  return Math.round(value * 10) / 10;
}

/** The offset line at `side`, where -1 is the lit edge and 1 the shaded one. */
function offsetPath(side: number) {
  return ribbonSamples
    .map((sample, index) => {
      const x = sample.x + sample.nx * sample.halfWidth * side;
      const y = sample.y + sample.ny * sample.halfWidth * side;
      return `${index === 0 ? 'M' : 'L'}${round(x)} ${round(y)}`;
    })
    .join(' ');
}

/** The closed surface: down the lit edge, back along the shaded one. */
function surfacePath() {
  const lit = ribbonSamples.map((sample) => {
    const x = sample.x - sample.nx * sample.halfWidth;
    const y = sample.y - sample.ny * sample.halfWidth;
    return `${round(x)} ${round(y)}`;
  });
  const shaded = ribbonSamples
    .map((sample) => {
      const x = sample.x + sample.nx * sample.halfWidth;
      const y = sample.y + sample.ny * sample.halfWidth;
      return `${round(x)} ${round(y)}`;
    })
    .reverse();

  return `M${lit.join(' L')} L${shaded.join(' L')} Z`;
}

// Nine interior strands, spaced so they crowd slightly towards the lit edge —
// the way evenly spaced lines on a surface do when that surface turns away.
const strandOffsets = [
  -0.88, -0.72, -0.54, -0.34, -0.12, 0.12, 0.36, 0.6, 0.84,
];

const surface = surfacePath();
const litEdge = offsetPath(-1);
const shadedEdge = offsetPath(1);
const strands = strandOffsets.map((side) => offsetPath(side));

export function HeroRibbon({ className }: { className?: string }) {
  // Several ids in one document would collide, so every gradient and filter
  // reference is namespaced per instance.
  const scope = useId().replace(/:/gu, '');
  const id = (name: string) => `hero-ribbon-${name}-${scope}`;

  return (
    <svg
      className={className}
      viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
      role="presentation"
      data-hero-ribbon="svg"
    >
      <defs>
        {/* The glass itself: barely there at the ends, coolest in the swell. */}
        <linearGradient
          id={id('body')}
          x1="12%"
          y1="96%"
          x2="86%"
          y2="6%"
          gradientUnits="objectBoundingBox"
        >
          <stop offset="0" stopColor="#1aaed2" stopOpacity="0.1" />
          <stop offset="0.32" stopColor="#5fd9f2" stopOpacity="0.26" />
          <stop offset="0.58" stopColor="#cdf6ff" stopOpacity="0.34" />
          <stop offset="0.82" stopColor="#4e78ff" stopOpacity="0.18" />
          <stop offset="1" stopColor="#4e78ff" stopOpacity="0.06" />
        </linearGradient>

        {/*
         * Across the band rather than along it: bright where the surface faces
         * the light, falling away to nothing on the side turning from it. This
         * is the gradient that makes the ribbon read as thick.
         */}
        <linearGradient
          id={id('across')}
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
          gradientUnits="objectBoundingBox"
        >
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.38" />
          <stop offset="0.26" stopColor="#9fe9ff" stopOpacity="0.1" />
          <stop offset="0.68" stopColor="#080b0f" stopOpacity="0.28" />
          <stop offset="1" stopColor="#080b0f" stopOpacity="0.52" />
        </linearGradient>

        <linearGradient
          id={id('rim')}
          x1="0%"
          y1="100%"
          x2="100%"
          y2="0%"
          gradientUnits="objectBoundingBox"
        >
          <stop offset="0" stopColor="#83edff" stopOpacity="0" />
          <stop offset="0.22" stopColor="#cdf6ff" stopOpacity="0.75" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="0.78" stopColor="#83edff" stopOpacity="0.6" />
          <stop offset="1" stopColor="#46d9f5" stopOpacity="0" />
        </linearGradient>

        <linearGradient
          id={id('strand')}
          x1="0%"
          y1="100%"
          x2="100%"
          y2="0%"
          gradientUnits="objectBoundingBox"
        >
          <stop offset="0" stopColor="#46d9f5" stopOpacity="0" />
          <stop offset="0.3" stopColor="#b9f2ff" stopOpacity="0.42" />
          <stop offset="0.72" stopColor="#83edff" stopOpacity="0.3" />
          <stop offset="1" stopColor="#4e78ff" stopOpacity="0" />
        </linearGradient>

        {/*
         * The one warm note in the palette, placed where the surface turns
         * over near the top so it reads as a reflection rather than a colour
         * wash.
         */}
        <radialGradient id={id('warm')} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#e7ad65" stopOpacity="0.34" />
          <stop offset="1" stopColor="#e7ad65" stopOpacity="0" />
        </radialGradient>

        <radialGradient id={id('bloom')} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#9fe9ff" stopOpacity="0.3" />
          <stop offset="0.55" stopColor="#3aa4c8" stopOpacity="0.1" />
          <stop offset="1" stopColor="#0d1117" stopOpacity="0" />
        </radialGradient>

        <filter
          id={id('soft')}
          x="-35%"
          y="-35%"
          width="170%"
          height="170%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur stdDeviation="18" />
        </filter>

        <filter
          id={id('glow')}
          x="-40%"
          y="-40%"
          width="180%"
          height="180%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur stdDeviation="7" />
        </filter>

        <clipPath id={id('clip')}>
          <path d={surface} />
        </clipPath>

        {/*
         * The ends. The band leaves the frame through the top and the bottom —
         * `ribbon-bounds` keeps it off the left and right edges entirely — and
         * this is what turns those two exits into distance instead of a crop
         * line. It lives inside the SVG rather than in CSS because the view box
         * is letterboxed inside its element: a CSS gradient would fade against
         * the element's box and miss the edge doing the actual clipping.
         */}
        <linearGradient
          id={id('ends')}
          x1="0"
          y1="0"
          x2="0"
          y2={viewBoxHeight}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#000000" />
          <stop offset="0.07" stopColor="#ffffff" />
          <stop offset="0.78" stopColor="#ffffff" />
          <stop offset="1" stopColor="#000000" />
        </linearGradient>

        <mask id={id('endMask')} maskUnits="userSpaceOnUse">
          <rect
            width={viewBoxWidth}
            height={viewBoxHeight}
            fill={`url(#${id('ends')})`}
          />
        </mask>
      </defs>

      <g mask={`url(#${id('endMask')})`}>
        {/* Ambient bloom, so the ribbon sits in light instead of on black. */}
        <ellipse
          cx="300"
          cy="420"
          rx="290"
          ry="360"
          fill={`url(#${id('bloom')})`}
        />

        {/*
         * Depth: the same surface, pushed back and blurred. Not a second ribbon —
         * one object, its own shadow.
         */}
        <path
          d={surface}
          fill="#0b1b2a"
          opacity="0.85"
          filter={`url(#${id('soft')})`}
          /*
           * Scaled about the ribbon's own centre, written out as a translate
           * pair rather than with `transform-origin` — that is a CSS property,
           * not an SVG presentation attribute, so React rejects it here.
           */
          transform="translate(26 30) translate(340 430) scale(0.985) translate(-340 -430)"
        />

        <g clipPath={`url(#${id('clip')})`}>
          <path d={surface} fill={`url(#${id('body')})`} />
          <path d={surface} fill={`url(#${id('across')})`} />
          <ellipse
            cx="360"
            cy="180"
            rx="150"
            ry="160"
            fill={`url(#${id('warm')})`}
          />

          {/* Interior strands, thin and unscaled at any render size. */}
          <g
            fill="none"
            stroke={`url(#${id('strand')})`}
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          >
            {strands.map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
        </g>

        {/* The shaded edge: present, but only just. */}
        <path
          d={shadedEdge}
          fill="none"
          stroke="#9fd4e8"
          strokeOpacity="0.22"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />

        {/* The lit edge, twice: a soft bloom, then the hairline inside it. */}
        <path
          d={litEdge}
          fill="none"
          stroke={`url(#${id('rim')})`}
          strokeWidth="9"
          strokeLinecap="round"
          opacity="0.5"
          filter={`url(#${id('glow')})`}
        />
        <path
          d={litEdge}
          fill="none"
          stroke={`url(#${id('rim')})`}
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
