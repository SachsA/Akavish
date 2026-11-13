import type { CollectionConfig } from 'payload'
import { revalidateAfterChange, revalidateAfterDelete } from '../lib/revalidate-web'
import { slugField } from '../fields/slug'
import { editors } from '../access/roles'

export const Tags: CollectionConfig = {
  slug: 'tags',
  // The website shows these: refresh its cache on change (lib/revalidate-web.ts).
  hooks: { afterChange: [revalidateAfterChange], afterDelete: [revalidateAfterDelete] },
  access: { read: () => true, delete: editors },
  admin: { useAsTitle: 'name' },
  fields: [
    { name: 'name', type: 'text', required: true, unique: true },
    slugField('name'),
  ],
}
