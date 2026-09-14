module.exports = {
  ci: {
    collect: {
      startServerCommand: 'pnpm preview --host 127.0.0.1 --port 4173',
      startServerReadyPattern: 'Local:',
      startServerReadyTimeout: 20000,
      url: [
        'http://127.0.0.1:4173/',
        'http://127.0.0.1:4173/en/',
        'http://127.0.0.1:4173/ru/',
      ],
      numberOfRuns: 3,
      settings: {
        chromeFlags:
          '--no-sandbox --host-resolver-rules=MAP eu.i.posthog.com ~NOTFOUND',
        throttlingMethod: 'simulate',
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.9 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        // Page weight, measured as the browser actually transfers it.
        'resource-summary:total:size': ['error', { maxNumericValue: 512000 }],
        'resource-summary:script:size': ['error', { maxNumericValue: 160000 }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: '.lighthouseci',
    },
  },
};
