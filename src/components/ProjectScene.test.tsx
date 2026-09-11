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
    visualName: 'TradingView: Trading interfaces',
    linkLabel: 'Visit TradingView',
  },
  {
    name: 'Stoic',
    slug: 'stoic',
    href: 'https://stoic.ai/',
    contribution:
      'Primary frontend engineer who built the React, TypeScript, and Next.js application from scratch.',
    capabilities: 'React · TypeScript · Next.js',
    visualName: 'Stoic: Fintech from the ground up',
    linkLabel: 'Visit Stoic',
  },
  {
    name: 'SplitHub',
    slug: 'splithub',
    href: 'https://splithub.app/',
    contribution:
      'Co-created the product in a two-person team: UX, the SwiftUI app, and its backend.',
    capabilities: 'Product strategy · UX · iOS delivery',
    visualName: 'SplitHub: Product ownership',
    linkLabel: 'Visit SplitHub',
  },
  {
    name: 'Evercity',
    slug: 'evercity',
    href: 'https://evercity.io/',
    contribution:
      'Contributed frontend work on a sustainable-finance platform.',
    capabilities: 'Frontend · Sustainable finance',
    visualName: 'Evercity: Sustainable finance',
    linkLabel: 'Visit Evercity',
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

  it('shows an approved screenshot where one exists and geometry elsewhere', () => {
    renderSelectedWork();

    for (const project of expectedProjects) {
      const scene = screen.getByRole('article', { name: project.name });
      const shot = en.projectScreenshots.find(
        (entry) => entry.slug === project.slug,
      );

      if (shot) {
        // The image carries its own accessible name, so the container must not
        // announce a second one.
        const image = within(scene).getByRole('img', { name: shot.alt });
        expect(image.tagName).toBe('IMG');
        expect(image.closest('[data-visual-kind]')).toHaveAttribute(
          'data-visual-kind',
          'product-screenshot',
        );
        expect(
          within(scene).queryByRole('img', { name: project.visualName }),
        ).not.toBeInTheDocument();
        continue;
      }

      const visual = within(scene).getByRole('img', {
        name: project.visualName,
      });
      expect(visual).toHaveAttribute('data-visual-kind', 'abstract-geometry');
      expect(
        [...visual.querySelectorAll('[data-geometry-layer]')].map((layer) =>
          layer.getAttribute('data-geometry-layer'),
        ),
      ).toEqual(['light-plane', 'depth-plane', 'arc', 'line-field', 'nodes']);
      expect(within(visual).queryByRole('button')).not.toBeInTheDocument();
    }
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

  it('shows the two SplitHub metrics as labeled facts beside the description', () => {
    renderSelectedWork();

    const scene = screen.getByRole('article', { name: 'SplitHub' });
    const metrics = scene.querySelector('dl');

    expect(metrics).not.toBeNull();
    expect(
      [...(metrics?.querySelectorAll('dt, dd') ?? [])].map((node) =>
        node.textContent?.trim(),
      ),
    ).toEqual(['350+', 'registered users', 'Around 50', 'daily active users']);
  });

  it('closes the section with a compact row instead of a full visual scene', () => {
    renderSelectedWork();

    const compact = screen.getByRole('article', { name: 'Evercity' });

    // The three full scenes frame their capture in a figure with a caption;
    // the closing row carries only a thumbnail, so it has no figure at all.
    expect(compact.querySelectorAll('figure')).toHaveLength(0);
    for (const project of expectedProjects.slice(0, 3)) {
      const scene = screen.getByRole('article', { name: project.name });
      expect(scene.querySelectorAll('figure')).toHaveLength(1);
    }

    // The approved capture is still there, just small — not a placeholder.
    expect(
      within(compact).getByRole('img', {
        name: 'Evercity project catalogue: sustainability filters above carbon project cards.',
      }),
    ).toBeInTheDocument();
  });

  it('keeps the name, description, and link readable when a capture fails', () => {
    renderSelectedWork();

    const scene = screen.getByRole('article', { name: 'Stoic' });
    const image = within(scene).getByRole('img', {
      name: 'Stoic strategy selection: exchange and risk filters beside strategy cards with performance charts.',
    });

    fireEvent.error(image);

    expect(
      within(scene).getByRole('heading', { level: 3, name: 'Stoic' }),
    ).toBeVisible();
    expect(
      within(scene).getByText(
        'A fintech web app for automated trading strategies.',
      ),
    ).toBeVisible();
    expect(
      within(scene).getByText(
        'Primary frontend engineer who built the React, TypeScript, and Next.js application from scratch.',
      ),
    ).toBeVisible();
    const namedLink = within(scene).getByRole('link', { name: 'Visit Stoic' });
    expect(namedLink).toBeVisible();
    expect(namedLink).toHaveAttribute('href', 'https://stoic.ai/');
    expect(
      within(scene).getByRole('img', {
        name: 'Stoic: Fintech from the ground up',
      }),
    ).toHaveAttribute('data-visual-kind', 'abstract-geometry');
  });
});
