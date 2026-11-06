import { withPayload } from '@payloadcms/next/withPayload'
import { withSentryConfig } from '@sentry/nextjs'
import path from 'node:path'
import type { NextConfig } from 'next'
// `NEXT_OUTPUT=standalone` (set only by the Dockerfile) emits a self-contained
// server in .next/standalone. Vercel/Railway builds don't set it and are
// unchanged. The tracing root is the monorepo root so workspace packages and
// the hoisted pnpm store are included.
const standalone =
  process.env.NEXT_OUTPUT === 'standalone'
    ? { output: 'standalone' as const, outputFileTracingRoot: path.resolve(process.cwd(), '../..') }
    : {}

const nextConfig: NextConfig = {
  ...standalone,
  images: {
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
    ],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
}

// Order matters: Payload wraps the config first (it owns the admin routes and
// the server-package bundling), then Sentry wraps the result.
//
// No `tunnelRoute` here, unlike the web app — the CMS has no browser SDK, so
// there are no client requests for an ad blocker to intercept.
export default withSentryConfig(
  withPayload(nextConfig, { devBundleServerPackages: false }),
  {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT_CMS,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    silent: !process.env.CI,
    disableLogger: true,
  }
)
