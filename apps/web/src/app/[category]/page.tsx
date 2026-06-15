import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import type { Article, ArticleCategory } from '@akavish/types'
import { fetchArticles } from '@/lib/payload'
import { ArticleCard } from '@/components/ArticleCard'

export const revalidate = 30

// URL slug (what the header links to) → CMS category value + display label.
const CATEGORY_MAP: Record<string, { value: ArticleCategory; label: string; blurb: string }> = {
  news: { value: 'news', label: 'News', blurb: 'Breaking gaming news, as it drops.' },
  leaks: { value: 'leak', label: 'Leaks', blurb: 'Exclusive leaks and rumors from the industry.' },
  reviews: { value: 'review', label: 'Reviews', blurb: 'In-depth, no-fluff reviews.' },
  previews: { value: 'preview', label: 'Previews', blurb: 'Hands-on first impressions.' },
  conferences: { value: 'conference', label: 'Conferences', blurb: 'Recaps from the big showcases.' },
  esport: { value: 'esport', label: 'Esport', blurb: 'Competitive scene coverage.' },
}

// Pre-render the known category pages at build time.
export function generateStaticParams() {
  return Object.keys(CATEGORY_MAP).map((category) => ({ category }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>
}): Promise<Metadata> {
  const { category } = await params
  const conf = CATEGORY_MAP[category]
  if (!conf) return { title: 'Not found' }
  return {
    title: conf.label,
    description: conf.blurb,
    alternates: { canonical: `/${category}` },
    openGraph: { title: conf.label, description: conf.blurb, url: `/${category}` },
  }
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>
}) {
  const { category } = await params
  const conf = CATEGORY_MAP[category]
  if (!conf) notFound()

  let articles: Article[] = []
  let cmsError = false
  try {
    const result = await fetchArticles({ category: conf.value, limit: 24 })
    articles = result.data
  } catch {
    cmsError = true
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <header className="mb-10">
        <h1 className="text-4xl font-black tracking-tight text-white">{conf.label}</h1>
        <p className="text-zinc-400 mt-2">{conf.blurb}</p>
      </header>

      {cmsError ? (
        <div className="border border-zinc-800 rounded-lg p-8 text-center text-zinc-500">
          <p className="font-medium text-zinc-400">Couldn&apos;t reach the CMS.</p>
          <p className="text-sm mt-1">
            Make sure the CMS is running on{' '}
            <code className="text-zinc-300">localhost:3001</code>.
          </p>
        </div>
      ) : articles.length === 0 ? (
        <div className="border border-zinc-800 rounded-lg p-8 text-center text-zinc-500">
          <p className="font-medium text-zinc-400">Nothing here yet.</p>
          <p className="text-sm mt-1">
            No published <span className="lowercase">{conf.label}</span> articles for now.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {articles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      )}
    </div>
  )
}
