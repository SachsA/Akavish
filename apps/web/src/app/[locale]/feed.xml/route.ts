import { feedResponse } from '@/lib/feed'
import { isLocale, LOCALES } from '@/lib/i18n/config'

// /fr/feed.xml (lib/feed.ts). English is /feed.xml at the root (/en/feed.xml
// redirects there).
export const revalidate = 300

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}

export async function GET(_req: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return feedResponse(isLocale(locale) ? locale : 'en')
}
