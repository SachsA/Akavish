import type { Metadata } from 'next'
import { RootPage, generatePageMetadata } from '@payloadcms/next/views'
import config from '@payload-config'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function generateMetadata(args: any): Promise<Metadata> {
  return generatePageMetadata({ config, ...args })
}

export default async function Page(args: any) {
  return RootPage({ config, ...args })
}
