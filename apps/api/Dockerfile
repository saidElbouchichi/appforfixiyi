# syntax=docker/dockerfile:1
#
# Multi-stage, monorepo-aware build (Turborepo's documented `turbo prune`
# pattern for pnpm workspaces): prune the monorepo down to exactly what
# @fixiyi/api needs, install only that pruned lockfile, then build.
# Build context is the MONOREPO ROOT, not this directory (see
# docker-compose.dev.yml), because `turbo prune` needs the full workspace.

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
# `npm install -g` (not corepack): corepack's per-invocation shim caches the
# downloaded pnpm release under $HOME, which differs for the non-root
# runtime USER below than for the root build stages -- it re-downloads and
# then misdetects a fresh/inconsistent install, trying (and failing, as a
# non-root user) to wipe /app/node_modules/.pnpm on every container start.
# A single global pnpm binary has no such per-user cache.
RUN npm install -g pnpm@12.4.2 turbo@2.11.2
ENV TURBO_TELEMETRY_DISABLED=1

FROM base AS pruner
WORKDIR /app
COPY . .
RUN turbo prune @fixiyi/api --docker

FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
RUN pnpm turbo run build --filter=@fixiyi/api

FROM base AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 fixiyi && adduser --system --uid 1001 fixiyi
COPY --from=installer --chown=fixiyi:fixiyi /app .
USER fixiyi
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=5 \
  CMD wget -q -O- http://127.0.0.1:4000/health || exit 1
CMD ["pnpm", "--filter", "@fixiyi/api", "start"]
