import type { CollectionConfig } from 'payload'
import { revalidateAfterChange, revalidateAfterDelete } from '../lib/revalidate-web'
import { slugField } from '../fields/slug'
import { editors } from '../access/roles'
import { PLATFORM_FAMILIES } from '../lib/platforms'

/**
 * Consoles (and PC, mobile, VR). A game's releases link to them, each has a
 * page on the site (/platform/<slug>: its games, by release date, and the
 * articles tagged with it), and the games library filters on them. The scout
 * creates the ones a news story names for the first time (a PS6 reveal).
 */
export const Platforms: CollectionConfig = {
  slug: 'platforms',
  labels: { singular: 'Platform', plural: 'Platforms' },
  hooks: { afterChange: [revalidateAfterChange], afterDelete: [revalidateAfterDelete] },
  access: { read: () => true, delete: editors },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'short', 'family', 'slug'],
    description: 'Consoles (et PC, mobile, VR). Les sorties des jeux pointent ici ; chaque console a sa page sur le site.',
  },
  defaultSort: 'position',
  fields: [
    { name: 'name', type: 'text', required: true, unique: true, admin: { description: 'Nom complet : « PlayStation 5 ».' } },
    slugField('name'),
    {
      name: 'short',
      type: 'text',
      admin: { description: 'Nom court affiché sur le site : « PS5 ». Vide = le nom complet.' },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'family',
          type: 'select',
          required: true,
          defaultValue: 'other',
          options: [...PLATFORM_FAMILIES],
          admin: { description: 'Le groupe dans le filtre de la bibliothèque.' },
        },
        {
          name: 'position',
          type: 'number',
          defaultValue: 0,
          admin: { description: 'Ordre dans la famille, la plus récente d’abord (0 = en tête).' },
        },
      ],
    },
    {
      // Other names ("PS6", "PlayStation 6"): the scout matches them instead
      // of creating a duplicate.
      name: 'aliases',
      type: 'text',
      hasMany: true,
      admin: { description: 'Autres noms (« PS6 »). Le scout les reconnaît au lieu de créer un doublon.' },
    },
    {
      // The console's own release, as precise as it's known ("Holiday 2027"
      // is a quarter). The scout fills it from an official announcement.
      type: 'row',
      fields: [
        {
          name: 'releasePrecision',
          type: 'select',
          defaultValue: 'tba',
          options: [
            { label: 'Day (19 Nov 2027)', value: 'day' },
            { label: 'Month (November 2027)', value: 'month' },
            { label: 'Quarter (Q4 2027)', value: 'quarter' },
            { label: 'Year (2027)', value: 'year' },
            { label: 'TBA', value: 'tba' },
          ],
        },
        {
          name: 'releaseDate',
          label: 'Release date',
          type: 'date',
          admin: {
            date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' },
            description: 'Sortie de la console. Mois, trimestre ou année : n’importe quel jour dedans.',
            condition: (_, data) => data?.releasePrecision !== 'tba',
          },
        },
      ],
    },
    { name: 'logo', type: 'upload', relationTo: 'media' },
    {
      // The articles tagged with it show on the console's page.
      name: 'tag',
      type: 'relationship',
      relationTo: 'tags',
      admin: { description: 'Le tag de la console (« PS5 »), s’il existe : ses articles apparaissent sur la page.' },
    },
  ],
}
