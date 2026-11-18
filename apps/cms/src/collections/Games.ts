import type { CollectionConfig } from 'payload'
import { revalidateAfterChange, revalidateAfterDelete } from '../lib/revalidate-web'
import { slugField } from '../fields/slug'
import { editors } from '../access/roles'
import { cleanReleases, summarize } from '../lib/game-releases'
import { DATE_PRECISIONS, PLATFORMS } from '../lib/platforms'

export const Games: CollectionConfig = {
  slug: 'games',
  // The website shows these: refresh its cache on change (lib/revalidate-web.ts).
  hooks: {
    // The consoles and first date shown on the site come from the releases.
    beforeChange: [
      ({ data, originalDoc }) => {
        const rows = data.releases ?? originalDoc?.releases
        const releases = cleanReleases(rows)
        if (Array.isArray(data.releases)) {
          data.releases = data.releases.map((row: Record<string, unknown>, i: number) => ({
            ...row,
            precision: releases[i].precision,
            date: releases[i].date,
          }))
        }
        Object.assign(data, summarize(releases))
        return data
      },
    ],
    afterChange: [revalidateAfterChange],
    // Readers following it stop following it (the link can't point to nothing).
    beforeDelete: [
      async ({ id, req }) => {
        await req.payload.delete({
          collection: 'game-follows' as never,
          where: { game: { equals: id } },
          overrideAccess: true,
          req,
        })
      },
    ],
    afterDelete: [revalidateAfterDelete],
  },
  access: { read: () => true, delete: editors },
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'platforms', 'releaseDate', 'updatedAt'] },
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
      // One row per release: the consoles it came out on together, the date
      // and how precise it is. A port or a later console is its own row
      // (Cyberpunk 2077: PC/PS4/Xbox One 2020, PS5/Xbox Series 2022, Switch 2
      // 2025). The site's library filters on these (lib/game-releases.ts).
      name: 'releases',
      type: 'array',
      labels: { singular: 'Release', plural: 'Releases' },
      admin: {
        description:
          'Une ligne par sortie : les consoles sorties ensemble, la date et sa précision. Un portage ou une nouvelle console = une nouvelle ligne. Le scout met ces lignes à jour quand une news annonce une date, un report ou une console.',
      },
      fields: [
        {
          name: 'platforms',
          type: 'select',
          hasMany: true,
          options: PLATFORMS.map((p) => ({ label: p.label, value: p.value })),
          admin: { description: 'Vide = consoles pas encore annoncées.' },
        },
        {
          type: 'row',
          fields: [
            {
              name: 'precision',
              type: 'select',
              required: true,
              defaultValue: 'day',
              options: [
                { label: 'Day (19 Nov 2026)', value: 'day' },
                { label: 'Month (November 2026)', value: 'month' },
                { label: 'Quarter (Q4 2026)', value: 'quarter' },
                { label: 'Year (2026)', value: 'year' },
                { label: 'TBA', value: 'tba' },
              ],
            },
            {
              name: 'date',
              type: 'date',
              admin: {
                date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' },
                description: 'Mois, trimestre ou année : n’importe quel jour dedans. Vide si TBA.',
                condition: (_, row) => row?.precision !== 'tba',
              },
            },
          ],
        },
      ],
    },
    {
      // Derived from the releases on save (read-only): every console and the
      // first known date. The site sorts and filters on these.
      name: 'platforms',
      type: 'select',
      hasMany: true,
      options: PLATFORMS.map((p) => ({ label: p.label, value: p.value })),
      admin: { readOnly: true, position: 'sidebar', description: 'Calculé depuis les sorties.' },
    },
    {
      name: 'releaseDate',
      type: 'date',
      admin: { readOnly: true, position: 'sidebar', description: 'Première sortie, calculée.' },
    },
    {
      name: 'releaseDatePrecision',
      type: 'select',
      options: [...DATE_PRECISIONS],
      admin: { readOnly: true, position: 'sidebar' },
    },
    { name: 'developers', type: 'relationship', relationTo: 'companies', hasMany: true },
    { name: 'publishers', type: 'relationship', relationTo: 'companies', hasMany: true },
    {
      name: 'genre', type: 'select', hasMany: true,
      options: ['FPS', 'RPG', 'Action', 'Strategy', 'Sports', 'MOBA', 'Battle Royale', 'MMO', 'Simulation', 'Other'],
    },
  ],
}
