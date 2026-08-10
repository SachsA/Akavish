import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
  ],
  upload: {
    mimeTypes: ['image/*'],
    // Sharp generates these variants on upload, sized against how the web app
    // actually displays media (see apps/web `sizes` props). Heights are omitted
    // so each variant keeps the original aspect ratio — the collection holds
    // both 16:9 article covers and 3:4 game covers.
    imageSizes: [
      // Article cards: ~400 CSS px in a 3-col grid → covers retina (2x).
      { name: 'thumbnail', width: 480 },
      { name: 'card', width: 960 },
      // Article hero: 768 CSS px → 1920 keeps it sharp on retina.
      { name: 'hero', width: 1920 },
      // Author avatars: 80 CSS px, square crop.
      { name: 'square', width: 256, height: 256, position: 'centre' },
    ],
    // Show the small variant in the admin list instead of the full-size file.
    adminThumbnail: 'thumbnail',
    focalPoint: true,
  },
}
