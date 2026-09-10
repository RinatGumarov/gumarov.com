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

const placeholderPhotos: PersonalPhotos = [
  placeholder(),
  placeholder(),
  placeholder(),
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
  it('keeps the personal story complete beside exactly three semantic photo slots', () => {
    const { container } = render(
      <PersonalStrip content={personalContent} photos={placeholderPhotos} />,
    );

    const section = screen.getByRole('region', { name: 'Beyond the screen' });
    expect(within(section).getByText(personalContent.body)).toBeInTheDocument();

    const interests = within(section).getByRole('list');
    for (const interest of personalContent.items) {
      expect(within(interests).getByText(interest)).toBeInTheDocument();
    }

    expect(container.querySelectorAll('figure')).toHaveLength(3);
    const images = container.querySelectorAll('figure img');
    expect(images).toHaveLength(3);

    for (const image of images) {
      expect(Number(image.getAttribute('width'))).toBeGreaterThan(0);
      expect(Number(image.getAttribute('height'))).toBeGreaterThan(0);
      expect(Number.isFinite(Number(image.getAttribute('width')))).toBe(true);
      expect(Number.isFinite(Number(image.getAttribute('height')))).toBe(true);
      expect(image).toHaveAttribute('alt', '');
      fireEvent.error(image);
    }

    expect(within(section).getByText(personalContent.body)).toBeInTheDocument();
    expect(within(interests).getAllByRole('listitem')).toHaveLength(5);
  });

  it('marks only the failed photo frame while the story stays complete', () => {
    const { container } = render(
      <PersonalStrip content={personalContent} photos={placeholderPhotos} />,
    );
    const frames = [...container.querySelectorAll('figure')];

    for (const frame of frames) {
      expect(frame).not.toHaveAttribute('data-image-state');
    }

    const firstImage = frames[0]?.querySelector('img');
    fireEvent.error(firstImage as HTMLImageElement);

    expect(frames[0]).toHaveAttribute('data-image-state', 'failed');
    expect(frames[1]).not.toHaveAttribute('data-image-state');
    expect(frames[2]).not.toHaveAttribute('data-image-state');
    expect(screen.getByText(personalContent.body)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Beyond the screen' }),
    ).toBeInTheDocument();
  });

  it('offers AVIF and WebP responsive sources beside the JPEG fallback', () => {
    const photos: PersonalPhotos = [
      {
        src: '/assets/personal/surf-768.jpg',
        srcSet: '/assets/personal/surf-480.jpg 480w',
        sources: {
          avif: '/assets/personal/surf-480.avif 480w',
          webp: '/assets/personal/surf-480.webp 480w',
        },
        sizes: '(min-width: 60rem) 20rem, 45vw',
        width: 768,
        height: 576,
        alt: 'Rinat riding the face of a breaking wave.',
      },
      placeholder(),
      placeholder(),
    ];

    const { container } = render(
      <PersonalStrip content={personalContent} photos={photos} />,
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
    expect(image).toHaveAttribute('sizes', '(min-width: 60rem) 20rem, 45vw');
    expect(image).toHaveAttribute('loading', 'lazy');

    // Frames without responsive sources must still render a plain image.
    expect(container.querySelectorAll('figure picture')).toHaveLength(1);
    expect(container.querySelectorAll('figure img')).toHaveLength(3);
  });

  it('exposes localized alt text when a future photo adds information', () => {
    const photos: PersonalPhotos = [
      placeholder('Rinat working on the BMW E30 project'),
      placeholder(),
      placeholder(),
    ];

    render(<PersonalStrip content={personalContent} photos={photos} />);

    expect(
      screen.getByRole('img', {
        name: 'Rinat working on the BMW E30 project',
      }),
    ).toBeInTheDocument();
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
