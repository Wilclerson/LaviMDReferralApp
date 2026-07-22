# Milestones

Each milestone follows a fixed workflow: plan → affected files → risks → implement →
lint → test → typecheck → fix → commit → push → summary. The repository is never left in a
broken state, and lint/test failures are never ignored.

> **Product model:** LaviMD is a Professional Partner Network (marketing/affiliate referral
> platform), not a clinical system. See [../PROJECT.md](../PROJECT.md).

## ✅ Milestone 1 — Monorepo foundation & CI/CD

- pnpm + Turborepo monorepo scaffolding.
- Shared config packages: `@lavimd/tsconfig`, `@lavimd/eslint-config`.
- `@lavimd/shared`: domain types, Zod schemas, status state machine, pagination utilities, with
  Vitest tests and coverage thresholds.
- Quality gates: type-aware ESLint (0 warnings), Prettier, strict TypeScript.
- GitHub Actions CI: format → lint → typecheck → test → build.
- Documentation: README, CONTRIBUTING, SECURITY, architecture, this file.

## ✅ Milestone 1.5 — Domain remodel (affiliate/partner network)

- Replaced the placeholder clinical referral model with the affiliate model in `@lavimd/shared`:
  **Partner** (9 non-medical categories, status machine, referral codes), **Referral** (marketing
  attribution funnel), **Commission** (payable only after administrator approval), and **Money**
  (integer minor units + basis-point commission computation).
- Generic `createStatusMachine` helper.
- Updated PROJECT.md, architecture, and SECURITY to the marketing-platform model.

## ✅ Milestone 1.7 — Affiliate business rules in the domain

- **Transaction** + `evaluateTransactionEligibility` encoding the 8-point eligible-transaction rule.
- **Commission plans**: versioned, multi-level, `percentage | flat | hybrid` (rates as data, never
  hard-coded); `computeRuleCommissionMinor`.
- **Attribution**: `resolveLastClickAttribution` (Last-Click, 30-day window, newest wins).
- **Payout** (ACH/PayPal/Manual, admin-approved, monthly, $50 minimum) + immutable **Ledger**.
- **Event catalog** (9 events) + `EventPublisher` contract for a simple in-process bus.
- 97 tests at 100% coverage.

## ⏳ Milestone 2 — Backend API foundation

- `apps/api` (NestJS): config module, health/readiness endpoints, structured logging.
- PostgreSQL via Prisma; schema + migrations for partners, referrals, transactions, commissions,
  commission plans, payouts, and the ledger.
- CRUD + **status-transition enforcement** using the shared state machines; administrator
  approval flow for commissions and payouts.
- **In-process event bus** implementing `EventPublisher`; publishers/subscribers for the domain events.
- **Transaction ingestion abstraction** (manual/CSV/REST/webhook) — MVP: manual admin entry.
- Request validation via shared Zod schemas; error handling; OpenAPI docs.
- Unit + e2e tests; Dockerfile for the API.

## ⏳ Milestone 3 — Admin dashboard

- `apps/admin` (Next.js): authenticated administrator dashboard.
- Review/approval queues for eligible transactions and commissions, partner management, reporting.
- Component and integration tests.

## ⏳ Milestone 4 — Partner mobile app

- `apps/mobile` (Expo React Native): partner-facing referral links, referral tracking, earnings.
- Shared types/validation from `@lavimd/shared`.
- Device/e2e testing strategy.

## ⏳ Milestone 5 — Auth & RBAC

- Authentication (partner / administrator), session/token strategy, role-based and per-record
  authorization (a partner sees only their own data).

## ⏳ Milestone 6 — Commission engine & payouts

- Versioned commission rule sets, commission statements, and payout integration.
- Clawback/reversal handling and tax-document considerations.

## ⏳ Milestone 7 — Infrastructure & deployment (AWS)

- Containerization, IaC, environments, secrets management, observability.

## ⏳ Milestone 8 — Security & data-protection hardening

- Audit logging, encryption posture, PII-safe logging, retention/minimization, CI scanning.
  See [../SECURITY.md](../SECURITY.md).
