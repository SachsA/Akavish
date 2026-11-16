import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SearchResults } from '@/components/SearchResults'
import { getMessages, setRequestLocale } from '@/lib/i18n/server'

type Params = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  setRequestLocale((await params).locale)
  const t = getMessages()
  return {
    title: t.search.title,
    description: t.search.description,
    robots: { index: false }, // don't index search result pages
  }
}

// The search runs in the browser (SearchResults calls /api/search), so the
// page itself is static; useSearchParams() needs the Suspense boundary.
export default async function SearchPage({ params }: Params) {
  setRequestLocale((await params).locale)
  const t = getMessages()
  return (
    <Suspense
      fallback={
        <div className="max-w-3xl mx-auto px-4 py-12">
          <h1 className="text-3xl font-black tracking-tight text-white mb-2">{t.search.title}</h1>
          <p className="text-zinc-400">{t.search.loading}</p>
        </div>
      }
    >
      <SearchResults />
    </Suspense>
  )
}
