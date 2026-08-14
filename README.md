# Gumarov Personal Landing

The source for `gumarov.com`, a bilingual personal landing for Rinat Gumarov,
Senior Frontend Engineer. The first release presents selected frontend and
product work for founders, hiring teams, and professional collaborators.

## Local development

Use Node.js 22 and pnpm 10:

```bash
pnpm install --frozen-lockfile
pnpm dev
```

## Quality commands

| Command             | Purpose                                                       |
| ------------------- | ------------------------------------------------------------- |
| `pnpm test`         | Run unit and component tests.                                 |
| `pnpm test:watch`   | Run Vitest in watch mode.                                     |
| `pnpm test:e2e`     | Run Playwright end-to-end tests.                              |
| `pnpm test:a11y`    | Run the focused Playwright accessibility suite.               |
| `pnpm typecheck`    | Type-check the TypeScript project.                            |
| `pnpm lint`         | Run ESLint with warnings treated as failures.                 |
| `pnpm format:check` | Check formatting with Prettier.                               |
| `pnpm build`        | Build the client with Vite during the bootstrap phase.        |
| `pnpm verify`       | Run formatting, linting, type-checking, tests, and the build. |
| `pnpm preview`      | Preview the production build locally.                         |

`build:client`, `build:ssr`, and `prerender` define the future static-rendering
contract. The bootstrap `build` command intentionally remains `vite build`
until the SSR and prerender pipeline is introduced.

## Privacy

The landing is designed to remain useful without analytics, storage, motion,
or optional client-side integrations. Analytics is not configured in this
repository baseline. If introduced later, it must be allowlisted, cookieless,
and documented before use.

## Asset provenance

Only approved, licensable assets belong in the public repository. Original
portrait and activity photographs stay in the ignored `assets-source/`
directory; published derivatives must have metadata removed. Do not add stock
stand-ins for personal photographs, confidential product material, or
unverified claims. Font files and their licenses must ship together.

## Deployment

Deployment is intentionally not configured yet. This repository does not
create a remote, publish a site, configure DNS, enable analytics, or change
external accounts.
