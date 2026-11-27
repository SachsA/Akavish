import type { CollectionConfig } from 'payload'
import { editors } from '../../access/roles'
import { ESPORT_GAMES, GAME_LABEL, TIERS } from '../../esport/pandascore'

/**
 * Editions of the esport competitions (PandaScore "series": Singapore 2026,
 * Beijing 2026…), tier S / A / B, with their stages and their winner.
 * Filled every hour by src/esport/competitions-sync.ts, all the history at
 * the first run.
 */
export const EsportSeries: CollectionConfig = {
  slug: 'esport-series',
  labels: { singular: 'Esport edition', plural: 'Esport editions' },
  admin: {
    group: 'Esport',
    useAsTitle: 'name',
    defaultColumns: ['name', 'league', 'game', 'tier', 'beginAt', 'winner'],
    description: 'From PandaScore, every hour. Read-only: fixes are lost at the next sync.',
  },
  access: { read: () => true, create: () => false, update: editors, delete: editors },
  fields: [
    {
      name: 'pandaId',
      type: 'number',
      required: true,
      unique: true,
      index: true,
      admin: { readOnly: true },
    },
    {
      name: 'game',
      type: 'select',
      required: true,
      index: true,
      options: ESPORT_GAMES.map((g) => ({ label: GAME_LABEL[g], value: g })),
    },
    { name: 'league', type: 'relationship', relationTo: 'esport-leagues', index: true },
    { name: 'name', type: 'text', required: true },
    { name: 'year', type: 'number' },
    { name: 'slug', type: 'text', admin: { readOnly: true } },
    { name: 'beginAt', type: 'date', index: true },
    { name: 'endAt', type: 'date', index: true },
    {
      name: 'tier',
      type: 'select',
      required: true,
      index: true,
      defaultValue: 'unranked',
      options: TIERS.map((t) => ({
        label: t === 'unranked' ? 'Unranked' : t.toUpperCase(),
        value: t,
      })),
    },
    { name: 'winner', type: 'relationship', relationTo: 'esport-teams' },
    {
      name: 'prizePool',
      type: 'text',
      admin: { description: 'Its biggest stage’s prize pool, as PandaScore writes it.' },
    },
    { name: 'country', type: 'text', admin: { description: 'Where it’s played (country code).' } },
    {
      name: 'stages',
      type: 'json',
      admin: {
        readOnly: true,
        description: 'Its stages (PandaScore tournaments): name, slug, tier, dates, winner id.',
      },
    },
  ],
}
