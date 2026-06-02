import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
  slug: 'media',
  upload: {
    staticDir: 'public/media',
    mimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
  },
  fields: [{ name: 'alt', type: 'text', required: true }],
}
