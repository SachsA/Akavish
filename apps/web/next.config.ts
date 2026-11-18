import path from 'node:path'
import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs/config'

type RemotePattern = { protocol: 'http' | 'https'; hostname: string; port?: string }

// Turn a URL into a next/image remotePattern, ignoring anything unparseable.
function toRemotePattern(url: string | undefined): RemotePattern | null {
  if (!url) return null
  try {
    const u = new URL(url)
    return {
      protocol: u.protocol.replace(':', '') as 'http' | 'https',
      hostname: u.hostname,
      port: u.port || undefined,
    }
  } catch {
    return null
  }
}

// Media can come from the CMS itself (local-disk uploads in dev) or from the
// public R2 domain in production — allow whichever is configured.
const cmsPattern = toRemotePattern(process.env.CMS_URL ?? 'http://localhost:3001')
const mediaPattern = toRemotePattern(process.env.NEXT_PUBLIC_R2_PUBLIC_URL)

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
  // The French legal pages had their own slugs before the site went bilingual
  // (2026-11); they now live at the same path as the English ones, under /fr.
  async redirects() {
    return [
      { source: '/fr/confidentialite', destination: '/fr/privacy', permanent: true },
      { source: '/fr/conditions', destination: '/fr/terms', permanent: true },
      { source: '/fr/mentions-legales', destination: '/fr/legal', permanent: true },
    ]
  },
  transpilePackages: ['@akavish/ui', '@akavish/types', '@akavish/api-client'],
  images: {
    // Vercel's free plan includes 5,000 image transformations a month, and a
    // transformation is counted each time its cached copy is missing or
    // expired (75 % used on 2026-11-18). Media URLs never change (a new upload
    // gets a new file name), so a copy can stay cached a month: each image is
    // transformed once per width per month. Fewer widths, one format and one
    // quality keep the number of copies per image low.
    minimumCacheTTL: 2_678_400, // 31 days
    deviceSizes: [640, 828, 1200, 1920],
    imageSizes: [128, 256, 384],
    formats: ['image/webp'],
    qualities: [75],
    remotePatterns: [
      ...(cmsPattern ? [cmsPattern] : []),
      ...(mediaPattern ? [mediaPattern] : []),
      { protocol: 'http', hostname: 'localhost' },
      // R2 public buckets and the future custom media domain.
      { protocol: 'https', hostname: '**.r2.dev' },
      { protocol: 'https', hostname: 'media.akavish.gg' },
    ],
  },
}

// Sentry's build plugin: uploads source maps so stack traces show real code
// instead of minified soup, and generates the client bundle instrumentation.
//
// Safe without credentials — no SENTRY_AUTH_TOKEN just means "skip the source
// map upload", so `pnpm build` works on a fresh clone and in CI. Set org,
// project and the token on Vercel to get readable traces in production.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Keep build logs quiet unless we're in CI and actually want the detail.
  silent: !process.env.CI,

  // Upload a wider set of maps so framework frames resolve too.
  widenClientFileUpload: true,

  // Route Sentry's requests through our own domain. Ad blockers block calls to
  // sentry.io outright — without this we'd silently lose the errors of exactly
  // the ad-block-heavy audience a gaming site attracts.
  tunnelRoute: '/monitoring',

  // Strip the SDK's own debug logging from the production bundle (Sentry 11
  // name; works with Turbopack, which Next 16 builds with).
  bundleSizeOptimizations: { excludeDebugStatements: true },
})
