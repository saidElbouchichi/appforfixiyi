# syntax=docker/dockerfile:1
#
# Same `turbo prune` pattern as apps/api/Dockerfile. Build context is the
# monorepo root (see docker-compose.dev.yml).

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
RUN turbo prune @fixiyi/web --docker

FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm turbo run build --filter=@fixiyi/web

FROM base AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 fixiyi && adduser --system --uid 1001 fixiyi
COPY --from=installer --chown=fixiyi:fixiyi /app .
ENV NEXT_TELEMETRY_DISABLED=1
USER fixiyi
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=5 \
  CMD wget -q -O- http://127.0.0.1:3000/ || exit 1
CMD ["pnpm", "--filter", "@fixiyi/web", "start"]
