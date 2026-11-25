import type { MetadataRoute } from 'next'
import { absoluteUrl } from '@/lib/site'
import { fetchAllArticleSlugs, fetchAllEntitySlugs, fetchUsedTaxonomyIds } from '@/lib/payload'
import { ESPORT_GAMES } from '@/lib/esport'
import { CATEGORIES } from '@/lib/categories'
import { LOCALES, localizePath } from '@/lib/i18n/config'

export const revalidate = 300

type Entry = MetadataRoute.Sitemap[number]

/**
 * One entry per language for a page (English at the bare path, French under
 * /fr), each listing both versions, which is how search engines pair them.
 */
function bothLanguages(
  path: string,
  entry: Omit<Entry, 'url' | 'alternates'>,
): MetadataRoute.Sitemap {
  const languages = Object.fromEntries(LOCALES.map((l) => [l, absoluteUrl(localizePath(l, path))]))
  return LOCALES.map((l) => ({
    ...entry,
    url: absoluteUrl(localizePath(l, path)),
    alternates: { languages },
  }))
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const staticEntries: MetadataRoute.Sitemap = [
    ...bothLanguages('/', { lastModified: now, changeFrequency: 'hourly', priority: 1 }),
    ...CATEGORIES.flatMap((c) =>
      bothLanguages(`/${c.slug}`, { lastModified: now, changeFrequency: 'daily', priority: 0.7 }),
    ),
    ...bothLanguages('/games', { lastModified: now, changeFrequency: 'daily', priority: 0.6 }),
    ...['/esport/results', '/esport/calendar', '/esport/transfers'].flatMap((p) =>
      bothLanguages(p, { lastModified: now, changeFrequency: 'hourly', priority: 0.6 }),
    ),
    // One game's esport news and Mercato (/esport/cs2, /esport/transfers/cs2).
    ...bothLanguages('/esport/tournaments', { lastModified: now, changeFrequency: 'hourly', priority: 0.6 }),
    ...ESPORT_GAMES.flatMap((g) => [`/esport/${g}`, `/esport/transfers/${g}`, `/esport/tournaments/${g}`]).flatMap((p) =>
      bothLanguages(p, { lastModified: now, changeFrequency: 'daily', priority: 0.5 }),
    ),
    ...['/about', '/contact', '/privacy', '/terms', '/legal'].flatMap((p) =>
      bothLanguages(p, { lastModified: now, changeFrequency: 'yearly', priority: 0.3 }),
    ),
  ]

  // Pull dynamic content; tolerate a CMS hiccup by falling back to empty lists.
  const [articles, authors, games, tags, companies, platforms, used] = await Promise.all([
    fetchAllArticleSlugs().catch(() => []),
    fetchAllEntitySlugs('authors').catch(() => []),
    fetchAllEntitySlugs('games').catch(() => []),
    fetchAllEntitySlugs('tags').catch(() => []),
    fetchAllEntitySlugs('companies').catch(() => []),
    fetchAllEntitySlugs('platforms').catch(() => []),
    // If this one fails we can't tell which pages are empty, so it resolves to
    // `null` and the filter below lets everything through — a sitemap with a
    // few thin pages beats one that silently drops real ones.
    fetchUsedTaxonomyIds().catch(() => null),
  ])

  // Only list author and tag pages that have at least one published article.
  // Game, company and console pages are the games library: each has its facts
  // (releases, studios), so all of them are listed.
  // Generic so the result keeps the caller's full item type (slug, updatedAt…),
  // not just the `{ id }` the filter needs.
  const inUse = <T extends { id: string }>(items: T[], ids: Set<string> | undefined): T[] =>
    ids ? items.filter((it) => ids.has(it.id)) : items

  // An article not translated yet has no French page worth listing (it shows
  // the English text): English only until its translation exists.
  const articleEntries: MetadataRoute.Sitemap = articles.flatMap((a) => {
    const entry = {
      lastModified: a.updatedAt ? new Date(a.updatedAt) : now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }
    return a.translated
      ? bothLanguages(`/article/${a.slug}`, entry)
      : [{ ...entry, url: absoluteUrl(`/article/${a.slug}`) }]
  })

  const entityEntries = (
    items: { slug: string; updatedAt?: string }[],
    prefix: string,
    priority: number,
  ): MetadataRoute.Sitemap =>
    items.flatMap((it) =>
      bothLanguages(`/${prefix}/${it.slug}`, {
        lastModified: it.updatedAt ? new Date(it.updatedAt) : now,
        changeFrequency: 'weekly',
        priority,
      }),
    )

  return [
    ...staticEntries,
    ...articleEntries,
    ...entityEntries(inUse(authors, used?.authors), 'author', 0.5),
    ...entityEntries(games, 'game', 0.5),
    ...entityEntries(companies, 'company', 0.4),
    ...entityEntries(platforms, 'platform', 0.4),
    ...entityEntries(inUse(tags, used?.tags), 'tag', 0.4),
  ]
}
