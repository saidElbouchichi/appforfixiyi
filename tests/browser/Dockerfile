# syntax=docker/dockerfile:1
#
# The browser suite on Linux (design phase 15, Decision 87). The visual
# references are Linux renders: fonts are rasterised differently on Windows
# and macOS, so they are only compared from this image — locally
# (`pnpm test:visual`) and in CI alike. Build context: the monorepo root.
#
# The image holds the dependencies only. Specs, support code, the config and
# the references are mounted at run time, so editing a test needs no rebuild.

FROM mcr.microsoft.com/playwright:v1.63.0-noble AS base
RUN npm install -g pnpm@12.4.2 turbo@2.11.2
ENV TURBO_TELEMETRY_DISABLED=1

FROM base AS pruner
WORKDIR /app
COPY . .
RUN turbo prune @fixiyi/browser-tests --docker

FROM base AS runner
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
# The harness reads @fixiyi/ui and @fixiyi/design-tokens through their built entry points.
RUN pnpm turbo run build --filter=@fixiyi/browser-tests^...
WORKDIR /app/tests/browser
ENV VISUAL=1
ENTRYPOINT ["npx", "playwright", "test"]
