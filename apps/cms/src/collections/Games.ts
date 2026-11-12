import type { CollectionConfig } from 'payload'
import { revalidateAfterChange, revalidateAfterDelete } from '../lib/revalidate-web'
import { slugField } from '../fields/slug'

export const Games: CollectionConfig = {
  slug: 'games',
  // The website shows these: refresh its cache on change (lib/revalidate-web.ts).
  hooks: { afterChange: [revalidateAfterChange], afterDelete: [revalidateAfterDelete] },
  access: { read: () => true },
  admin: { useAsTitle: 'name' },
  fields: [
    { name: 'name', type: 'text', required: true },
    slugField('name'),
    { name: 'cover', type: 'upload', relationTo: 'media' },
    {
      // More official visuals of the game (key art, trailer stills). The AI
      // scout rotates through cover + these so a game in the news every day
      // doesn't get the same picture on every article (scout/media.ts).
      name: 'gallery',
      label: 'Other images',
      type: 'upload',
      relationTo: 'media',
      hasMany: true,
      admin: {
        description: 'Official visuals the AI scout can use as article covers, after the main cover.',
      },
    },
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
