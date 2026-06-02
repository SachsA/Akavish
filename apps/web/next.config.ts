import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@akavish/ui', '@akavish/types', '@akavish/api-client'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.cloudflare.com' },
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
  },
}

export default nextConfig
