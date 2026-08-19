import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

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

const nextConfig: NextConfig = {
  transpilePackages: ['@akavish/ui', '@akavish/types', '@akavish/api-client'],
  images: {
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

  // Strip the SDK's own debug logging from the production bundle.
  disableLogger: true,
})
