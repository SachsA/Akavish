import type { MetadataRoute } from 'next'
import { absoluteUrl } from '@/lib/site'
import {
  fetchAllArticleSlugs,
  fetchAllEntitySlugs,
} from '@/lib/payload'

export const revalidate = 300

// Category slugs mirror the keys in app/[category]/page.tsx.
const CATEGORY_SLUGS = ['news', 'leaks', 'reviews', 'previews', 'conferences', 'esport']

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const staticEntries: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/'), lastModified: now, changeFrequency: 'hourly', priority: 1 },
    ...CATEGORY_SLUGS.map((c) => ({
      url: absoluteUrl(`/${c}`),
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.7,
    })),
    ...['/about', '/contact', '/privacy', '/terms'].map((p) => ({
      url: absoluteUrl(p),
      lastModified: now,
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    })),
  ]

  // Pull dynamic content; tolerate a CMS hiccup by falling back to empty lists.
  const [articles, authors, games, tags] = await Promise.all([
    fetchAllArticleSlugs().catch(() => []),
    fetchAllEntitySlugs('authors').catch(() => []),
    fetchAllEntitySlugs('games').catch(() => []),
    fetchAllEntitySlugs('tags').catch(() => []),
  ])

  const articleEntries: MetadataRoute.Sitemap = articles.map((a) => ({
    url: absoluteUrl(`/article/${a.slug}`),
    lastModified: a.updatedAt ? new Date(a.updatedAt) : now,
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  const entityEntries = (
    items: { slug: string; updatedAt?: string }[],
    prefix: string,
    priority: number
  ): MetadataRoute.Sitemap =>
    items.map((it) => ({
      url: absoluteUrl(`/${prefix}/${it.slug}`),
      lastModified: it.updatedAt ? new Date(it.updatedAt) : now,
      changeFrequency: 'weekly',
      priority,
    }))

  return [
    ...staticEntries,
    ...articleEntries,
    ...entityEntries(authors, 'author', 0.5),
    ...entityEntries(games, 'game', 0.5),
    ...entityEntries(tags, 'tag', 0.4),
  ]
}
