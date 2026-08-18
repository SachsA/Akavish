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
  ],
}
