# Architecture

## Overview

LaviMD Referral App is a TypeScript monorepo. A single language and a shared package of
domain types/validation flow across the backend, the admin dashboard, and the mobile app,
eliminating type drift between client and server.

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Mobile app  │     │    Admin     │     │   External   │
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

The domain core. Owns:

- Referral domain types and the referral **status state machine**
  (`ALLOWED_TRANSITIONS`, `canTransitionReferral`).
- Zod schemas (`createReferralSchema`, `referralSchema`) used for runtime validation
  on both client and server.
- Cross-cutting utilities (e.g. pagination normalization).

Built with `tsup` to emit both ESM and CJS plus type declarations, so it can be consumed
by Node (NestJS/CJS), bundlers (Next.js), and Metro (Expo).

### `packages/tsconfig` and `packages/eslint-config`

Single sources of truth for compiler and lint configuration. Every app extends these so
conventions never fork.

### `apps/*` (upcoming)

- **`apps/api`** — NestJS + Prisma + PostgreSQL. Owns persistence, authn/authz, and the
  REST surface. (Milestone 2)
- **`apps/admin`** — Next.js dashboard for staff to manage referrals. (Milestone 3)
- **`apps/mobile`** — Expo React Native app for providers. (Milestone 4)

## Design principles

1. **Share types, not runtime coupling.** Apps depend on `@lavimd/shared` for contracts;
   they do not import each other.
2. **Validate at the boundary.** Every untrusted input is parsed by a Zod schema.
3. **Cloud-portable infrastructure.** Target AWS, but package apps as containers with IaC so
   the provider decision stays reversible until the deployment milestone.
4. **Compliance-ready, not compliance-blocking.** No design choice should make future HIPAA
   controls hard to add. See [../SECURITY.md](../SECURITY.md).
