import type { NextConfig } from 'next'

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

export default nextConfig
