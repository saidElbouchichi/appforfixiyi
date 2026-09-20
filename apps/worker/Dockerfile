# syntax=docker/dockerfile:1
#
# Same `turbo prune` pattern as apps/api/Dockerfile. No HEALTHCHECK here:
# the worker has no HTTP surface (Decision 9 - "system/ping" is a real
# diagnostic queue, not a fake HTTP endpoint added just to satisfy Docker).
# Build context is the monorepo root (see docker-compose.dev.yml).

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
# npm install -g (not corepack): see apps/api/Dockerfile for why -- a
# per-user corepack cache mismatch between the root build stages and the
# non-root runtime USER below causes a failed reinstall attempt at startup.
RUN npm install -g pnpm@12.4.2 turbo@2.11.2
ENV TURBO_TELEMETRY_DISABLED=1

FROM base AS pruner
WORKDIR /app
COPY . .
RUN turbo prune @fixiyi/worker --docker

FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
RUN pnpm turbo run build --filter=@fixiyi/worker

FROM base AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 fixiyi && adduser --system --uid 1001 fixiyi
COPY --from=installer --chown=fixiyi:fixiyi /app .
USER fixiyi
CMD ["pnpm", "--filter", "@fixiyi/worker", "start"]
