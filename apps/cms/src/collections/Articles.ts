import type { CollectionConfig } from 'payload'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { slugField } from '../fields/slug'

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
      admin: { position: 'sidebar', date: { pickerAppearance: 'dayAndTime' } },
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
