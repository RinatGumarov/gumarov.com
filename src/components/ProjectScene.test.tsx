import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { en } from '../content/en';
import { SelectedWork } from './SelectedWork';

const { observeProjectViewOnceMock } = vi.hoisted(() => ({
  observeProjectViewOnceMock: vi.fn(() => vi.fn()),
}));

vi.mock('../lib/analytics', () => ({
  observeProjectViewOnce: observeProjectViewOnceMock,
}));

const renderSelectedWork = () =>
  render(
    <SelectedWork
      heading={en.projectsHeading}
      projects={en.projects}
      screenshots={en.projectScreenshots}
      locale="en"
    />,
  );

beforeEach(() => observeProjectViewOnceMock.mockClear());

it('gives every project a heading and a named outbound link', () => {
  renderSelectedWork();

  for (const project of en.projects) {
    const scene = screen.getByRole('article', { name: project.name });

    expect(
      within(scene).getByRole('heading', { level: 3, name: project.name }),
    ).toBeInTheDocument();
    expect(within(scene).getByText(project.contribution)).toBeVisible();

    // The title link and the scene's own "Visit <product>" link both carry the
    // product name; a string `name` matches the whole accessible name.
    for (const link of [
      within(scene).getByRole('link', { name: project.name }),
      within(scene).getByRole('link', { name: project.linkLabel }),
    ]) {
      expect(link).toHaveAttribute('href', project.href);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
  }
});

/*
 * Text mode is declared on the project rather than inferred from a missing
 * screenshot: a scene without a capture used to fall through to a decorative
 * graphic, so deleting a capture swapped one picture for another instead of
 * removing the picture.
 */
it('frames a capture only for the projects that declare one', () => {
  renderSelectedWork();

  for (const project of en.projects) {
    const scene = screen.getByRole('article', { name: project.name });
    const shot = en.projectScreenshots.find(
      (entry) => entry.slug === project.slug,
    );

    if (project.media === 'screenshot') {
      expect(within(scene).getByRole('img')).toHaveAttribute('alt', shot?.alt);
      expect(scene.querySelectorAll('figure')).toHaveLength(1);
    } else {
      expect(shot).toBeUndefined();
      expect(scene.querySelectorAll('img, picture, svg, figure')).toHaveLength(
        0,
      );
    }
  }
});

it('keeps the name, description and link readable when a capture fails', () => {
  renderSelectedWork();
  const scene = screen.getByRole('article', { name: 'Splithub' });

  fireEvent.error(within(scene).getByRole('img'));

  expect(
    within(scene).getByRole('heading', { level: 3, name: 'Splithub' }),
  ).toBeVisible();
  expect(
    within(scene).getByRole('link', { name: 'Visit Splithub' }),
  ).toHaveAttribute('href', 'https://splithub.app/');
  // The caption described the capture, so it goes with it rather than
  // captioning an empty frame.
  expect(within(scene).queryAllByRole('img')).toHaveLength(0);
  expect(within(scene).queryByText('Splithub on iOS')).not.toBeInTheDocument();
});

it('registers every scene for locale-aware view tracking', () => {
  renderSelectedWork();

  expect(observeProjectViewOnceMock).toHaveBeenCalledTimes(en.projects.length);
  for (const project of en.projects) {
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
