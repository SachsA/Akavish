import type { CollectionConfig } from 'payload'
import { revalidateAfterChange, revalidateAfterDelete } from '../lib/revalidate-web'
import { slugField } from '../fields/slug'

export const Authors: CollectionConfig = {
  slug: 'authors',
  // The website shows these: refresh its cache on change (lib/revalidate-web.ts).
  hooks: { afterChange: [revalidateAfterChange], afterDelete: [revalidateAfterDelete] },
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
