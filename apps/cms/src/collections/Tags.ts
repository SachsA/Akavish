import type { CollectionConfig } from 'payload'
import { revalidateAfterChange, revalidateAfterDelete } from '../lib/revalidate-web'
import { slugField } from '../fields/slug'
import { editors } from '../access/roles'

export const Tags: CollectionConfig = {
  slug: 'tags',
  // The website shows these: refresh its cache on change (lib/revalidate-web.ts).
  hooks: {
    afterChange: [
      revalidateAfterChange,
      // A new tag (often created by the scout) gets its French name on the
      // translate queue (lib/translate.ts → translateTaxonomy).
      async ({ doc, operation, req }) => {
        if (operation !== 'create' || doc.nameFr) return doc
        await req.payload.jobs.queue({
          task: 'translateTaxonomy',
          input: {},
          queue: 'translate',
          req,
        })
        return doc
      },
    ],
    afterDelete: [revalidateAfterDelete],
  },
  access: { read: () => true, delete: editors },
  admin: { useAsTitle: 'name' },
  fields: [
    { name: 'name', type: 'text', required: true, unique: true },
    {
      // The French site's name for it, filled by Claude (lib/translate.ts);
      // editable. Empty → the English name.
      name: 'nameFr',
      type: 'text',
      label: 'Name (French)',
      admin: { description: 'Rempli automatiquement en français, modifiable. Vide = nom anglais.' },
    },
    slugField('name'),
  ],
}
