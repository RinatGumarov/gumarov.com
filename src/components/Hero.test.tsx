import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it, vi } from 'vitest';
import { getContent } from '../content';
import { Hero } from './Hero';

const { trackAnalyticsEventMock } = vi.hoisted(() => ({
  trackAnalyticsEventMock: vi.fn(),
}));

vi.mock('../lib/analytics', () => ({
  trackAnalyticsEvent: trackAnalyticsEventMock,
}));

it('presents the localized frontend-first hero with direct conversion links', () => {
  const { container } = render(
    <Hero content={getContent('en').hero} motionEnabled={false} />,
  );

  expect(
    screen.getByRole('heading', {
      level: 1,
      name: 'Complex interfaces. Effortless interactions.',
    }),
  ).toBeInTheDocument();
  expect(screen.getByText('Rinat Gumarov')).toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: 'View selected work' }),
  ).toHaveAttribute('href', '#work');
  expect(screen.getByRole('link', { name: 'Get in touch' })).toHaveAttribute(
    'href',
    '#contact',
  );
  const picture = container.querySelector('[data-hero="landing"] picture');
  const image = picture?.querySelector('img');
  const sources = picture?.querySelectorAll('source');
  // The portrait is a fixed 56x70 avatar beside the name at every
  // breakpoint (plan §3.2), so it always requests the smallest candidate.
  const responsiveSizes = '56px';

  expect(sources).toHaveLength(2);
  expect(sources?.[0]).toHaveAttribute('type', 'image/avif');
  expect(sources?.[0]).toHaveAttribute(
    'srcset',
    '/assets/portrait/portrait-480.avif 480w, /assets/portrait/portrait-768.avif 768w, /assets/portrait/portrait-1024.avif 1024w',
  );
  expect(sources?.[0]).toHaveAttribute('sizes', responsiveSizes);
  expect(sources?.[1]).toHaveAttribute('type', 'image/webp');
  expect(sources?.[1]).toHaveAttribute(
    'srcset',
    '/assets/portrait/portrait-480.webp 480w, /assets/portrait/portrait-768.webp 768w, /assets/portrait/portrait-1024.webp 1024w',
  );
  expect(sources?.[1]).toHaveAttribute('sizes', responsiveSizes);
  expect(image).toHaveAttribute('src', '/assets/portrait/portrait-768.jpg');
  expect(image).toHaveAttribute(
    'srcset',
    '/assets/portrait/portrait-480.jpg 480w, /assets/portrait/portrait-768.jpg 768w, /assets/portrait/portrait-1024.jpg 1024w',
  );
  expect(image).toHaveAttribute('sizes', responsiveSizes);
  expect(image).toHaveAttribute('width', '768');
  expect(image).toHaveAttribute('height', '960');
  expect(image).toHaveAttribute('alt', '');
  expect(image).toHaveAttribute('loading', 'eager');
  expect(image).toHaveAttribute('fetchpriority', 'high');

  // The two title phrases are structural lines, not a `<br>` inside a string.
  const heading = screen.getByRole('heading', { level: 1 });
  expect(heading.querySelectorAll('br')).toHaveLength(0);
  expect(heading.children).toHaveLength(2);
  expect(heading.children[0]).toHaveTextContent('Complex interfaces.');
  expect(heading.children[1]).toHaveTextContent('Effortless interactions.');
});

