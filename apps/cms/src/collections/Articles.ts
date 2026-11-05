import type { CollectionConfig } from 'payload'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { slugField } from '../fields/slug'
import {
  syncArticleToSearch,
  removeArticleFromSearch,
} from '../lib/article-search-sync'

export const Articles: CollectionConfig = {
  slug: 'articles',
  access: {
    // Public can read published articles only; logged-in editors see everything.
    read: ({ req: { user } }) => {
      if (user) return true
      return { status: { equals: 'published' } }
    },
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'status', 'publishedAt', 'author'],
  },
  versions: { drafts: true },
  hooks: {
    // Stamp `publishedAt` automatically. It used to be a sidebar field editors
    // had to remember, and in practice nobody did — every early article shipped
    // with a null date, which cost the byline date, `datePublished` in the
    // JSON-LD (the field Google leans on hardest for news), the prev/next
    // navigation, and any meaningful `-publishedAt` ordering.
    beforeChange: [
      ({ data, originalDoc }) => {
        if (data.status !== 'published' || data.publishedAt) return data

        // Already published but undated = written before this hook existed.
        // Fall back to its creation time so re-saving an old piece doesn't
        // restamp it with today. A genuine draft→published transition is
        // happening now, so it gets now.
        const isBackfill = originalDoc?.status === 'published'
        data.publishedAt =
          isBackfill && originalDoc?.createdAt
            ? originalDoc.createdAt
            : new Date().toISOString()

        return data
      },

      // Remember the old slug when a *published* article is renamed, so links
      // already shared or indexed by Google keep working: the web app looks up
      // `previousSlugs` on a miss and 308-redirects to the current URL.
      // Drafts that were never public have no old URL worth keeping.
      ({ data, originalDoc }) => {
        const oldSlug: string | undefined = originalDoc?.slug
        const newSlug: string | undefined = data.slug
        if (!oldSlug || !newSlug || oldSlug === newSlug) return data
        if (originalDoc?.status !== 'published') return data

        // Partial API updates may omit the array — fall back to what's stored.
        const current: { slug?: string }[] = Array.isArray(data.previousSlugs)
          ? data.previousSlugs
          : (originalDoc?.previousSlugs ?? [])

        // Renaming back to an old slug: it's live again, so drop it from the list.
        const kept = current.filter((entry) => entry.slug && entry.slug !== newSlug)
        if (!kept.some((entry) => entry.slug === oldSlug)) kept.push({ slug: oldSlug })

        data.previousSlugs = kept
        return data
      },
    ],
    // Keep the Meilisearch index in sync. Best-effort: runs after the response,
    // failures are logged inside the sync helpers and never block editing.
    afterChange: [
      ({ doc, req }) => {
        void syncArticleToSearch(req.payload, doc.id)
        return doc
      },
    ],
    afterDelete: [
      ({ doc, req }) => {
        void removeArticleFromSearch(req.payload, doc.id)
        return doc
      },
    ],
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    slugField('title'),
    {
      name: 'excerpt', type: 'textarea', required: true,
      admin: { description: 'Short summary shown in cards (~160 chars)' },
    },
    { name: 'content', type: 'richText', editor: lexicalEditor(), required: true },
    { name: 'coverImage', type: 'upload', relationTo: 'media' },
    {
      name: 'category', type: 'select', required: true,
      options: [
        { label: 'News', value: 'news' },
        { label: 'Leak', value: 'leak' },
        { label: 'Review', value: 'review' },
        { label: 'Preview', value: 'preview' },
        { label: 'Conference', value: 'conference' },
        { label: 'Esport', value: 'esport' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'status', type: 'select', required: true, defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
        { label: 'Archived', value: 'archived' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'publishedAt', type: 'date',
      admin: {
        position: 'sidebar',
        date: { pickerAppearance: 'dayAndTime' },
        description:
          'Filled in automatically when the article is first published. Set it by hand only to override that date.',
      },
    },
    { name: 'author', type: 'relationship', relationTo: 'authors', required: true, admin: { position: 'sidebar' } },
    { name: 'game', type: 'relationship', relationTo: 'games', admin: { position: 'sidebar' } },
    { name: 'tags', type: 'relationship', relationTo: 'tags', hasMany: true, admin: { position: 'sidebar' } },
    {
      name: 'seo', type: 'group',
      fields: [
        { name: 'title', type: 'text' },
        { name: 'description', type: 'textarea' },
      ],
    },
    {
      // Filled by the beforeChange hook above. Editable so a stale redirect can
      // be removed by hand, but there's normally no reason to touch it.
      name: 'previousSlugs',
      type: 'array',
      admin: {
        initCollapsed: true,
        description:
          'Old URLs of this article. Visitors and search engines landing on them are permanently redirected here. Filled in automatically when you change the slug of a published article.',
      },
      fields: [{ name: 'slug', type: 'text', required: true, index: true }],
    },
  ],
}
