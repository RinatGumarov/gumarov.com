import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';
import { en } from '../content/en';
import { SelectedWork } from './SelectedWork';

const { observeProjectViewOnceMock } = vi.hoisted(() => ({
  observeProjectViewOnceMock: vi.fn(() => vi.fn()),
}));

vi.mock('../lib/analytics', () => ({
  observeProjectViewOnce: observeProjectViewOnceMock,
}));

const expectedProjects = [
  {
    name: 'TradingView',
    slug: 'tradingview',
    href: 'https://www.tradingview.com/',
    contribution:
      'I work on Pine Editor and Strategy Tester: code editing, version history, and interfaces for analysing trading strategies.',
    capabilities: 'Complex frontend systems · Performance-sensitive interfaces',
    linkLabel: 'Visit TradingView',
    media: 'screenshot',
  },
  {
    name: 'Stoic',
    slug: 'stoic',
    href: 'https://stoic.ai/',
    contribution:
      'Primary frontend engineer who built the React, TypeScript, and Next.js application from scratch.',
    capabilities: 'React · TypeScript · Next.js',
    linkLabel: 'Visit Stoic',
    media: 'text',
  },
  {
    name: 'Splithub',
    slug: 'splithub',
    href: 'https://splithub.app/',
    contribution:
      'Took the product through the full development cycle: from idea and UX to the SwiftUI app, backend, and App Store launch.',
    capabilities: 'UX · SwiftUI · Backend · Launch',
    linkLabel: 'Visit Splithub',
    media: 'screenshot',
  },
  {
    name: 'Evercity',
    slug: 'evercity',
    href: 'https://evercity.io/',
    contribution:
      'Contributed frontend work on a sustainable-finance platform.',
    capabilities: 'Frontend · Sustainable finance',
    linkLabel: 'Visit Evercity',
    media: 'text',
  },
] as const;

