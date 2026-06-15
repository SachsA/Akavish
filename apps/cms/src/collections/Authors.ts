import type { CollectionConfig } from 'payload'
import { slugField } from '../fields/slug'

export const Authors: CollectionConfig = {
  slug: 'authors',
  access: { read: () => true },
  admin: { useAsTitle: 'name' },
  fields: [
    { name: 'name', type: 'text', required: true },
    slugField('name'),
    { name: 'avatar', type: 'upload', relationTo: 'media' },
    { name: 'bio', type: 'textarea' },
    { name: 'twitter', type: 'text', admin: { description: 'Handle sans le @' } },
  ],
}
