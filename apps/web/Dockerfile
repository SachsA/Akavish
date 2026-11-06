# Akavish web (Next.js) as a container — an exit door from Vercel, not what
# production uses today. Build from the REPO ROOT (workspace packages):
#
#   docker build -f apps/web/Dockerfile -t akavish-web \
#     --build-arg NEXT_PUBLIC_SITE_URL=https://akavish.gg \
#     --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_... \
#     --build-arg CMS_URL=https://cms.akavish.gg .
#   docker run -p 3000:3000 -e CLERK_SECRET_KEY=sk_... -e CMS_URL=https://cms.akavish.gg akavish-web
#
# NEXT_PUBLIC_* values are baked into the JS at build time, so they're build
# args; server-only secrets are passed at `docker run`. Full list: DEPLOYMENT.md
# → "Running in Docker".

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat && corepack enable
WORKDIR /repo

# 1. Keep only the web app and the workspace packages it depends on.
FROM base AS prune
COPY . .
RUN pnpm dlx turbo@2.9.16 prune @akavish/web --docker

# 2. Install (cached until a package.json or the lockfile changes), then build.
FROM base AS build
COPY --from=prune /repo/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=prune /repo/out/full/ .
# turbo prune keeps workspace packages only, not root config files.
COPY --from=prune /repo/tsconfig.base.json ./
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT
ARG NEXT_PUBLIC_R2_PUBLIC_URL
ARG CMS_URL=http://localhost:3001
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN \
    NEXT_PUBLIC_SENTRY_ENVIRONMENT=$NEXT_PUBLIC_SENTRY_ENVIRONMENT \
    NEXT_PUBLIC_R2_PUBLIC_URL=$NEXT_PUBLIC_R2_PUBLIC_URL \
    CMS_URL=$CMS_URL \
    NEXT_OUTPUT=standalone \
    NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @akavish/web build

# 3. Runtime: Next's standalone server + static assets only (no dev deps).
FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs
COPY --from=build --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /repo/apps/web/.next/static ./apps/web/.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
