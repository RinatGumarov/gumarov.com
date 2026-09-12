/**
 * The hero ribbon's optional WebGL layer.
 *
 * This module is imported dynamically and only after every gate in
 * `useHeroVisual` has passed, so its bytes are a separate chunk that a touch
 * device, a reduced-motion visitor or a browser without WebGL never downloads.
 * Nothing here is required for the hero to look finished: the SVG ribbon is the
 * shipped composition, and this draws the same object with real refraction over
 * the top of it.
 *
 * It owns no DOM beyond the canvas it is handed, holds no React state, and runs
 * frames only while something is actually moving — the entrance pass, or a
 * pointer position still easing towards its target. When both settle the loop
 * stops, and it restarts only on the next interaction.
 */

export interface RibbonRenderer {
  /** Pointer position in the host's box, normalized to -1..1. */
  setPointer(x: number, y: number): void;
  /** Called when the host resizes; re-reads the box and re-allocates. */
  resize(): void;
  /** Starts (or wakes) the frame loop. */
  wake(): void;
  /** Releases the GL context, listeners and any pending frame. */
  dispose(): void;
}

const vertexShaderSource = `
attribute vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

/*
 * The ribbon is evaluated analytically per fragment rather than rasterized from
 * geometry, so one full-screen triangle is the entire draw call.
 *
 * Crucially, it is the *same* ribbon as `HeroRibbon.tsx`: the same cubic
 * Bézier centreline, the same half-width function with the same twist, the same
 * `xMidYMid meet` mapping from the view box into the element. The two layers
 * therefore occupy identical pixels, and the crossfade between them changes the
 * material without moving the object. Keep these constants in step with the
 * component — they are one shape described twice, once for the DOM and once for
 * the GPU.
 *
 * `u` runs along the ribbon and `s` across it, with s = -1 on the lit edge and
 * s = +1 on the shaded one; everything else is a function of those two.
 *
 * The pointer does not appear in the geometry here. The tilt and shift live on
 * the `.stage` CSS transform, which this canvas is a child of, so applying them
 * again in the shader would double them; the pointer only moves the light.
 */
const fragmentShaderSource = `
precision highp float;

uniform vec2 uResolution;
uniform vec2 uPointer;
uniform float uEnter;

const vec2 VIEW_BOX = vec2(740.0, 780.0);
const vec2 P0 = vec2(150.0, 1070.0);
const vec2 P1 = vec2(320.0, 700.0);
const vec2 P2 = vec2(340.0, 120.0);
const vec2 P3 = vec2(670.0, -150.0);
const float MAX_HALF_WIDTH = 178.0;

vec2 bezier(float t) {
  float u = 1.0 - t;
  return u * u * u * P0 + 3.0 * u * u * t * P1 + 3.0 * u * t * t * P2
       + t * t * t * P3;
}

vec2 bezierSlope(float t) {
  float u = 1.0 - t;
  return 3.0 * u * u * (P1 - P0) + 6.0 * u * t * (P2 - P1)
       + 3.0 * t * t * (P3 - P2);
}

float halfWidthAt(float t) {
  float c = clamp(t, 0.0, 1.0);
  float perspective = 0.98 - 0.52 * c;
  float twist = 1.0 - 0.46 * exp(-pow((c - 0.54) / 0.155, 2.0));
  return MAX_HALF_WIDTH * perspective * twist;
}

/*
 * The centreline's y is strictly decreasing in t, so a bisection inverts it
 * without a solver. One projection step afterwards turns "the point at the same
 * height" into "the nearest point on the curve", which is what the offset has
 * to be measured from.
 */
float parameterAt(vec2 p) {
  float lo = 0.0;
  float hi = 1.0;
  for (int i = 0; i < 14; i++) {
    float mid = 0.5 * (lo + hi);
    if (bezier(mid).y > p.y) { lo = mid; } else { hi = mid; }
  }
  float t = 0.5 * (lo + hi);
  vec2 slope = bezierSlope(t);
  float speed = max(length(slope), 1.0);
  t += dot(p - bezier(t), slope / speed) / speed;
  return clamp(t, 0.0, 1.0);
}

/* The faint field the ribbon bends: almost invisible until it is refracted. */
float lineField(vec2 p) {
  float a = abs(fract(dot(p, vec2(0.93, 0.37)) * 0.052) - 0.5);
  float b = abs(fract(dot(p, vec2(-0.31, 0.95)) * 0.034) - 0.5);
  return (1.0 - smoothstep(0.0, 0.07, a)) * 0.7
       + (1.0 - smoothstep(0.0, 0.05, b)) * 0.3;
}

