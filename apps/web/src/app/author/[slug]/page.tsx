import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { fetchAuthorBySlug, fetchArticles } from '@/lib/payload'
import { ArticleCard } from '@/components/ArticleCard'

export const revalidate = 30

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const author = await fetchAuthorBySlug(slug).catch(() => null)
  if (!author) return { title: 'Author not found' }
  return {
    title: author.name,
    description: author.bio ?? `Articles by ${author.name} on Akavish.`,
  }
}

export default async function AuthorPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  let author
  try {
    author = await fetchAuthorBySlug(slug)
  } catch {
    author = null
  }
  if (!author) notFound()

  let articles = []
  try {
    const result = await fetchArticles({ authorId: author.id, limit: 24 })
    articles = result.data
  } catch {
    // Author still renders even if the article list fails.
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <header className="flex items-center gap-5 mb-10">
        {author.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={author.avatar}
            alt={author.name}
            className="w-20 h-20 rounded-full object-cover border border-zinc-800"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center text-2xl font-black text-zinc-600">
            {author.name.charAt(0)}
          </div>
        )}
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">{author.name}</h1>
          {author.bio && <p className="text-zinc-400 mt-1 max-w-2xl">{author.bio}</p>}
          {author.twitter && (
            <a
              href={`https://twitter.com/${author.twitter}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 text-sm hover:text-emerald-300 mt-1 inline-block"
            >
              @{author.twitter}
            </a>
          )}
        </div>
      </header>

      <h2 className="text-xs uppercase tracking-widest text-zinc-600 mb-6 font-bold">
        Articles
      </h2>
      {articles.length === 0 ? (
        <p className="text-zinc-500">No published articles yet.</p>
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
