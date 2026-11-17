import type { CollectionConfig } from 'payload'
import { revalidateAfterChange, revalidateAfterDelete } from '../lib/revalidate-web'
import { slugField } from '../fields/slug'
import { editors } from '../access/roles'

/**
 * Studios and publishers. A game links to its developers and publishers here,
 * and each company has a page on the site (/company/<slug>): its games and the
 * articles about them. The scout creates the ones it meets in the news.
 */
export const Companies: CollectionConfig = {
  slug: 'companies',
  hooks: { afterChange: [revalidateAfterChange], afterDelete: [revalidateAfterDelete] },
  access: { read: () => true, delete: editors },
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'slug', 'updatedAt'] },
  fields: [
    { name: 'name', type: 'text', required: true, unique: true },
    slugField('name'),
    {
      // Former names and other spellings ("Microsoft Studios" for Xbox Game
      // Studios): the scout matches them instead of creating a duplicate.
      name: 'aliases',
      type: 'text',
      hasMany: true,
      admin: {
        description:
          'Anciens noms et autres écritures (« Microsoft Studios » pour Xbox Game Studios). Le scout les reconnaît au lieu de créer un doublon.',
      },
    },
    { name: 'logo', type: 'upload', relationTo: 'media' },
    {
      // The articles tagged with it show on the company's page too.
      name: 'tag',
      type: 'relationship',
      relationTo: 'tags',
      admin: {
        description: 'Le tag de la société, s’il existe : ses articles apparaissent aussi sur la page.',
      },
    },
  ],
}
