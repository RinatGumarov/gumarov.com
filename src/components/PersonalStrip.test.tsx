import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { readPreferredLocale } from '../lib/locale';
import { Footer } from './Footer';
import {
  PersonalStrip,
  type PersonalPhoto,
  type PersonalPhotos,
} from './PersonalStrip';

const neutralImage =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

const personalContent = {
  heading: 'Beyond the screen',
  body: 'Curiosity, craft, and focused energy carry beyond my frontend work. I drift a BMW E30 I partly built myself and keep small apps or technical experiments moving alongside it.',
  items: ['Surfing', 'Snowboarding', 'Skating', 'Motorcycles', 'Drifting'],
};

function placeholder(alt = ''): PersonalPhoto {
  return { src: neutralImage, width: 800, height: 600, alt };
}

/*
 * Exactly three frames — surf, snowboard, drift-front — and no portrait. The
 * page's one avatar belongs to the hero; the About section repeating it is the
 * duplication this composition removed.
 */
const photos: PersonalPhotos = [
  placeholder('Rinat riding the face of a breaking wave.'),
  placeholder('Rinat mid-air on a snowboard.'),
  placeholder('Rinat’s BMW E30 mid-drift on track, seen head-on.'),
];

const contact = {
  indexLabel: 'Contact',
  heading: 'Contact',
  body: 'Let’s talk.',
  telegramLabel: 'Telegram',
  telegramHref: 'https://t.me/RinatGumarov',
  telegramHandle: '@RinatGumarov',
  emailLabel: 'Email',
  emailHref: 'mailto:hi@gumarov.com',
  emailAddress: 'hi@gumarov.com',
};

