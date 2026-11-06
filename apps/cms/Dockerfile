# Akavish CMS (Payload) as a container — an exit door from Railway, not what
# production uses today. Build from the REPO ROOT (the lockfile lives there):
#
#   docker build -f apps/cms/Dockerfile -t akavish-cms .
#   docker build -f apps/cms/Dockerfile --target migrate -t akavish-cms-migrate .
#
#   docker run --rm -e DATABASE_URL=... -e PAYLOAD_SECRET=... akavish-cms-migrate
#   docker run -p 3001:3001 -e DATABASE_URL=... -e PAYLOAD_SECRET=... \
#     -e SERVER_URL=https://cms.akavish.gg -e WEB_URL=https://akavish.gg \
#     -e R2_BUCKET=... (and the other R2_*, RESEND_*, SENTRY_*) akavish-cms
#
# Run the `migrate` image before each deploy (what Railway's pre-deploy step
# does). Media must go to R2: the container's disk is thrown away on restart.
# Full list of variables: DEPLOYMENT.md → "Running in Docker".

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat && corepack enable
WORKDIR /repo

FROM base AS prune
COPY . .
RUN pnpm dlx turbo@2.9.16 prune akavish-cms --docker

FROM base AS build
COPY --from=prune /repo/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=prune /repo/out/full/ .
# turbo prune keeps workspace packages only, not root config files.
COPY --from=prune /repo/tsconfig.base.json ./
ENV NEXT_OUTPUT=standalone NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter akavish-cms build

# One-shot migrations: the full workspace has the Payload CLI, the standalone
# server below doesn't.
FROM build AS migrate
WORKDIR /repo/apps/cms
CMD ["pnpm", "migrate"]

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3001 HOSTNAME=0.0.0.0
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs
COPY --from=build --chown=nextjs:nodejs /repo/apps/cms/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /repo/apps/cms/.next/static ./apps/cms/.next/static
USER nextjs
EXPOSE 3001
CMD ["node", "apps/cms/server.js"]
