# CLAUDE.md — Engineering Guide

> **Read this first, every session.** This is the permanent engineering contract for the
> LaviMD Referral App. Product context (vision, business/commission/referral rules, branding)
> lives in [PROJECT.md](PROJECT.md). When the two disagree, stop and reconcile them before coding.

## Prime directives

1. **Never leave the repository in a broken state.** `main` must always pass CI.
2. **Always run lint, tests, and typecheck before committing.** No exceptions.
3. **Never ignore a lint or test failure.** Fix the cause; do not silence it.
4. **Never bypass CI** (no `--no-verify`, no disabling required checks, no force-push to `main`).
5. **Never introduce technical debt without documenting it** (see [Technical debt](#technical-debt)).
6. **Never commit secrets or PHI.** See [Security requirements](#security-requirements).

## Per-milestone workflow

Every milestone (and every substantive change) follows this exact sequence:

1. Explain the implementation plan.
2. List affected files.
3. Explain the risks.
4. Implement.
5. Run **lint**.
6. Run **tests**.
7. Run **typecheck**.
8. **Fix every issue** — the gate must be fully green.
9. Commit.
10. Push.
11. Summarize exactly what changed.

If something should be postponed, say so explicitly and record it (roadmap and/or tech-debt log).

### The green gate (run before every commit)

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

All five must pass. This mirrors CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)).

> **Local toolchain note (this machine):** pnpm is provided via Corepack. If `turbo` reports
> it cannot find the `pnpm` binary, ensure the Corepack shim dir is on `PATH` for the shell,
> then run commands via `corepack pnpm …`. CI is unaffected.

## Architecture principles

- **One language, shared contracts.** TypeScript end to end. Domain types and Zod schemas live
  in `packages/shared` and are the single contract between backend, admin, and mobile. Apps
  never duplicate or fork domain contracts.
- **Apps depend on packages, not on each other.** `apps/*` may depend on `packages/*`; they must
  not import from sibling apps.
- **Validate at the boundary.** Every untrusted input (HTTP body, query, params, external data)
  is parsed by a Zod schema before use. Trust nothing that crosses a boundary.
- **Explicit over implicit.** Prefer clear types and named functions over cleverness. No `any`
  as a shortcut (ESLint warns; CI treats warnings as failures via `--max-warnings 0`).
- **Cloud-portable.** Target AWS but keep infrastructure containerized and defined as code so the
  provider decision stays reversible until the deployment milestone.
- **Compliance-ready, not compliance-blocking.** No design choice may make future HIPAA controls
  hard to add. See [SECURITY.md](SECURITY.md).
- **Errors are values at boundaries, exceptions internally.** Return typed, validated results
  across API boundaries; never leak stack traces or internal detail to clients.

## Coding standards

- **TypeScript strict** everywhere (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`,
  `verbatimModuleSyntax`, etc. — see `packages/tsconfig`). Do not weaken these per-package
  without a documented reason.
- **Type-only imports** use `import type` (enforced by ESLint + `verbatimModuleSyntax`).
- **No floating promises** — every promise is awaited or explicitly handled (`@typescript-eslint/no-floating-promises`).
- **Prettier is the sole formatter.** Never hand-format; run `pnpm format`.
- **Naming:** `camelCase` for values/functions, `PascalCase` for types/classes, `SCREAMING_SNAKE_CASE`
  for module-level constants, kebab-case for file names.
- **Match the surrounding code.** New code reads like the code around it — same idioms, comment
  density, and structure.
- **Comments explain _why_,** not _what_. Keep them accurate; delete stale ones.
- **Small, cohesive modules.** Prefer pure, testable functions; isolate side effects.

## Security requirements

- **No PHI** in logs, URLs, query strings, analytics, error payloads, or the domain model, until
  the compliance milestone (M7) is complete and signed off. Patients are referenced by opaque,
  non-PHI identifiers.
- **No secrets in the repo.** Configuration comes from environment variables; `.env*` is
  git-ignored; document required keys in `*.example` files with no real values.
- **Least privilege** everywhere: CI permissions, cloud IAM, database roles, and API authorization.
- **Validate and sanitize** all external input; use parameterized queries (Prisma) — never string-built SQL.
- **Dependencies:** keep them current; review before adding; prefer well-maintained, typed packages.
- **AuthN/AuthZ**: every endpoint is deny-by-default; authorization is checked per action and
  per record, not just per route.
- **Authorization is role-based and enforced server-side. Never trust client permissions.** Roles,
  permissions, and record scoping come from `@lavimd/shared` (`can`, `canViewPartnerOwnedResource`);
  the client may render UI from them, but every decision is re-checked on the server. Never accept a
  role, permission list, or capability flag from a request body/header as authoritative.
- **Partner data is strictly owner-scoped** — a partner may only ever read their own referrals,
  transactions, commissions, and payouts. Every list/detail query filters by the authenticated
  partner, never by a client-supplied id alone.
- **Never** disable security tooling or commit around a security check.

## Testing requirements

- **Every feature ships with tests.** Bug fixes ship with a regression test.
- **Unit tests** with Vitest for domain logic and utilities; keep them fast and deterministic.
- **Coverage thresholds are enforced** and must not be lowered to make a build pass
  (`packages/shared` gates at ≥90% lines/statements/functions, ≥85% branches). Raise coverage,
  don't lower the bar.
- **Backend (M2+):** unit tests for services/domain, plus e2e tests for the HTTP surface.
- **Test behavior, not implementation.** Cover edge cases, invalid input, and failure paths, not
  just the happy path.
- **No skipped/pending tests on `main`.** A test that must be skipped requires a documented reason.

## Performance goals

> Targets are directional until we have real workloads; treat as budgets, revisit with data.

- **API:** p95 latency < 300 ms for standard reads under expected load; avoid N+1 queries
  (batch/`include` deliberately); paginate all list endpoints (shared `normalizePagination`).
- **Database:** index columns used in filters/joins; no unbounded queries.
- **Web (admin):** fast initial load; lazy-load heavy views; avoid shipping unused JS.
- **Mobile:** keep interactions responsive; avoid blocking the JS thread; minimize bundle size.
- **Build/CI:** keep the pipeline fast via Turborepo caching; don't add slow steps casually.

## Accessibility requirements

- **WCAG 2.1 AA is the baseline** for admin and mobile.
- **Color contrast** ≥ 4.5:1 for text (≥ 3:1 for large text/UI components). Never encode meaning
  by color alone — pair with text/icons (e.g., referral status).
- **Keyboard fully operable** (web): logical focus order, visible focus, no traps.
- **Semantics:** proper roles/labels; forms have associated labels and clear error messaging.
- **Respect** reduced-motion and OS text-scaling preferences.
- **Screen-reader support** on mobile (accessibility labels/roles).

## Documentation requirements

- **Keep [PROJECT.md](PROJECT.md) current** — record product decisions when they are made.
- **Keep [docs/architecture.md](docs/architecture.md) and [docs/milestones.md](docs/milestones.md)
  current** with structural changes.
- **Public APIs and non-obvious modules** get doc comments. The backend exposes generated OpenAPI docs.
- **Each new package/app** includes: a local `eslint.config.mjs` re-exporting `@lavimd/eslint-config`,
  a tsconfig extending `@lavimd/tsconfig`, and `lint`/`typecheck`/`test`/`build` scripts.
- **Update the README** when developer-facing workflow changes.
- **Every PR** describes what changed and why, and updates docs it affects.

## Git workflow

- **Default branch:** `main`. It must always be green.
- **Feature branches + PR** are the standard for code changes once collaborators/branch protection
  are in place. During solo bootstrap, foundational setup may be committed directly to `main` by
  the owner's explicit instruction — feature work should still use branches.
- **Rebase or merge cleanly**; keep history readable. Never force-push shared branches.
- **CI must be green to merge.** Do not merge red. Do not bypass required checks.

### Branch naming

`<type>/<short-kebab-summary>`, where `<type>` ∈:

- `feature/` — new functionality (`feature/referral-crud`)
- `fix/` — bug fix (`fix/status-transition-guard`)
- `chore/` — tooling/deps/config (`chore/bump-turbo`)
- `docs/` — documentation only (`docs/api-reference`)
- `refactor/`, `test/`, `perf/`, `ci/` — as named.

### Commit style

- **Imperative mood, present tense:** "Add referral status machine", not "Added"/"Adds".
- **Concise subject** (≤ ~72 chars); blank line; body explaining _what_ and _why_ when non-trivial.
- **One logical change per commit.** Keep commits reviewable.
- **Reference the milestone/issue** where relevant.
- Commits authored in this workflow include the standard `Co-Authored-By` trailer.

## Technical debt

Debt is sometimes a valid tradeoff — **but only when documented.**

- If you take a shortcut, add a `// TODO(debt): …` with a short rationale **and** record it where
  the team will see it (PR description and, if it outlives the PR, `docs/milestones.md` or a
  dedicated debt note).
- Never introduce silent debt (undocumented hacks, disabled checks, copy-paste divergence).
- Disabling a lint/type rule inline requires a comment explaining why and is a last resort.

## Definition of done

A change is done when: it meets its acceptance criteria; has tests; passes the full green gate
locally and in CI; updates relevant docs; introduces no undocumented debt; and leaves `main`
deployable.
