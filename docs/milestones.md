# Milestones

Each milestone follows a fixed workflow: plan → affected files → risks → implement →
lint → test → typecheck → fix → commit → push → summary. The repository is never left in a
broken state, and lint/test failures are never ignored.

## ✅ Milestone 1 — Monorepo foundation & CI/CD

- pnpm + Turborepo monorepo scaffolding.
- Shared config packages: `@lavimd/tsconfig`, `@lavimd/eslint-config`.
- `@lavimd/shared`: referral domain types, Zod schemas, status state machine, pagination
  utilities, with Vitest tests and coverage thresholds.
- Quality gates: type-aware ESLint (0 warnings), Prettier, strict TypeScript.
- GitHub Actions CI: format → lint → typecheck → test → build.
- Documentation: README, CONTRIBUTING, SECURITY, architecture, this file.

## ⏳ Milestone 2 — Backend API foundation

- `apps/api` (NestJS): config module, health/readiness endpoints, structured logging.
- PostgreSQL via Prisma; initial referral schema and migrations.
- Referral CRUD + status-transition enforcement using the shared state machine.
- Request validation via shared Zod schemas; error handling; OpenAPI docs.
- Unit + e2e tests; Dockerfile for the API.

## ⏳ Milestone 3 — Admin dashboard

- `apps/admin` (Next.js): authenticated staff dashboard.
- Referral list/detail/management views backed by the API.
- Component and integration tests.

## ⏳ Milestone 4 — Mobile app

- `apps/mobile` (Expo React Native): provider-facing referral capture and tracking.
- Shared types/validation from `@lavimd/shared`.
- Device/e2e testing strategy.

## ⏳ Milestone 5 — Auth & RBAC

- Authentication (provider/staff), session/token strategy, role-based authorization.

## ⏳ Milestone 6 — Infrastructure & deployment (AWS)

- Containerization, IaC, environments, secrets management, observability.

## ⏳ Milestone 7 — Compliance (HIPAA) hardening

- Prerequisite before any real PHI. See [../SECURITY.md](../SECURITY.md) for the deferred
  controls checklist.
