import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const config = require('../lighthouserc.cjs');

describe('Lighthouse CI quality gates', () => {
  it('asserts launch budgets against the built preview', () => {
    expect(config.ci.collect.startServerCommand).toMatch(/preview/u);
    expect(config.ci.collect.settings.throttlingMethod).toBe('devtools');
    expect(config.ci.collect.url).toEqual(
      expect.arrayContaining([
        'http://127.0.0.1:4173/',
        'http://127.0.0.1:4173/en/',
        'http://127.0.0.1:4173/ru/',
      ]),
    );

    const assertions = config.ci.assert.assertions;
    for (const category of [
      'performance',
      'accessibility',
      'best-practices',
      'seo',
    ]) {
      expect(assertions[`categories:${category}`][0]).toBe('error');
      expect(
        assertions[`categories:${category}`][1].minScore,
      ).toBeGreaterThanOrEqual(0.9);
    }

    expect(assertions['largest-contentful-paint'][0]).toBe('error');
    expect(
      assertions['largest-contentful-paint'][1].maxNumericValue,
    ).toBeLessThanOrEqual(2500);
    expect(assertions['cumulative-layout-shift'][0]).toBe('error');
    expect(
      assertions['cumulative-layout-shift'][1].maxNumericValue,
    ).toBeLessThanOrEqual(0.1);
  });
});
