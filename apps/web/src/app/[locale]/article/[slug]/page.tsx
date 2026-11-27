import { CoverImage } from '@/components/CoverImage'
import { notFound, permanentRedirect } from 'next/navigation'
import Link from '@/components/LocaleLink'
import { DateText } from '@/components/DateText'
import { localizePath, ogLocale } from '@/lib/i18n/config'
import { alternates } from '@/lib/i18n/metadata'
import { getMessages, setRequestLocale } from '@/lib/i18n/server'
import { isInLanguage } from '@/lib/i18n/content'
import type { Metadata } from 'next'
import {
  fetchAdjacentArticles,
  fetchArticleBySlug,
  fetchLiveArticleIds,
  fetchCurrentSlugFor,
  fetchRelatedArticles,
  fetchTagPages,
  type EntityLink,
} from '@/lib/payload'
import { LexicalContent } from '@/components/LexicalContent'
import { ArticleCard } from '@/components/ArticleCard'
import { NewsletterSignup } from '@/components/NewsletterSignup'
import { ShareButtons } from '@/components/ShareButtons'
import { SaveButton } from '@/components/SaveButton'
import { ScoreBadge } from '@/components/ScoreBadge'
import { Comments } from '@/components/Comments'
import { countWords, readingTimeMinutes } from '@/lib/reading-time'
import { absoluteUrl, SITE_NAME, SITE_URL } from '@/lib/site'
import { categoryByValue } from '@/lib/categories'
import { breadcrumbList } from '@/lib/structured-data'
import { JsonLd } from '@/components/JsonLd'

// Safety net only: the CMS pings /api/revalidate on every change (lib/revalidate.ts).
export const revalidate = 3600

// None built ahead: each page is rendered on its first visit, then cached
// (ISR) like the others. Without this export a dynamic segment is rendered on
// every request.
export function generateStaticParams() {
  return []
}

