import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  const { container } = render(<Hero content={getContent('en').hero} />);

  expect(
    screen.getByRole('heading', {
      level: 1,
      name: 'Senior Frontend Engineer building ambitious products.',
    }),
  ).toBeInTheDocument();
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
  const responsiveSizes =
    '(max-width: 46rem) min(100vw - 4rem, 28rem), (max-width: 64rem) 38vw, 30vw';

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
});

it('keeps the internal hero contact jump out of channel click analytics', async () => {
  const user = userEvent.setup();
  render(<Hero content={getContent('en').hero} />);
  const contactJump = screen.getByRole('link', { name: 'Get in touch' });
  contactJump.addEventListener('click', (event) => event.preventDefault());

  await user.click(contactJump);

  expect(contactJump).toHaveAttribute('href', '#contact');
  expect(trackAnalyticsEventMock).not.toHaveBeenCalled();
});
