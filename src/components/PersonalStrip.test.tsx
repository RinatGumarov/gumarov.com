import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import {
  PersonalStrip,
  type PersonalPhoto,
  type PersonalPhotos,
} from './PersonalStrip';

const content = {
  heading: 'Beyond the screen',
  body: 'Curiosity, craft, and focused energy carry beyond my frontend work.',
  items: ['Surfing', 'Snowboarding', 'Skating', 'Motorcycles', 'Drifting'],
};

function photo(slug: string, alt: string): PersonalPhoto {
  return {
    src: `/assets/personal/${slug}-768.jpg`,
    srcSet: `/assets/personal/${slug}-480.jpg 480w, /assets/personal/${slug}-768.jpg 768w`,
    sources: {
      avif: `/assets/personal/${slug}-480.avif 480w`,
      webp: `/assets/personal/${slug}-480.webp 480w`,
    },
    sizes: '22vw',
    width: 768,
    height: 576,
    alt,
  };
}

const photos: PersonalPhotos = [
  photo('surf', 'Rinat riding the face of a breaking wave.'),
  photo('snowboard', 'Rinat mid-air on a snowboard.'),
  photo('drift-front', 'Rinat’s BMW E30 mid-drift on track, seen head-on.'),
];

it('renders the story beside three described, lazily loaded frames', () => {
  const { container } = render(
    <PersonalStrip content={content} photos={photos} />,
  );

  const section = screen.getByRole('region', { name: content.heading });
  expect(within(section).getByText(content.body)).toBeInTheDocument();
  expect(within(section).getAllByRole('listitem')).toHaveLength(
    content.items.length,
  );

  const images = [...container.querySelectorAll('figure img')];
  expect(images.map((image) => image.getAttribute('alt'))).toEqual(
    photos.map((entry) => entry.alt),
  );
  for (const image of images) {
    expect(image).toHaveAttribute('loading', 'lazy');
    // Declared so each frame is reserved before the photo decodes, or fails to.
    expect(Number(image.getAttribute('width'))).toBeGreaterThan(0);
    expect(Number(image.getAttribute('height'))).toBeGreaterThan(0);
  }
});

it('marks only the failed frame and leaves the story complete', () => {
  const { container } = render(
    <PersonalStrip content={content} photos={photos} />,
  );
  const frames = [...container.querySelectorAll('figure')];

  fireEvent.error(frames[0]?.querySelector('img') as HTMLImageElement);

  expect(frames[0]).toHaveAttribute('data-image-state', 'failed');
  expect(frames[1]).not.toHaveAttribute('data-image-state');
  expect(screen.getByText(content.body)).toBeInTheDocument();
});
