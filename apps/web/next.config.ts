import type { NextConfig } from 'next'

// Allow next/image to load media served by the CMS (its host comes from CMS_URL),
// plus the future storage hosts (R2 / Supabase).
const cmsUrl = process.env.CMS_URL ?? 'http://localhost:3001'
let cmsPattern: { protocol: 'http' | 'https'; hostname: string; port?: string } | null = null
try {
  const u = new URL(cmsUrl)
  cmsPattern = {
    protocol: u.protocol.replace(':', '') as 'http' | 'https',
    hostname: u.hostname,
    port: u.port || undefined,
  }
} catch {
  cmsPattern = null
}

const nextConfig: NextConfig = {
  transpilePackages: ['@akavish/ui', '@akavish/types', '@akavish/api-client'],
  images: {
    remotePatterns: [
      ...(cmsPattern ? [cmsPattern] : []),
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: '**.cloudflare.com' },
      { protocol: 'https', hostname: '**.r2.dev' },
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'media.akavish.gg' },
    ],
  },
}

export default nextConfig
