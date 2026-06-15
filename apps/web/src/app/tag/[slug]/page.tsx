import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { fetchTagBySlug, fetchArticles } from '@/lib/payload'
import { ArticleCard } from '@/components/ArticleCard'

export const revalidate = 30

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const tag = await fetchTagBySlug(slug).catch(() => null)
  if (!tag) return { title: 'Tag not found' }
  return {
    title: `#${tag.name}`,
    description: `Articles tagged ${tag.name} on Akavish.`,
  }
}

export default async function TagPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  let tag
  try {
    tag = await fetchTagBySlug(slug)
  } catch {
    tag = null
  }
  if (!tag) notFound()

  let articles = []
  try {
    const result = await fetchArticles({ tagId: tag.id, limit: 24 })
    articles = result.data
  } catch {
    // Tag still renders even if the article list fails.
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <header className="mb-10">
        <h1 className="text-4xl font-black tracking-tight text-white">#{tag.name}</h1>
        <p className="text-zinc-400 mt-2">Everything tagged {tag.name}.</p>
      </header>

      {articles.length === 0 ? (
        <p className="text-zinc-500">No published articles with this tag yet.</p>
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
