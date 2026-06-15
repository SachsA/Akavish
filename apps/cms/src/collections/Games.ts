import type { CollectionConfig } from 'payload'
import { slugField } from '../fields/slug'

export const Games: CollectionConfig = {
  slug: 'games',
  access: { read: () => true },
  admin: { useAsTitle: 'name' },
  fields: [
    { name: 'name', type: 'text', required: true },
    slugField('name'),
    { name: 'cover', type: 'upload', relationTo: 'media' },
    {
      name: 'platform', type: 'select', hasMany: true,
      options: ['PC', 'PlayStation', 'Xbox', 'Nintendo Switch', 'Mobile'],
    },
    {
      name: 'genre', type: 'select', hasMany: true,
      options: ['FPS', 'RPG', 'Action', 'Strategy', 'Sports', 'MOBA', 'Battle Royale', 'MMO', 'Simulation', 'Other'],
    },
    { name: 'releaseDate', type: 'date', admin: { position: 'sidebar' } },
    { name: 'developer', type: 'text' },
    { name: 'publisher', type: 'text' },
  ],
}
