# Architecture

## Overview

LaviMD Referral App is a **Professional Partner Network** — a marketing / affiliate referral
platform, **not** a clinical system (see [../PROJECT.md](../PROJECT.md)). It is a TypeScript
monorepo: a single language and a shared package of domain types/validation flow across the
backend, the admin dashboard, and the partner mobile app, eliminating type drift between client
and server.

The core domain is the affiliate funnel:

```
Partner ──shares link/code──▶ Referral (attribution)
                                  │  customer signs up + transacts
                                  ▼
                         eligible Transaction
                                  │  administrator approves
                                  ▼
                            Commission ──▶ Payout
```

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Partner app  │     │    Admin     │     │   External   │
│  (Expo RN)   │     │  (Next.js)   │     │  integrations│
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       └──────────── HTTPS / REST ───────────────┘
                            │
                     ┌──────▼───────┐
                     │   API (Nest) │
                     └──────┬───────┘
                            │  Prisma
                     ┌──────▼───────┐
                     │  PostgreSQL  │
                     └──────────────┘

        packages/shared  ──  types + Zod schemas shared by every box above
```

## Tooling

- **Package manager:** pnpm workspaces (pinned via Corepack).
- **Task runner:** Turborepo — caches and parallelizes `build`/`lint`/`typecheck`/`test`,
  respecting inter-package dependencies (`dependsOn: ["^build"]`).
- **Language/quality:** TypeScript (strict), type-aware ESLint, Prettier.
- **Testing:** Vitest (unit) with V8 coverage thresholds; app-level e2e added per app.

## Packages and apps

### `packages/shared`

The domain core for the affiliate model. Owns:

- **Partner** — categories (personal trainer … influencer), status machine, referral codes,
  and `isPartnerEligibleForCommission` (active-only).
- **Referral** — marketing attribution with a status machine
  (`pending → signed_up → converted`, plus `expired`/`cancelled`).
- **Commission** — status machine (`pending_review → approved → paid`, plus `rejected`/`reversed`);
  `isCommissionPayable` is true only for administrator-`approved` commissions.
- **Money** — integer minor-unit money + `computeCommissionMinor(amount, rateBasisPoints)`
  (the rate is an input; rates are never hard-coded).
- A generic `createStatusMachine` helper and cross-cutting utilities (e.g. pagination).
- Zod schemas for every entity, used for runtime validation on both client and server.

Built with `tsup` to emit both ESM and CJS plus type declarations, so it can be consumed
by Node (NestJS/CJS), bundlers (Next.js), and Metro (Expo).

### `packages/tsconfig` and `packages/eslint-config`

Single sources of truth for compiler and lint configuration. Every app extends these so
conventions never fork.

### `apps/*` (upcoming)

- **`apps/api`** — NestJS + Prisma + PostgreSQL. Owns persistence, authn/authz, and the
  REST surface. (Milestone 2)
- **`apps/admin`** — Next.js dashboard for administrators to review/approve transactions and
  commissions, manage partners, and report. (Milestone 3)
- **`apps/mobile`** — Expo React Native app for partners (links, referrals, earnings). (Milestone 4)

## Design principles

1. **Share types, not runtime coupling.** Apps depend on `@lavimd/shared` for contracts;
   they do not import each other.
2. **Validate at the boundary.** Every untrusted input is parsed by a Zod schema.
3. **Cloud-portable infrastructure.** Target AWS, but package apps as containers with IaC so
   the provider decision stays reversible until the deployment milestone.
4. **No PHI by design.** As a marketing/affiliate platform, no clinical data belongs here;
   customers are referenced by opaque, non-PHI identifiers. No design choice should make future
   data-protection controls hard to add. See [../SECURITY.md](../SECURITY.md).
5. **Money is exact.** Amounts are integer minor units with an explicit currency — never floats.
