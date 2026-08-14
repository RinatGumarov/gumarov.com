import { render, screen, within } from '@testing-library/react';
import { en } from '../content/en';
import { SelectedWork } from './SelectedWork';
import { WorkPrinciples } from './WorkPrinciples';

describe('selected work', () => {
  it('renders the four project scenes in their approved order', () => {
    render(
      <SelectedWork heading={en.projectsHeading} projects={en.projects} />,
    );

    const section = screen.getByRole('region', { name: 'Selected work' });
    const scenes = within(section).getAllByRole('article');

    expect(scenes).toHaveLength(4);
    for (const [index, projectName] of [
      'TradingView',
      'Stoic',
      'SplitHub',
      'Evercity',
    ].entries()) {
      const scene = scenes.at(index);

      expect(scene).toBeDefined();
      if (!scene) throw new Error(`Missing project scene ${index + 1}`);

      expect(
        within(scene).getByRole('heading', {
          level: 3,
          name: projectName,
        }),
      ).toBeInTheDocument();
    }
    expect(scenes.map((scene) => scene.dataset.projectSlug)).toEqual([
      'tradingview',
      'stoic',
      'splithub',
      'evercity',
    ]);
  });

  it('keeps every contribution and destination available without imagery', () => {
    render(
      <SelectedWork heading={en.projectsHeading} projects={en.projects} />,
    );

    for (const project of en.projects) {
      const scene = screen.getByRole('article', { name: project.name });
      const link = within(scene).getByRole('link', { name: project.name });

      expect(within(scene).getByText(project.contribution)).toBeVisible();
      expect(link).toHaveAttribute('href', project.href);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(
        within(scene).getByRole('img', {
          name: `${project.name}: ${project.eyebrow}`,
        }),
      ).toBeInTheDocument();
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