type Params = { params: Promise<{ locale: string; slug: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, locale: raw } = await params
  const locale = setRequestLocale(raw)
  const article = await fetchArticleBySlug(slug).catch(() => null)
  if (!article) return { title: getMessages().article.notFound }

  // Prefer the CMS SEO fields when set, fall back to the article's own title/excerpt.
  const title = article.seo?.title || article.title
  const description = article.seo?.description || article.excerpt
  // Not translated yet: the French URL shows the English text, so it points
  // search engines to the English page and doesn't claim a French version.
  const path = `/article/${article.slug}`
  const links = isInLanguage(article, 'fr')
    ? alternates(locale, path)
    : { canonical: path, languages: { en: path, 'x-default': path } }

  return {
    title,
    description,
    alternates: links,
    openGraph: {
      title,
      description,
      url: links.canonical as string,
      locale: ogLocale(locale),
      type: 'article',
      publishedTime: article.publishedAt,
      authors: [article.author.name],
      // Share image is provided by the sibling opengraph-image.tsx (branded,
      // always present). Twitter falls back to it automatically.
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

export default async function ArticlePage({ params }: Params) {
  const { slug, locale: raw } = await params
  const locale = setRequestLocale(raw)
  const t = getMessages()

  let article
  try {
    article = await fetchArticleBySlug(slug)
  } catch {
    article = null
  }

  if (!article) {
    // Renamed article? Send old links (shared, bookmarked, indexed) to the
    // current URL with a permanent redirect, so search engines move their
    // ranking over instead of dropping a 404.
    // Kept outside any try/catch: permanentRedirect() works by throwing.
    const currentSlug = await fetchCurrentSlugFor(slug).catch(() => null)
    if (currentSlug && currentSlug !== slug) permanentRedirect(localizePath(locale, `/article/${currentSlug}`))
    notFound()
  }

  // Secondary content: never let it break the page. The article itself is what
  // matters — if the CMS is slow or these queries fail, we drop the extras
  // rather than 500 on a page that already has everything a reader came for.
  const [related, adjacent, liveIds, tagPages] = await Promise.all([
    fetchRelatedArticles(article).catch(() => []),
    fetchAdjacentArticles(article).catch(() => ({ next: null, previous: null })),
    // Only untranslated French pages need to know (a live page stays English
    // until it ends): a translated page doesn't depend on the 5 min list.
    locale === 'en' || isInLanguage(article, locale) ? Promise.resolve([] as string[]) : fetchLiveArticleIds(),
    // A tag that stands for a console or a studio links to its page.
    fetchTagPages().catch(() => new Map<string, EntityLink>()),
  ])
  const liveInEnglish = !isInLanguage(article, locale) && liveIds.includes(article.id)

  const minutes = readingTimeMinutes(article.content)
  const readingTime = minutes ? t.article.readingTime(minutes) : ''
  const shareUrl = absoluteUrl(localizePath(locale, `/article/${article.slug}`))

  // Schema.org NewsArticle for rich results.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.excerpt,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    image: article.coverImage ? [article.coverImage] : undefined,
    author: {
      '@type': 'Person',
      name: article.author.name,
      ...(article.author.slug ? { url: absoluteUrl(localizePath(locale, `/author/${article.author.slug}`)) } : {}),
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
      logo: { '@type': 'ImageObject', url: absoluteUrl('/icon.png') },
    },
    isAccessibleForFree: true,
    inLanguage: isInLanguage(article, locale) ? locale : 'en',
    mainEntityOfPage: { '@type': 'WebPage', '@id': shareUrl },
    // Now that reading time is computed, expose it to search engines too.
    // `timeRequired` is an ISO 8601 duration.
    wordCount: countWords(article.content) || undefined,
    timeRequired: readingTimeMinutes(article.content)
      ? `PT${readingTimeMinutes(article.content)}M`
      : undefined,
  }

  // A scored review also goes out as a schema.org Review of the game, which is
  // what search engines read for the rating.
  const reviewJsonLd =
    article.category === 'review' && article.score !== undefined && article.game?.name
      ? {
          '@context': 'https://schema.org',
          '@type': 'Review',
          name: article.title,
          datePublished: article.publishedAt,
          author: { '@type': 'Person', name: article.author.name },
          publisher: { '@type': 'Organization', name: SITE_NAME },
          itemReviewed: { '@type': 'VideoGame', name: article.game.name },
          reviewRating: {
            '@type': 'Rating',
            ratingValue: article.score,
            bestRating: 10,
            worstRating: 0,
          },
        }
      : null

  const category = categoryByValue(article.category)
  const breadcrumbs = breadcrumbList(
    [
      ...(category ? [{ name: t.categories[category.value].label, path: `/${category.slug}` }] : []),
      { name: article.title, path: `/article/${article.slug}` },
    ],
    locale,
  )

  return (
    // The <article> below wraps only the piece itself — share links, prev/next
    // and suggestions are page furniture, not part of the article.
    <div className="max-w-3xl mx-auto px-4 py-12">
      <JsonLd data={reviewJsonLd ? [jsonLd, reviewJsonLd, breadcrumbs] : [jsonLd, breadcrumbs]} />
      <Link
        href="/"
        className="text-sm text-zinc-400 hover:text-white transition-colors inline-block py-1 mb-5"
      >
        {t.article.back}
      </Link>

      <article lang={isInLanguage(article, locale) ? undefined : 'en'}>
        {!isInLanguage(article, locale) && (
          <p lang={locale} className="mb-6 rounded-md border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-300">
            {liveInEnglish ? t.article.liveUntranslated : t.article.untranslated}
          </p>
        )}
        <div className="space-y-3 mb-8">
          <div className="flex items-center gap-3">
            <span className="text-emerald-500 text-xs font-bold uppercase tracking-wide">
              {t.categories[article.category]?.singular ?? article.category}
            </span>
            {article.score !== undefined && <ScoreBadge score={article.score} size="lg" />}
            <span className="ml-auto">
              <SaveButton articleId={article.id} />
            </span>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white leading-tight">
            {article.title}
          </h1>
          <p className="text-lg text-zinc-400">{article.excerpt}</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-400 pt-2">
            <span>
              {t.article.by}{' '}
              {article.author.slug ? (
                <Link
                  href={`/author/${article.author.slug}`}
                  className="text-zinc-200 hover:text-white transition-colors"
                >
                  {article.author.name}
                </Link>
              ) : (
                <span className="text-zinc-200">{article.author.name}</span>
              )}
            </span>
            {article.publishedAt && (
              <span>
                · <DateText iso={article.publishedAt} style="long" />
              </span>
            )}
            {readingTime && <span>· {readingTime}</span>}
            {article.game?.slug && (
              <span>
                ·{' '}
                <Link
                  href={`/game/${article.game.slug}`}
                  className="text-zinc-200 hover:text-white transition-colors"
                >
                  {article.game.name}
                </Link>
              </span>
            )}
          </div>
        </div>

        {article.coverImage && (
          <figure className="mb-8">
            <div className="relative aspect-video bg-zinc-800 rounded-lg overflow-hidden">
              <CoverImage
                src={article.coverImage}
                // The editor's alt text (required on every upload in the CMS).
                alt={article.coverImageAlt ?? ''}
                fit={article.coverImageFit}
                focus={article.coverImageFocus}
                sizes="(max-width: 768px) 100vw, 768px"
                preload
              />
            </div>
            {article.coverImageCredit && (
              // Photos that aren't ours (organisers, photographers) are credited.
              <figcaption className="mt-2 text-xs text-zinc-400">
                {t.article.photoCredit(article.coverImageCredit)}
              </figcaption>
            )}
          </figure>
        )}

        <div className="prose-invert">
          <LexicalContent content={article.content} locale={locale} />
        </div>

        {article.aiAssisted && (
          // Transparency about AI-assisted writing (EU AI Act art. 50, /terms).
          <p lang={locale} className="mt-8 text-sm text-zinc-400 italic">{t.article.aiNote}</p>
        )}
        {locale !== 'en' && isInLanguage(article, locale) && (
          // Machine translation, said plainly (EU AI Act art. 50, /terms).
          <p className={`${article.aiAssisted ? 'mt-2' : 'mt-8'} text-sm text-zinc-400 italic`}>
            {t.article.translatedNote}
          </p>
        )}

        {article.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-10 pt-6 border-t border-zinc-800">
            {article.tags.map((tag) => {
              const page = tagPages.get(tag)
              return page ? (
                <Link
                  key={tag}
                  href={page.path}
                  className="px-3 py-1 rounded-full border border-zinc-700 text-xs text-zinc-200 hover:text-emerald-400 hover:border-emerald-500 transition-colors"
                >
                  {page.name}
                </Link>
              ) : (
                <Link
                  key={tag}
                  href={`/tag/${tag}`}
                  className="px-3 py-1 rounded-full border border-zinc-800 text-xs text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors"
                >
                  #{tag}
                </Link>
              )
            })}
          </div>
        )}
      </article>

      <div className={`mt-8 ${article.tags.length > 0 ? '' : 'pt-6 border-t border-zinc-800'}`}>
        <ShareButtons url={shareUrl} title={article.title} />
      </div>

      <Comments articleId={article.id} />

      <div className="mt-10">
        <NewsletterSignup source="article" title={t.article.newsletterTitle} />
      </div>

      {(adjacent.previous || adjacent.next) && (
        <nav
          aria-label={t.article.navigation}
          className="grid gap-3 sm:grid-cols-2 mt-10 pt-6 border-t border-zinc-800"
        >
          {adjacent.previous ? (
            <Link
              href={`/article/${adjacent.previous.slug}`}
              className={`${adjacent.previous.spoiler ? 'akv-spoiler ' : ''}group rounded-lg border border-zinc-800 p-4 hover:border-zinc-700 transition-colors`}
            >
              <span className="block text-xs text-zinc-400 mb-1">{t.article.previous}</span>
              <span className="akv-spoiler-blur block font-bold text-white group-hover:text-emerald-400 transition-colors line-clamp-2">
                {adjacent.previous.title}
              </span>
            </Link>
          ) : (
            <span aria-hidden="true" />
          )}

          {adjacent.next && (
            <Link
              href={`/article/${adjacent.next.slug}`}
              className={`${adjacent.next.spoiler ? 'akv-spoiler ' : ''}group rounded-lg border border-zinc-800 p-4 hover:border-zinc-700 transition-colors sm:text-right`}
            >
              <span className="block text-xs text-zinc-400 mb-1">{t.article.next}</span>
              <span className="akv-spoiler-blur block font-bold text-white group-hover:text-emerald-400 transition-colors line-clamp-2">
                {adjacent.next.title}
              </span>
            </Link>
          )}
        </nav>
      )}

      {related.length > 0 && (
        <section className="mt-12 pt-8 border-t border-zinc-800">
          <h2 className="text-xl font-black tracking-tight text-white mb-5">{t.article.readNext}</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
