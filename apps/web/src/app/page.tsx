import { fetchArticles } from '@/lib/payload'
import { ArticleCard } from '@/components/ArticleCard'
import { Wordmark } from '@/components/Wordmark'
import type { Article } from '@akavish/types'

// Revalidate the home page periodically so freshly published articles appear.
export const revalidate = 30

export default async function HomePage() {
  let articles: Article[] = []
  let cmsError = false

  try {
    const result = await fetchArticles({ limit: 12 })
    articles = result.data
  } catch {
    cmsError = true
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <section className="mb-12 text-center space-y-4">
        <h1>
          <Wordmark className="text-5xl" />
        </h1>
        <p className="text-zinc-400 text-lg max-w-xl mx-auto">
          Breaking gaming news, exclusive leaks, in-depth reviews. Fast. Serious. No fluff.
        </p>
        <div className="flex justify-center gap-3 flex-wrap">
          {['CS2', 'GTA VI', "Baldur's Gate 3", 'Esport', 'Nintendo'].map((tag) => (
            <span
              key={tag}
              className="px-3 py-1 rounded-full border border-zinc-800 text-xs text-zinc-500"
            >
              {tag}
            </span>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-widest text-zinc-600 mb-6 font-bold">
          Latest
        </h2>

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
            <p className="font-medium text-zinc-400">No articles yet.</p>
            <p className="text-sm mt-1">
              Publish an article in the CMS (status ={' '}
              <code className="text-zinc-300">Published</code>) and it&apos;ll show up here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