describe('PersonalStrip', () => {
  it('keeps the personal story complete beside exactly three activity frames', () => {
    const { container } = render(
      <PersonalStrip content={personalContent} photos={photos} />,
    );

    const section = screen.getByRole('region', { name: 'Beyond the screen' });
    expect(within(section).getByText(personalContent.body)).toBeInTheDocument();

    const interests = within(section).getByRole('list');
    for (const interest of personalContent.items) {
      expect(within(interests).getByText(interest)).toBeInTheDocument();
    }
    expect(within(interests).getAllByRole('listitem')).toHaveLength(5);

    expect(container.querySelectorAll('figure')).toHaveLength(3);
    const images = container.querySelectorAll('figure img');
    expect(images).toHaveLength(3);

    for (const image of images) {
      expect(Number(image.getAttribute('width'))).toBeGreaterThan(0);
      expect(Number(image.getAttribute('height'))).toBeGreaterThan(0);
      expect(image).toHaveAttribute('loading', 'lazy');
      expect(image.getAttribute('alt')).not.toBe('');
    }
  });

  /*
   * The one avatar on the page is the hero's. This section must not render a
   * second one, and the check is on the DOM rather than on a CSS rule, because
   * a portrait hidden with `display: none` is still downloaded and still read
   * by a screen reader in some modes.
   */
  it('renders no portrait of its own', () => {
    const { container } = render(
      <PersonalStrip content={personalContent} photos={photos} />,
    );

    const sources = [...container.querySelectorAll('img, source')].flatMap(
      (element) => [
        element.getAttribute('src') ?? '',
        element.getAttribute('srcset') ?? '',
      ],
    );

    expect(sources.join(' ')).not.toMatch(/portrait/iu);
  });

  it('renders the three frames in content order', () => {
    const { container } = render(
      <PersonalStrip content={personalContent} photos={photos} />,
    );

    const alts = [...container.querySelectorAll('figure img')].map((image) =>
      image.getAttribute('alt'),
    );

    expect(alts).toEqual(photos.map((photo) => photo.alt));
  });

  it('marks only the failed photo frame while the story stays complete', () => {
    const { container } = render(
      <PersonalStrip content={personalContent} photos={photos} />,
    );
    const frames = [...container.querySelectorAll('figure')];
    expect(frames).toHaveLength(3);

    for (const frame of frames) {
      expect(frame).not.toHaveAttribute('data-image-state');
    }

    fireEvent.error(frames[0]?.querySelector('img') as HTMLImageElement);

    expect(frames[0]).toHaveAttribute('data-image-state', 'failed');
    for (const frame of frames.slice(1)) {
      expect(frame).not.toHaveAttribute('data-image-state');
    }
    expect(screen.getByText(personalContent.body)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Beyond the screen' }),
    ).toBeInTheDocument();

    fireEvent.error(frames[2]?.querySelector('img') as HTMLImageElement);
    expect(frames[2]).toHaveAttribute('data-image-state', 'failed');
    expect(frames[1]).not.toHaveAttribute('data-image-state');
  });

  it('offers AVIF and WebP responsive sources beside the JPEG fallback', () => {
    const surf: PersonalPhoto = {
      src: '/assets/personal/surf-768.jpg',
      srcSet: '/assets/personal/surf-480.jpg 480w',
      sources: {
        avif: '/assets/personal/surf-480.avif 480w',
        webp: '/assets/personal/surf-480.webp 480w',
      },
      sizes: '(min-width: 75em) 250px, 22vw',
      width: 768,
      height: 576,
      alt: 'Rinat riding the face of a breaking wave.',
    };

    const { container } = render(
      <PersonalStrip
        content={personalContent}
        photos={[surf, photos[1], photos[2]]}
      />,
    );

    const picture = container.querySelector('figure picture');
    expect(picture).not.toBeNull();
    expect(picture?.querySelector('source[type="image/avif"]')).toHaveAttribute(
      'srcset',
      '/assets/personal/surf-480.avif 480w',
    );
    expect(picture?.querySelector('source[type="image/webp"]')).toHaveAttribute(
      'srcset',
      '/assets/personal/surf-480.webp 480w',
    );

    const image = picture?.querySelector('img');
    expect(image).toHaveAttribute('src', '/assets/personal/surf-768.jpg');
    expect(image).toHaveAttribute('sizes', '(min-width: 75em) 250px, 22vw');
    expect(image).toHaveAttribute('loading', 'lazy');

    // A frame without responsive sources still renders a plain image inside
    // its picture element, so the markup shape never depends on the data.
    expect(container.querySelectorAll('figure picture')).toHaveLength(3);
    expect(container.querySelectorAll('figure img')).toHaveLength(3);
  });

  it('exposes localized alt text for every activity photo', () => {
    render(<PersonalStrip content={personalContent} photos={photos} />);

    for (const photo of photos) {
      expect(screen.getByRole('img', { name: photo.alt })).toBeInTheDocument();
    }
  });
});

describe('Footer', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, '', '/en/');
  });

  it('keeps year, privacy, locale, and direct contact paths available without JavaScript', () => {
    const privacy =
      'Analytics is cookieless, aggregate, and does not identify visitors.';
    render(<Footer locale="en" contact={contact} privacy={privacy} />);

    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveTextContent(String(new Date().getUTCFullYear()));
    expect(within(footer).getByText(privacy)).toBeInTheDocument();
    expect(
      within(footer).getByRole('link', {
        name: 'Telegram: @RinatGumarov',
      }),
    ).toHaveAttribute('href', 'https://t.me/RinatGumarov');
    expect(
      within(footer).getByRole('link', { name: 'Email: hi@gumarov.com' }),
    ).toHaveAttribute('href', 'mailto:hi@gumarov.com');
    expect(
      within(footer).getByRole('link', { name: 'English' }),
    ).toHaveAttribute('href', '/en/');
    expect(
      within(footer).getByRole('link', { name: 'Русский' }),
    ).toHaveAttribute('href', '/ru/');
  });

  it('persists an explicit footer locale and carries the current hash', async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, '', '/en/#contact');
    render(
      <Footer
        locale="en"
        contact={contact}
        privacy="Analytics is cookieless and aggregate."
      />,
    );
    const russianLink = screen.getByRole('link', { name: 'Русский' });
    russianLink.addEventListener('click', (event) => event.preventDefault());

    await user.click(russianLink);

    expect(readPreferredLocale()).toBe('ru');
    expect(russianLink).toHaveAttribute('href', '/ru/#contact');
  });
});
