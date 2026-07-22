# LaviMD Referral App

LaviMD's **Professional Partner Network** — a marketing / affiliate referral platform where
non-medical partners (trainers, stylists, coaches, gyms, influencers, …) invite customers to
LaviMD and earn commission on administrator-approved eligible transactions. A backend API, an
admin dashboard, and a partner mobile app share a single TypeScript codebase.

> This is **not** a clinical system: partners never practice medicine, and all medical decisions
> stay with LaviMD's licensed providers. See [PROJECT.md](PROJECT.md).

> **Status:** Milestone 1 — monorepo foundation and CI/CD are in place. Application code
> (API, admin, mobile) lands in subsequent milestones. See [docs/milestones.md](docs/milestones.md).

## Key documents

Read these before contributing:

- **[PROJECT.md](PROJECT.md)** — the living **product** document: vision, target users, business /
  commission / referral rules, branding, roadmap, product decisions, and open questions.
- **[CLAUDE.md](CLAUDE.md)** — the permanent **engineering** guide: coding standards, architecture
  principles, security/testing/accessibility/performance requirements, and the Git & green-gate
  workflow. **Read it first every session.**
- [CONTRIBUTING.md](CONTRIBUTING.md) — day-to-day contribution steps.
- [SECURITY.md](SECURITY.md) — security posture and the (deferred) HIPAA compliance boundary.

## Architecture at a glance

This is a **pnpm + Turborepo monorepo** written in TypeScript end to end.

| Path                     | What it is                                      | Status         |
| ------------------------ | ----------------------------------------------- | -------------- |
| `packages/shared`        | Shared domain types, Zod schemas, and utilities | ✅ Milestone 1 |
| `packages/tsconfig`      | Shared TypeScript configuration presets         | ✅ Milestone 1 |
| `packages/eslint-config` | Shared, type-aware ESLint flat config           | ✅ Milestone 1 |
| `apps/api`               | NestJS backend API (PostgreSQL + Prisma)        | ✅ Milestone 2 |
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

## Running the API

The fastest path is Docker (Postgres + API together):

```bash
docker compose up --build
```

- API: `http://localhost:3000/api/v1`
- OpenAPI docs: `http://localhost:3000/api/docs`
- Probes: `http://localhost:3000/health/live` and `/health/ready`

## Database setup

### Option A — Docker Compose (recommended for running the stack)

Start only PostgreSQL, then run the API on the host:

```bash
docker compose up -d postgres
```

```bash
cp apps/api/.env.example apps/api/.env
```

Apply migrations and seed development data:

```bash
pnpm --filter @lavimd/api run db:migrate:deploy
```

```bash
pnpm --filter @lavimd/api run db:seed
```

Then start the API:

```bash
pnpm --filter @lavimd/api run dev
```

### Option B — no Docker required

Tooling and tests can start a **real PostgreSQL** from bundled binaries
(`embedded-postgres`) as an ordinary user process — no Docker daemon, no admin
rights. This is what CI uses.

Apply the migrations and seed against a throwaway database in one step:

```bash
pnpm --filter @lavimd/api run db:verify
```

Run any command against a throwaway database:

```bash
node apps/api/scripts/with-db.mjs "pnpm exec prisma studio"
```

### Migration commands

| Command                                                         | What it does                                                      |
| --------------------------------------------------------------- | ----------------------------------------------------------------- |
| `pnpm --filter @lavimd/api run db:generate`                     | Regenerate the Prisma client from `schema.prisma`                 |
| `pnpm --filter @lavimd/api run db:migrate:deploy`               | Apply pending migrations (used in CI and containers)              |
| `pnpm --filter @lavimd/api run db:migrate:dev -- --name <name>` | Create a new migration from schema changes (development)          |
| `pnpm --filter @lavimd/api run db:seed`                         | Seed development data (refuses to run with `NODE_ENV=production`) |
| `pnpm --filter @lavimd/api run db:verify`                       | Apply all migrations **and** seed against a clean database        |

> Migration SQL files must be committed **without a UTF-8 BOM** — Prisma cannot
> parse them otherwise. Prefer `prisma migrate dev` over hand-writing them.

## Testing

```bash
pnpm test
```

```bash
pnpm test:integration
```

`pnpm test` runs the unit suites. `pnpm test:integration` starts a real
PostgreSQL, applies the committed migrations from an **empty** database, and runs
the database-backed suite — so every run also proves the migration history
applies from scratch.

## Continuous integration

Every push and pull request to `main` runs formatting, lint, typecheck, test, and build
via GitHub Actions — see [.github/workflows/ci.yml](.github/workflows/ci.yml).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for conventions, and [SECURITY.md](SECURITY.md) for
security and (future) compliance practices.

## License

Proprietary — all rights reserved. See [LICENSE](LICENSE).
