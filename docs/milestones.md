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

## ✅ Milestone 1.8 — Authorization matrix (RBAC)

- Four roles (Super Admin, Administrator, Partner, Customer) with an explicit permission catalog
  in `@lavimd/shared`: `can()` (deny-by-default), `canAll()`, `isAdminRole()`, and
  `canViewPartnerOwnedResource()` for partner owner-scoping.
- Administrators explicitly cannot change system/security settings or create Super Admins;
  partners can only ever see their own referrals, transactions, commissions, and payouts.
- 110 tests at 100% coverage, asserting every "may" and "may never" in the matrix.

## ✅ Milestone 2 — Backend API foundation

- `apps/api` (NestJS 11): Zod-validated env config, version-neutral health probes, global error
  filter that never leaks internals.
- **PostgreSQL via Prisma**: `User`, `PermissionGrant`, `Partner`, `Referral`, `Transaction`,
  `CommissionPlan`/`CommissionRule`, `Commission`, `LedgerEntry`, `AuditLog` + initial migration.
- **Authentication**: JWT login (`bcryptjs` hashing, generic errors that don't enumerate users).
- **RBAC guards**: global `JwtAuthGuard` + `PermissionsGuard`; deny-by-default with explicit
  `@Public()`; permissions resolved **server-side per request** from role + stored overrides.
- **Modules**: Partner (approve/suspend), Referral, Transaction (manual import → eligibility →
  pending commission; attribution override), Commission (approve/reject/reverse), Ledger
  (append-only), Audit (append-only writer + Super-Admin read).
- **Event-driven**: `InMemoryEventBus` implementing the shared `EventPublisher`; commission
  approval publishes an event that the ledger subscriber reacts to.
- **OpenAPI** generated with component schemas derived from the shared Zod contracts.
- Docker + docker-compose (Postgres + API), seed data, 116 tests incl. an HTTP e2e suite.

### Deferred from M2 (documented)

- **Payout endpoints** → Milestone 6 (payout domain types exist; the `Payout` table lands there).
- **Verifying the migration against a live PostgreSQL** — the SQL is generated offline and no
  test currently runs against a real database. First task when a DB is available.
- Partner self-service profile editing, CSV/webhook ingestion adapters → M3/M6.

## ⏳ Milestone 3 — Admin dashboard

- `apps/admin` (Next.js): authenticated administrator dashboard.
- Review/approval queues for eligible transactions and commissions, partner management, reporting.
- Component and integration tests.

## ⏳ Milestone 4 — Partner mobile app

- `apps/mobile` (Expo React Native): partner-facing referral links, referral tracking, earnings.
- Shared types/validation from `@lavimd/shared`.
- Device/e2e testing strategy.

## ⏳ Milestone 5 — Authentication & session management

- Authentication for all four roles, session/token strategy, password/credential handling.
- Wires the M1.8 authorization matrix into guards/interceptors; per-record enforcement everywhere.
- Audit logging of administrative actions (including attribution overrides).

## ⏳ Milestone 6 — Commission engine & payouts

- Versioned commission rule sets, commission statements, and payout integration.
- Clawback/reversal handling and tax-document considerations.

## ⏳ Milestone 7 — Infrastructure & deployment (AWS)

- Containerization, IaC, environments, secrets management, observability.

## ⏳ Milestone 8 — Security & data-protection hardening

- Audit logging, encryption posture, PII-safe logging, retention/minimization, CI scanning.
  See [../SECURITY.md](../SECURITY.md).
