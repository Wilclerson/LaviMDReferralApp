# syntax=docker/dockerfile:1

# ---- base -------------------------------------------------------------------
FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /repo

# ---- dependencies -----------------------------------------------------------
# Copy only manifests first so the install layer caches across source changes.
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

# ---- runtime ----------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production

# TODO(debt): the runtime image carries dev dependencies. Switch to
# `pnpm deploy --prod` (or a pruned install) when image size starts to matter.
COPY --from=build /repo /repo

USER node
EXPOSE 3000

# Apply pending migrations, then start. Migrations are idempotent and safe to
# re-run; they never drop data.
CMD ["sh", "-c", "pnpm --filter @lavimd/api db:migrate:deploy && node apps/api/dist/main.js"]
