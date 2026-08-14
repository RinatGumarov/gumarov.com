import { render, screen, within } from '@testing-library/react';
import { en } from '../content/en';
import { SelectedWork } from './SelectedWork';
import { WorkPrinciples } from './WorkPrinciples';

const expectedProjects = [
  {
    name: 'TradingView',
    slug: 'tradingview',
    href: 'https://www.tradingview.com/',
    contribution:
      'Senior Frontend Engineer working across Pine Editor and Strategy Tester with ownership of complex frontend features.',
    capabilities: 'Complex frontend systems · Performance-sensitive interfaces',
    visualName: 'TradingView: Trading interfaces',
  },
  {
    name: 'Stoic',
    slug: 'stoic',
    href: 'https://stoic.ai/',
    contribution:
      'Primary frontend engineer who built the React, TypeScript, and Next.js application from scratch.',
    capabilities: 'React · TypeScript · Next.js',
    visualName: 'Stoic: Fintech from the ground up',
  },
  {
    name: 'SplitHub',
    slug: 'splithub',
    href: 'https://splithub.app/',
    contribution:
      'Conceived the product, shaped its UX, and shipped it through engineering to an App Store release.',
    capabilities: 'Product strategy · UX · iOS delivery',
    visualName: 'SplitHub: Product ownership',
  },
  {
    name: 'Evercity',
    slug: 'evercity',
    href: 'https://evercity.io/',
    contribution:
      'Contributed to frontend and full-stack work on a sustainable-finance platform.',
    capabilities: 'Frontend · Full stack · Sustainable finance',
    visualName: 'Evercity: Sustainable finance',
  },
] as const;

describe('selected work', () => {
  it('renders each approved project mapping and narrative independently', () => {
    render(
      <SelectedWork heading={en.projectsHeading} projects={en.projects} />,
    );

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

  it('uses accessible containers with purely abstract decorative geometry', () => {
    render(
      <SelectedWork heading={en.projectsHeading} projects={en.projects} />,
    );

    for (const project of expectedProjects) {
      const scene = screen.getByRole('article', { name: project.name });
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
      expect(within(visual).queryByRole('navigation')).not.toBeInTheDocument();
      expect(within(visual).queryByRole('toolbar')).not.toBeInTheDocument();
    }
  });
});

it('renders all four working principles as an ordered narrative', () => {
  render(<WorkPrinciples content={en.principles} />);

  const section = screen.getByRole('region', { name: 'How I work' });
  const principles = within(section).getAllByRole('listitem');

  expect(principles).toHaveLength(4);
  expect(principles.map((principle) => principle.textContent?.trim())).toEqual(
    en.principles.items,
  );
});
