import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SearchResults } from '@/components/SearchResults'

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search Akavish articles.',
  robots: { index: false }, // don't index search result pages
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-3xl mx-auto px-4 py-12">
          <h1 className="text-3xl font-black tracking-tight text-white mb-2">Search</h1>
          <p className="text-zinc-500">Loading…</p>
        </div>
      }
    >
      <SearchResults />
    </Suspense>
  )
}
