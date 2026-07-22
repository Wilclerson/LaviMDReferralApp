# LaviMD Referral App

A referral management platform for LaviMD — a backend API, an admin dashboard, and a
mobile app, sharing a single TypeScript codebase.

> **Status:** Milestone 1 — monorepo foundation and CI/CD are in place. Application code
> (API, admin, mobile) lands in subsequent milestones. See [docs/milestones.md](docs/milestones.md).

## Architecture at a glance

This is a **pnpm + Turborepo monorepo** written in TypeScript end to end.

| Path                     | What it is                                      | Status         |
| ------------------------ | ----------------------------------------------- | -------------- |
| `packages/shared`        | Shared domain types, Zod schemas, and utilities | ✅ Milestone 1 |
| `packages/tsconfig`      | Shared TypeScript configuration presets         | ✅ Milestone 1 |
| `packages/eslint-config` | Shared, type-aware ESLint flat config           | ✅ Milestone 1 |
| `apps/api`               | NestJS backend API (PostgreSQL + Prisma)        | ⏳ Milestone 2 |
| `apps/admin`             | Next.js admin dashboard                         | ⏳ Milestone 3 |
| `apps/mobile`            | React Native (Expo) mobile app                  | ⏳ Milestone 4 |

See [docs/architecture.md](docs/architecture.md) for the full picture.

## Prerequisites

- **Node.js** >= 20 (see [.nvmrc](.nvmrc); the project is developed on Node 22 LTS)
- **pnpm** 9 — managed via [Corepack](https://nodejs.org/api/corepack.html), no global install needed

```bash
corepack enable pnpm
```

## Getting started

```bash
pnpm install
pnpm lint        # type-aware ESLint across all packages
pnpm typecheck   # tsc --noEmit across all packages
pnpm test        # Vitest unit tests
pnpm build       # build all packages
```

## Repository scripts

| Script              | Description                                 |
| ------------------- | ------------------------------------------- |
| `pnpm build`        | Build every package/app (Turborepo, cached) |
| `pnpm lint`         | Lint every package (0 warnings allowed)     |
| `pnpm typecheck`    | Type-check every package                    |
| `pnpm test`         | Run all unit tests                          |
| `pnpm format`       | Format the repo with Prettier               |
| `pnpm format:check` | Verify formatting (used in CI)              |
| `pnpm clean`        | Remove build/test artifacts                 |

## Continuous integration

Every push and pull request to `main` runs formatting, lint, typecheck, test, and build
via GitHub Actions — see [.github/workflows/ci.yml](.github/workflows/ci.yml).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for conventions, and [SECURITY.md](SECURITY.md) for
security and (future) compliance practices.

## License

Proprietary — all rights reserved. See [LICENSE](LICENSE).
