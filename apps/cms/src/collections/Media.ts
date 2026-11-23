import type { CollectionConfig } from 'payload'
import { editors } from '../access/roles'
import { MEDIA_SIZE_FORMAT } from '../lib/media-webp'
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
    //
    // WebP since 2026-11-23 (`MEDIA_SIZE_FORMAT`): 30-40 % lighter than JPEG,
    // far lighter than PNG screenshots. The original stays as uploaded (an
    // archive, and JPEG for the platforms that want it); the site only shows
    // these sizes. `withoutEnlargement: true`: a picture narrower than a size
    // still gets it, at its own width (never upscaled), so every image has
    // all of them in WebP. Before, a 1280 px original had no `hero` and the
    // article top served the original JPEG. Existing images: lib/media-webp.ts.
    imageSizes: [
      // Article cards: ~400 CSS px in a 3-col grid → covers retina (2x).
      { name: 'thumbnail', width: 480, withoutEnlargement: true, formatOptions: MEDIA_SIZE_FORMAT },
      { name: 'card', width: 960, withoutEnlargement: true, formatOptions: MEDIA_SIZE_FORMAT },
      // Article hero: 768 CSS px → 1920 keeps it sharp on retina.
      { name: 'hero', width: 1920, withoutEnlargement: true, formatOptions: MEDIA_SIZE_FORMAT },
      // Author avatars: 80 CSS px, square crop.
      {
        name: 'square',
        width: 256,
        height: 256,
        position: 'centre',
        formatOptions: MEDIA_SIZE_FORMAT,
      },
    ],
    // Show the small variant in the admin list instead of the full-size file.
    adminThumbnail: 'thumbnail',
    focalPoint: true,
  },
}
