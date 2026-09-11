import { render } from '@testing-library/react';
import { getContent } from '../content';
import { ProofRow } from './ProofRow';

it('renders every localized proof point as a value/label definition pair', () => {
  const points = getContent('en').hero.proofPoints;
  const { container } = render(<ProofRow points={points} />);

  expect(container.querySelector('dl')).toBeInTheDocument();

  const terms = container.querySelectorAll('dt');
  const definitions = container.querySelectorAll('dd');
  expect(terms).toHaveLength(points.length);
  expect(definitions).toHaveLength(points.length);

  points.forEach((point, index) => {
    expect(terms[index]).toHaveTextContent(point.value);
    expect(definitions[index]).toHaveTextContent(point.label);
  });
});
