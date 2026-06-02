import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const nextConfig: NextConfig = {
  webpack: (webpackConfig) => {
    webpackConfig.resolve.alias['@payload-config'] = path.resolve(__dirname, './payload.config.ts')
    return webpackConfig
  },
}

export default withPayload(nextConfig)
