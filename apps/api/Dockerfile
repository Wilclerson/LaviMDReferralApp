# syntax=docker/dockerfile:1

# ---- base -------------------------------------------------------------------
FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /repo

# ---- dependencies -----------------------------------------------------------
# Manifests first so the install layer caches across source changes.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc turbo.json ./
COPY packages/tsconfig/package.json packages/tsconfig/
COPY packages/eslint-config/package.json packages/eslint-config/
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile

# ---- build ------------------------------------------------------------------
FROM deps AS build
COPY . .
RUN pnpm --filter @lavimd/api exec prisma generate \
  && pnpm --filter @lavimd/shared build \
  && pnpm --filter @lavimd/api build

# Produce a self-contained directory containing ONLY production dependencies.
# `pnpm deploy` resolves workspace deps (@lavimd/shared) into real directories.
RUN pnpm --filter @lavimd/api deploy --prod --legacy /deploy \
  && cp -r apps/api/dist /deploy/dist \
  && cp -r apps/api/prisma /deploy/prisma

# The Prisma client is generated into the store during build; regenerate it
# against the pruned tree so the runtime image carries its engine.
RUN cd /deploy && pnpm exec prisma generate

# ---- runtime ----------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Production dependencies only — no compilers, no test tooling, no dev deps.
COPY --from=build --chown=node:node /deploy /app

USER node
EXPOSE 3000

# Apply pending migrations, then start. Migrations are additive and safe to
# re-run; they never drop data.
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/main.js"]