describe('selected work', () => {
  beforeEach(() => observeProjectViewOnceMock.mockClear());

  const renderSelectedWork = () =>
    render(
      <SelectedWork
        heading={en.projectsHeading}
        projects={en.projects}
        screenshots={en.projectScreenshots}
        locale="en"
      />,
    );

  it('renders each approved project mapping and narrative independently', () => {
    renderSelectedWork();

    const section = screen.getByRole('region', { name: 'Selected work' });
    const scenes = within(section).getAllByRole('article');

    expect(scenes).toHaveLength(4);
    for (const [index, project] of expectedProjects.entries()) {
      const scene = scenes.at(index);

      expect(scene).toBeDefined();
      if (!scene) throw new Error(`Missing project scene ${index + 1}`);

      expect(scene).toHaveAttribute('data-project-slug', project.slug);
      expect(
        within(scene).getByRole('heading', {
          level: 3,
          name: project.name,
        }),
      ).toBeInTheDocument();
      expect(within(scene).getByText(project.contribution)).toBeVisible();
      expect(within(scene).getByText(project.capabilities)).toBeVisible();

      const link = within(scene).getByRole('link', { name: project.name });

      expect(link).toHaveAttribute('href', project.href);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });

  /*
   * Two captures, and nothing standing in for the other two. A text case must
   * render no image, no figure, no reserved frame and no decorative substitute
   * — removing a screenshot has to remove a picture, not swap it for another
   * one.
   */
  it('frames a capture only for the two screenshot projects', () => {
    renderSelectedWork();

    for (const project of expectedProjects) {
      const scene = screen.getByRole('article', { name: project.name });
      const shot = en.projectScreenshots.find(
        (entry) => entry.slug === project.slug,
      );

      expect(scene).toHaveAttribute('data-project-media', project.media);

      if (project.media === 'screenshot') {
        expect(shot).toBeDefined();
        if (!shot) throw new Error(`Missing screenshot for ${project.slug}`);

        const image = within(scene).getByRole('img', { name: shot.alt });
        expect(image.tagName).toBe('IMG');
        expect(image.closest('[data-visual-kind]')).toHaveAttribute(
          'data-visual-kind',
          'product-screenshot',
        );
        expect(within(scene).getByText(shot.caption)).toBeVisible();
        continue;
      }

      expect(shot).toBeUndefined();
      expect(within(scene).queryAllByRole('img')).toHaveLength(0);
      expect(scene.querySelectorAll('img, picture, svg, canvas')).toHaveLength(
        0,
      );
      expect(scene.querySelectorAll('figure')).toHaveLength(0);
      // No frame, no plate, no geometry layers left holding the space.
      expect(scene.querySelectorAll('[data-visual-kind]')).toHaveLength(0);
      expect(scene.querySelectorAll('[data-geometry-layer]')).toHaveLength(0);
    }
  });

  it('points each capture at its own approved derivative', () => {
    renderSelectedWork();

    const tradingView = screen.getByRole('article', { name: 'TradingView' });
    const tradingViewImage = within(tradingView).getByRole('img');
    expect(tradingViewImage).toHaveAttribute(
      'src',
      '/assets/projects/tradingview-960.jpg',
    );
    expect(tradingViewImage).toHaveAttribute('width', '1440');
    expect(tradingViewImage).toHaveAttribute('height', '720');

    // Splithub shows the application, cropped out of the approved capture —
    // not the landing composite the crop was taken from.
    const splithub = screen.getByRole('article', { name: 'Splithub' });
    const splithubImage = within(splithub).getByRole('img');
    expect(splithubImage).toHaveAttribute(
      'src',
      '/assets/projects/splithub-app-624.jpg',
    );
    expect(splithubImage).toHaveAttribute('width', '624');
    expect(splithubImage).toHaveAttribute('height', '624');
    expect(splithubImage.getAttribute('srcset')).toContain(
      '/assets/projects/splithub-app-312.jpg 312w',
    );
  });

  it('registers each real project scene for locale-aware 50% view tracking', () => {
    renderSelectedWork();

    expect(observeProjectViewOnceMock).toHaveBeenCalledTimes(4);
    for (const project of expectedProjects) {
      expect(observeProjectViewOnceMock).toHaveBeenCalledWith(
        expect.objectContaining({
          dataset: expect.objectContaining({ projectSlug: project.slug }),
        }),
        {
          name: 'project_viewed',
          properties: { slug: project.slug, locale: 'en' },
        },
      );
    }
  });

  it('names every outbound destination and points it at that product', () => {
    renderSelectedWork();

    for (const project of expectedProjects) {
      const scene = screen.getByRole('article', { name: project.name });
      const namedLink = within(scene).getByRole('link', {
        name: project.linkLabel,
      });

      expect(namedLink).toHaveAttribute('href', project.href);
      expect(namedLink).toHaveAttribute('target', '_blank');
      expect(namedLink).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });

  it('backs the lead case with its three proof blocks and leaves the rest without', () => {
    renderSelectedWork();

    const lead = screen.getByRole('article', { name: 'TradingView' });
    const proofs = en.projects.find(
      (project) => project.slug === 'tradingview',
    )?.proofs;

    expect(proofs).toHaveLength(3);
    for (const proof of proofs ?? []) {
      expect(
        within(lead).getByRole('heading', { level: 4, name: proof.title }),
      ).toBeVisible();
      expect(within(lead).getByText(proof.body)).toBeVisible();
    }

    for (const project of expectedProjects.slice(1)) {
      const scene = screen.getByRole('article', { name: project.name });
      expect(
        within(scene).queryAllByRole('heading', { level: 4 }),
      ).toHaveLength(0);
    }
  });

  it('shows one headline Splithub metric with the shipped state beside it', () => {
    renderSelectedWork();

    const scene = screen.getByRole('article', { name: 'Splithub' });
    const metrics = scene.querySelector('dl');

    expect(metrics).not.toBeNull();
    expect(
      [...(metrics?.querySelectorAll('dt, dd') ?? [])].map((node) =>
        node.textContent?.trim(),
      ),
    ).toEqual(['350', 'registered users']);
    // A subordinate mark, deliberately not a second statistic in the list.
    expect(within(scene).getByText('On the App Store')).toBeVisible();
    expect(
      within(scene).queryByText(/daily active users/iu),
    ).not.toBeInTheDocument();
  });

  it('closes the section with a compact text row and no reserved visual', () => {
    renderSelectedWork();

    const compact = screen.getByRole('article', { name: 'Evercity' });

    expect(compact.querySelectorAll('figure')).toHaveLength(0);
    expect(compact.querySelectorAll('img, picture, svg')).toHaveLength(0);
    expect(
      within(compact).getByRole('link', { name: 'Visit Evercity' }),
    ).toBeVisible();

    // The two captured scenes still frame their capture in a figure.
    for (const slug of ['TradingView', 'Splithub']) {
      const scene = screen.getByRole('article', { name: slug });
      expect(scene.querySelectorAll('figure')).toHaveLength(1);
    }
  });

  it('keeps the name, description, and link readable when a capture fails', () => {
    renderSelectedWork();

    const scene = screen.getByRole('article', { name: 'Splithub' });
    const image = within(scene).getByRole('img');

    fireEvent.error(image);

    expect(
      within(scene).getByRole('heading', { level: 3, name: 'Splithub' }),
    ).toBeVisible();
    expect(
      within(scene).getByText('An iOS app for sharing expenses.'),
    ).toBeVisible();
    const namedLink = within(scene).getByRole('link', {
      name: 'Visit Splithub',
    });
    expect(namedLink).toBeVisible();
    expect(namedLink).toHaveAttribute('href', 'https://splithub.app/');
    // The plate goes with the capture rather than staying as an empty frame,
    // and the caption goes with it because it described the picture.
    expect(within(scene).queryAllByRole('img')).toHaveLength(0);
    expect(
      within(scene).queryByText('Splithub on iOS'),
    ).not.toBeInTheDocument();
    expect(scene.querySelectorAll('[data-geometry-layer]')).toHaveLength(0);
  });
});
