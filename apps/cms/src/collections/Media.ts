import type { CollectionConfig } from 'payload'
import { editors } from '../access/roles'
import { revalidateAfterUpdate } from '../lib/revalidate-web'

export const Media: CollectionConfig = {
  slug: 'media',
  // A new credit or alt text shows at once on the pages using the image.
  hooks: { afterChange: [revalidateAfterUpdate] },
  access: {
    read: () => true,
    delete: editors,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
    {
      // The alt text on the French site, filled by Claude when an article
      // using this image is translated (lib/translate.ts). Empty → English.
      name: 'altFr',
      type: 'text',
      label: 'Alt (French)',
    },
    {
      // Shown under the cover on the site ("Photo: BLAST / Luc Bouchon").
      // Required in practice for any photo that isn't ours or official key
      // art handed out for press use.
      name: 'credit',
      type: 'text',
      label: 'Credit',
      admin: {
        description:
          'Crédit affiché sous l’image : « BLAST / Luc Bouchon », « Riot Games »… Le mot « Photo » est ajouté par le site. Vide = pas de crédit.',
      },
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