it('keeps the blueprint decoration out of the accessibility tree and out of the way', () => {
  const { container } = render(
    <Hero content={getContent('en').hero} motionEnabled={false} />,
  );
  const hero = container.querySelector('[data-hero="landing"]');
  const blueprints = container.querySelectorAll('[data-hero-blueprint]');

  // The resting drawing and the cyan copy the lens reveals.
  expect(blueprints).toHaveLength(2);
  expect(blueprints[0]).toHaveAttribute('data-hero-blueprint', 'base');
  expect(blueprints[1]).toHaveAttribute('data-hero-blueprint', 'lens');

  for (const blueprint of blueprints) {
    // Decorative: never announced, never focusable, never a heading.
    expect(blueprint).toHaveAttribute('aria-hidden', 'true');
    expect(blueprint).toHaveAttribute('focusable', 'false');
    expect(blueprint.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(blueprint.querySelector('title')).toBeNull();
    expect(blueprint.querySelector('[tabindex]')).toBeNull();
  }

  // The decoration is painted first so the copy sits above it.
  expect(hero?.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  expect(hero?.firstElementChild).toContainElement(
    blueprints[0] as HTMLElement,
  );
  // No hook ran, so nothing wrote a lens position onto the host.
  expect((hero as HTMLElement).style.getPropertyValue('--lens-opacity')).toBe(
    '',
  );
});

it('drives exactly one pointer effect in the hero', () => {
  const { container } = render(
    <Hero content={getContent('en').hero} motionEnabled={false} />,
  );
  const hero = container.querySelector('[data-hero="landing"]');

  // Plan §5: the lens is the hero's only pointer-driven motion, so a hero
  // parallax must not be summed on top of it. The attributes below are what
  // the shared parallax layer in motion.css keys off.
  expect(hero?.querySelectorAll('[data-motion-parallax]')).toHaveLength(0);
  expect(hero?.querySelectorAll('[data-motion-parallax-layer]')).toHaveLength(
    0,
  );
});

it('hides the decoration from pointers and keeps the lens layer mask-driven', async () => {
  const css = await readFile(
    path.join(path.dirname(fileURLToPath(import.meta.url)), 'Hero.module.css'),
    'utf8',
  );
  const decor = css.match(/\.decor \{([\s\S]*?)\n\}/u)?.[1] ?? '';
  const lens = css.match(/\.decorLens \{([\s\S]*?)\n\}/u)?.[1] ?? '';

  expect(decor).toMatch(/pointer-events:\s*none/u);
  // The drawing must never widen the page.
  expect(decor).toMatch(/overflow:\s*clip/u);
  // The reveal is a mask over the same drawing, not a glowing circle.
  expect(lens).toMatch(/mask-image:\s*radial-gradient/u);
  expect(lens).toMatch(/var\(--lens-x/u);
  expect(lens).toMatch(/var\(--lens-y/u);
  expect(lens).toMatch(/opacity:\s*var\(--lens-opacity, 0\)/u);
  // The system cursor is never hidden or replaced.
  expect(css).not.toMatch(/cursor:\s*none/u);
});

/*
 * The heading used to hard-code `ui-sans-serif, system-ui` so it could never
 * wait on Onest, which also meant it could never *become* Onest (plan §7). It
 * now uses `--font-display`, and the guarantee moved to where it belongs: the
 * token's first-paint value. `tokens.css` is what gets inlined into the
 * document, so as long as it names no webfont the LCP heading still paints in
 * a system font; `scripts/check-dist.mjs` fails the build on any inlined CSS
 * that mentions Onest, and on any font preload, so this is checked against the
 * built output too.
 */
it('paints the page heading with a system font so LCP does not wait for Onest', async () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const css = await readFile(path.join(here, 'Hero.module.css'), 'utf8');
  const tokens = await readFile(
    path.join(here, '..', 'styles', 'tokens.css'),
    'utf8',
  );
  const declarations = css.replace(/\/\*[\s\S]*?\*\//gu, '');
  const title = declarations.match(/\.title \{([\s\S]*?)\n\}/u)?.[1] ?? '';
  const firstPaintDisplay =
    tokens.match(/--font-display:\s*([^;]*);/u)?.[1] ?? '';

  expect(title).toMatch(/font-family:\s*var\(--font-display\)/u);
  expect(firstPaintDisplay).toMatch(/(?:ui-sans-serif|system-ui)/u);
  expect(firstPaintDisplay).not.toMatch(/Onest/iu);
  // And nothing in the hero's own stylesheet may name a webfont directly,
  // which would put it on the critical path whatever the token says.
  expect(declarations).not.toMatch(/Onest/iu);
});

it('reveals the portrait container when the image fails and keeps the copy', () => {
  const { container } = render(
    <Hero content={getContent('en').hero} motionEnabled={false} />,
  );
  const picture = container.querySelector('[data-hero="landing"] picture');
  const image = picture?.querySelector('img');

  expect(picture).not.toHaveAttribute('data-image-state');
  fireEvent.error(image as HTMLImageElement);

  expect(picture).toHaveAttribute('data-image-state', 'failed');
  expect(
    screen.getByRole('heading', {
      level: 1,
      name: 'Complex interfaces. Effortless interactions.',
    }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: 'View selected work' }),
  ).toBeInTheDocument();
  // The name beside the portrait already carries identity, so a failed
  // image leaves the framed (now empty) container and the copy in place
  // rather than needing a text fallback of its own.
  expect(screen.getByText('Rinat Gumarov')).toBeInTheDocument();
});

it('keeps the internal hero contact jump out of channel click analytics', async () => {
  const user = userEvent.setup();
  render(<Hero content={getContent('en').hero} motionEnabled={false} />);
  const contactJump = screen.getByRole('link', { name: 'Get in touch' });
  contactJump.addEventListener('click', (event) => event.preventDefault());

  await user.click(contactJump);

  expect(contactJump).toHaveAttribute('href', '#contact');
  expect(trackAnalyticsEventMock).not.toHaveBeenCalled();
});
