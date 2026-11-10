import type { CollectionConfig } from 'payload'

/**
 * Everything the scout collected: one row per article or post, linked to the
 * story (sujet) it belongs to. Deleted after 30 days (src/scout/retention.ts).
 */
export const ScoutItems: CollectionConfig = {
  slug: 'scout-items',
  labels: { singular: 'Scout item', plural: 'Scout items' },
  admin: {
    group: 'Scout',
    useAsTitle: 'title',
    defaultColumns: ['title', 'source', 'status', 'story', 'publishedAt'],
    description: 'Raw items the scout collected. Kept 30 days.',
  },
  // Written by the scout only.
  access: { create: () => false },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'url', type: 'text', required: true, unique: true, index: true },
    { name: 'summary', type: 'textarea' },
    { name: 'publishedAt', type: 'date' },
    { name: 'source', type: 'relationship', relationTo: 'scout-sources', required: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'new',
      index: true,
      enumName: 'enum_scout_items_status',
      options: [
        { label: 'New (not triaged yet)', value: 'new' },
        { label: 'Grouped into a story', value: 'triaged' },
        { label: 'Ignored (not news worth covering)', value: 'ignored' },
      ],
    },
    { name: 'story', type: 'relationship', relationTo: 'scout-stories', index: true },
  ],
}
