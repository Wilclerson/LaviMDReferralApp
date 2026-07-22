# Contributing to LaviMD Referral App

## Toolchain

- **Node.js** >= 20 (developed on Node 22 LTS; see `.nvmrc`)
- **pnpm** 9 via Corepack: `corepack enable pnpm`

## Repository layout

```
apps/        deployable applications (api, admin, mobile) — added per milestone
packages/    shared libraries (shared, tsconfig, eslint-config)
docs/        architecture and milestone documentation
```

## Workflow

1. Branch from `main` (`feature/…`, `fix/…`, `chore/…`).
2. Make your change with tests.
3. Run the full local gate before pushing:

   ```bash
   pnpm format:check
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm build
   ```

4. Open a PR. CI runs the same gate; it must be green to merge.

## Conventions

- **Language:** TypeScript everywhere. `any` is discouraged (ESLint warns; CI treats
  warnings as failures via `--max-warnings 0`).
- **Imports:** type-only imports use `import type` (enforced by ESLint + `verbatimModuleSyntax`).
- **Validation:** runtime input is validated with [Zod](https://zod.dev) schemas that live in
  `packages/shared` where they are shared across apps.
- **Formatting:** Prettier is the single source of truth. Do not hand-format.
- **Commits:** imperative mood, present tense ("Add referral status machine").

## Adding a package or app

1. Create it under `packages/` or `apps/`.
2. Add a local `eslint.config.mjs` that re-exports `@lavimd/eslint-config`.
3. Extend a preset from `@lavimd/tsconfig`.
4. Provide `lint`, `typecheck`, `test`, and `build` scripts so Turborepo can orchestrate it.

## Security

Never commit secrets, credentials, or Protected Health Information (PHI). See
[SECURITY.md](SECURITY.md).
