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

// Plan §3.7: surf is the lead frame, portrait sits beside the body copy, and
// the five activity photos follow in this exact order in both the data and
// the DOM — drift-front, skate, snowboard, powder, drift-rear.
const leadPhoto: PersonalPhoto = placeholder(
  'Rinat riding the face of a breaking wave.',
);
const portraitPhoto: PersonalPhoto = placeholder('Rinat Gumarov');
const activityPhotos: PersonalPhotos = [
  placeholder('BMW E30 in a drift, front view.'),
  placeholder('Rinat at a skatepark at night.'),
  placeholder('Rinat catching air on a snowboard.'),
  placeholder('Rinat riding powder between snow-covered trees.'),
  placeholder('BMW E30 in a drift, smoke coming off the rear wheels.'),
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
  it('keeps the personal story complete beside the lead frame, portrait, and five activity photos', () => {
    const { container } = render(
      <PersonalStrip
        content={personalContent}
        lead={leadPhoto}
        portrait={portraitPhoto}
        activity={activityPhotos}
      />,
    );

    const section = screen.getByRole('region', { name: 'Beyond the screen' });
    expect(within(section).getByText(personalContent.body)).toBeInTheDocument();

    const interests = within(section).getByRole('list');
    for (const interest of personalContent.items) {
      expect(within(interests).getByText(interest)).toBeInTheDocument();
    }
    expect(within(interests).getAllByRole('listitem')).toHaveLength(5);

    // Lead + portrait + five activity photos, every one a real figure.
    expect(container.querySelectorAll('figure')).toHaveLength(7);
    const images = container.querySelectorAll('figure img');
    expect(images).toHaveLength(7);

    for (const image of images) {
      expect(Number(image.getAttribute('width'))).toBeGreaterThan(0);
      expect(Number(image.getAttribute('height'))).toBeGreaterThan(0);
      expect(Number.isFinite(Number(image.getAttribute('width')))).toBe(true);
      expect(Number.isFinite(Number(image.getAttribute('height')))).toBe(true);
      expect(image).toHaveAttribute('loading', 'lazy');
      expect(image.getAttribute('alt')).not.toBe('');
    }
  });

  it('renders every photo and the portrait in the plan §3.7 order: lead, portrait, then drift-front, skate, snowboard, powder, drift-rear', () => {
    const { container } = render(
      <PersonalStrip
        content={personalContent}
        lead={leadPhoto}
        portrait={portraitPhoto}
        activity={activityPhotos}
      />,
    );

    const alts = [...container.querySelectorAll('figure img')].map((image) =>
      image.getAttribute('alt'),
    );

    expect(alts).toEqual([
      leadPhoto.alt,
      portraitPhoto.alt,
      activityPhotos[0]?.alt,
      activityPhotos[1]?.alt,
      activityPhotos[2]?.alt,
      activityPhotos[3]?.alt,
      activityPhotos[4]?.alt,
    ]);
  });

  it('marks only the failed photo frame while the story stays complete', () => {
    const { container } = render(
      <PersonalStrip
        content={personalContent}
        lead={leadPhoto}
        portrait={portraitPhoto}
        activity={activityPhotos}
      />,
    );
    const frames = [...container.querySelectorAll('figure')];
    expect(frames).toHaveLength(7);

    for (const frame of frames) {
      expect(frame).not.toHaveAttribute('data-image-state');
    }

    const leadImage = frames[0]?.querySelector('img');
    fireEvent.error(leadImage as HTMLImageElement);

    expect(frames[0]).toHaveAttribute('data-image-state', 'failed');
    for (const frame of frames.slice(1)) {
      expect(frame).not.toHaveAttribute('data-image-state');
    }
    expect(screen.getByText(personalContent.body)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Beyond the screen' }),
    ).toBeInTheDocument();

    // A different frame's failure marks only that frame, not the whole story.
    const lastActivityImage = frames[6]?.querySelector('img');
    fireEvent.error(lastActivityImage as HTMLImageElement);
    expect(frames[6]).toHaveAttribute('data-image-state', 'failed');
    expect(frames[1]).not.toHaveAttribute('data-image-state');
  });

  it('offers AVIF and WebP responsive sources beside the JPEG fallback', () => {
    const lead: PersonalPhoto = {
      src: '/assets/personal/surf-768.jpg',
      srcSet: '/assets/personal/surf-480.jpg 480w',
      sources: {
        avif: '/assets/personal/surf-480.avif 480w',
        webp: '/assets/personal/surf-480.webp 480w',
      },
      sizes: '(min-width: 60rem) 1184px, 100vw',
      width: 768,
      height: 576,
      alt: 'Rinat riding the face of a breaking wave.',
    };

    const { container } = render(
      <PersonalStrip
        content={personalContent}
        lead={lead}
        portrait={portraitPhoto}
        activity={activityPhotos}
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
    expect(image).toHaveAttribute('sizes', '(min-width: 60rem) 1184px, 100vw');
    expect(image).toHaveAttribute('loading', 'lazy');

    // Frames without responsive sources (the placeholder portrait/activity
    // photos here) still render a plain image.
    expect(container.querySelectorAll('figure picture')).toHaveLength(1);
    expect(container.querySelectorAll('figure img')).toHaveLength(7);
  });

  it('exposes localized alt text for the portrait and every activity photo', () => {
    render(
      <PersonalStrip
        content={personalContent}
        lead={leadPhoto}
        portrait={portraitPhoto}
        activity={activityPhotos}
      />,
    );

    expect(
      screen.getByRole('img', { name: portraitPhoto.alt }),
    ).toBeInTheDocument();
    for (const photo of activityPhotos) {
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
