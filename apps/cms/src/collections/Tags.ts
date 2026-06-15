import type { CollectionConfig } from 'payload'
import { slugField } from '../fields/slug'

export const Tags: CollectionConfig = {
  slug: 'tags',
  access: { read: () => true },
  admin: { useAsTitle: 'name' },
  fields: [
    { name: 'name', type: 'text', required: true, unique: true },
    slugField('name'),
  ],
}