void main() {
  // The same "meet" fit the SVG uses: uniform scale, centred, y flipped.
  float scale = min(uResolution.x / VIEW_BOX.x, uResolution.y / VIEW_BOX.y);
  vec2 origin = (uResolution - VIEW_BOX * scale) * 0.5;
  vec2 p = (gl_FragCoord.xy - origin) / scale;
  p.y = VIEW_BOX.y - p.y;

  float t = parameterAt(p);
  vec2 centre = bezier(t);
  vec2 slope = bezierSlope(t);
  float speed = max(length(slope), 1.0);
  vec2 normal = vec2(slope.y, -slope.x) / speed;
  float halfWidth = halfWidthAt(t);
  float s = dot(p - centre, normal) / max(halfWidth, 0.001);

  float inside = 1.0 - smoothstep(0.84, 1.0, abs(s));
  // The same end fade as the SVG's mask, in the same view-box units.
  float ends = smoothstep(0.0, 0.07 * VIEW_BOX.y, p.y)
             * (1.0 - smoothstep(0.78 * VIEW_BOX.y, VIEW_BOX.y, p.y));
  inside *= ends;

  float thickness = sqrt(max(0.0, 1.0 - s * s));

  // Refraction: the surface pushes the background sample sideways, hardest
  // where the surface is steepest rather than where it is thickest.
  float bend = s * thickness * halfWidth * 0.42;
  float fieldR = lineField(p + normal * bend * 1.06);
  float fieldG = lineField(p + normal * bend);
  float fieldB = lineField(p + normal * bend * 0.94);
  vec3 refracted = vec3(fieldR, fieldG, fieldB);

  // Interior strands, on the surface at constant s, matching the SVG's nine.
  float strandPhase = abs(fract(s * 4.5 + 0.5) - 0.5);
  float strands = (1.0 - smoothstep(0.0, 0.045, strandPhase)) * 0.42;

  float litRim = exp(-pow((s + 1.0) / 0.07, 2.0));
  float shadedRim = exp(-pow((s - 1.0) / 0.12, 2.0)) * 0.2;

  // The specular the pointer carries along the band.
  float lightT = 0.5 - uPointer.y * 0.2;
  float lightS = -0.3 + uPointer.x * 0.5;
  float specular = exp(-pow((t - lightT) / 0.19, 2.0))
                 * exp(-pow((s - lightS) / 0.5, 2.0));

  vec3 glass = mix(vec3(0.08, 0.42, 0.58), vec3(0.68, 0.92, 1.0), thickness * 0.85);
  vec3 colour = vec3(0.0);
  colour += glass * inside * (0.05 + 0.12 * thickness);
  colour += refracted * inside * 0.2 * (0.3 + 0.7 * thickness);
  colour += vec3(0.72, 0.94, 1.0) * strands * inside * 0.3;
  colour += vec3(0.88, 0.98, 1.0) * litRim * ends * 0.9;
  colour += vec3(0.58, 0.84, 1.0) * shadedRim * ends;
  colour += vec3(0.82, 0.96, 1.0) * specular * inside * 0.5;
  // One warm reflection, high on the band where the surface turns over.
  colour += vec3(0.91, 0.68, 0.40) * inside * specular * 0.3
          * smoothstep(0.5, 0.95, t);

  // The arrival: a light pass up the band as the layer fades in, then gone.
  float sweep = exp(-pow((t - (uEnter * 1.6 - 0.3)) / 0.15, 2.0));
  colour += vec3(0.85, 0.97, 1.0) * sweep * inside * (1.0 - uEnter) * 0.7;

  float alpha = clamp(
    inside * (0.26 + 0.4 * thickness)
      + litRim * ends * 0.9
      + shadedRim * ends,
    0.0,
    1.0
  );

  gl_FragColor = vec4(colour * alpha, alpha);
}
`;

function compile(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

const maximumDevicePixelRatio = 1.5;
const entranceDurationMs = 900;
const pointerTimeConstantMs = 110;
const settleEpsilon = 0.002;
const maximumFrameDeltaMs = 32;

/**
 * Builds the renderer, or returns `null` when this browser cannot run it —
 * no context, a failed compile, a refused program link. A `null` return is a
 * normal outcome, not an error: the caller simply keeps the SVG.
 */
export function createRibbonRenderer(
  canvas: HTMLCanvasElement,
  onReady: () => void,
  onLost: () => void,
): RibbonRenderer | null {
  let gl: WebGLRenderingContext | null = null;
  try {
    gl =
      (canvas.getContext('webgl', {
        alpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: true,
        powerPreference: 'low-power',
        failIfMajorPerformanceCaveat: true,
      }) as WebGLRenderingContext | null) ?? null;
  } catch {
    gl = null;
  }
  if (!gl) return null;

  const context = gl;
  const vertexShader = compile(
    context,
    context.VERTEX_SHADER,
    vertexShaderSource,
  );
  const fragmentShader = compile(
    context,
    context.FRAGMENT_SHADER,
    fragmentShaderSource,
  );
  if (!vertexShader || !fragmentShader) return null;

  const program = context.createProgram();
  if (!program) return null;
  context.attachShader(program, vertexShader);
  context.attachShader(program, fragmentShader);
  context.linkProgram(program);
  if (!context.getProgramParameter(program, context.LINK_STATUS)) {
    context.deleteProgram(program);
    return null;
  }

  context.useProgram(program);

  const buffer = context.createBuffer();
  context.bindBuffer(context.ARRAY_BUFFER, buffer);
  // One oversized triangle rather than two: fewer vertices, no seam.
  context.bufferData(
    context.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    context.STATIC_DRAW,
  );
  const positionLocation = context.getAttribLocation(program, 'aPosition');
  context.enableVertexAttribArray(positionLocation);
  context.vertexAttribPointer(positionLocation, 2, context.FLOAT, false, 0, 0);

  const resolutionLocation = context.getUniformLocation(program, 'uResolution');
  const pointerLocation = context.getUniformLocation(program, 'uPointer');
  const enterLocation = context.getUniformLocation(program, 'uEnter');

  context.disable(context.DEPTH_TEST);
  context.enable(context.BLEND);
  context.blendFunc(context.ONE, context.ONE_MINUS_SRC_ALPHA);
  context.clearColor(0, 0, 0, 0);

  let disposed = false;
  let frame = 0;
  let lastTimestamp: number | null = null;
  let entranceElapsed = 0;
  let currentX = 0;
  let currentY = 0;
  let targetX = 0;
  let targetY = 0;
  let announced = false;

  const applyViewport = () => {
    const ratio = Math.min(
      maximumDevicePixelRatio,
      typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1,
    );
    const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
    const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    context.viewport(0, 0, canvas.width, canvas.height);
    context.uniform2f(resolutionLocation, canvas.width, canvas.height);
  };

  const draw = () => {
    context.uniform2f(pointerLocation, currentX, currentY);
    context.uniform1f(
      enterLocation,
      Math.min(1, entranceElapsed / entranceDurationMs),
    );
    context.clear(context.COLOR_BUFFER_BIT);
    context.drawArrays(context.TRIANGLES, 0, 3);

    if (!announced) {
      announced = true;
      onReady();
    }
  };

  const settled = () =>
    entranceElapsed >= entranceDurationMs &&
    Math.abs(targetX - currentX) < settleEpsilon &&
    Math.abs(targetY - currentY) < settleEpsilon;

  const step = (timestamp: number) => {
    frame = 0;
    if (disposed) return;

    const delta = Math.min(
      maximumFrameDeltaMs,
      Math.max(0, timestamp - (lastTimestamp ?? timestamp)),
    );
    lastTimestamp = timestamp;

    if (entranceElapsed < entranceDurationMs) {
      entranceElapsed = Math.min(entranceDurationMs, entranceElapsed + delta);
    }

    // A time constant, not a per-frame fraction, so the ease takes the same
    // wall-clock time on a 60 Hz and a 120 Hz display.
    const alpha = 1 - Math.exp(-delta / pointerTimeConstantMs);
    currentX += (targetX - currentX) * alpha;
    currentY += (targetY - currentY) * alpha;

    if (settled()) {
      currentX = targetX;
      currentY = targetY;
      lastTimestamp = null;
      draw();
      return;
    }

    draw();
    frame = window.requestAnimationFrame(step);
  };

  const wake = () => {
    if (disposed || frame || settled()) return;
    if (lastTimestamp === null) lastTimestamp = performance.now();
    frame = window.requestAnimationFrame(step);
  };

  const handleContextLost = (event: Event) => {
    event.preventDefault();
    if (frame) {
      window.cancelAnimationFrame(frame);
      frame = 0;
    }
    onLost();
  };

  canvas.addEventListener('webglcontextlost', handleContextLost);

  applyViewport();
  // Paint one frame immediately, so the layer never fades in over nothing.
  draw();
  wake();

  return {
    setPointer(x, y) {
      targetX = Math.max(-1, Math.min(1, x));
      targetY = Math.max(-1, Math.min(1, y));
      wake();
    },
    resize() {
      if (disposed) return;
      applyViewport();
      draw();
      wake();
    },
    wake,
    dispose() {
      if (disposed) return;
      disposed = true;
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      if (frame) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      }
      context.deleteBuffer(buffer);
      context.deleteProgram(program);
      context.deleteShader(vertexShader);
      context.deleteShader(fragmentShader);
      // Free the drawing buffer rather than waiting for the canvas to be
      // collected; browsers cap how many live contexts a document may hold.
      context.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
