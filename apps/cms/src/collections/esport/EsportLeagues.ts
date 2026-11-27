import type { CollectionConfig } from 'payload'
import { editors } from '../../access/roles'
import { ESPORT_GAMES, GAME_LABEL, TIERS } from '../../esport/pandascore'

/**
 * Esport competitions (PandaScore "leagues": PGL Major, IEM, VCT, Worlds…),
 * tier S / A / B, filled every hour by src/esport/competitions-sync.ts. One
 * page each on the site (/esport/competitions/<slug>): its editions and their
 * winners, its news. `aliases` (editable) are the other names articles use,
 * to tick the competition on them automatically.
 */
export const EsportLeagues: CollectionConfig = {
  slug: 'esport-leagues',
  labels: { singular: 'Esport competition', plural: 'Esport competitions' },
  admin: {
    group: 'Esport',
    useAsTitle: 'name',
    defaultColumns: ['name', 'game', 'tier', 'lastAt'],
    description:
      'From PandaScore, every hour (tier S, A and B). Only the aliases are yours: the rest is rewritten by the sync.',
  },
  access: { read: () => true, create: () => false, update: editors, delete: editors },
  // What an article or an edition shows of its competition.
  defaultPopulate: {
    pandaId: true,
    game: true,
    name: true,
    slug: true,
    logoUrl: true,
    aliases: true,
  },
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
    { name: 'name', type: 'text', required: true },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { readOnly: true, description: 'The page: /esport/competitions/<slug>.' },
    },
    { name: 'pandaSlug', type: 'text', admin: { readOnly: true } },
    { name: 'logoUrl', type: 'text' },
    {
      name: 'tier',
      type: 'select',
      required: true,
      index: true,
      defaultValue: 'unranked',
      admin: { description: 'Its best edition’s tier.' },
      options: TIERS.map((t) => ({
        label: t === 'unranked' ? 'Unranked' : t.toUpperCase(),
        value: t,
      })),
    },
    {
      name: 'aliases',
      type: 'text',
      hasMany: true,
      admin: {
        description:
          'Other names articles use ("Worlds", "Major de Singapour"): an article naming one gets this competition ticked.',
      },
    },
    {
      name: 'lastAt',
      type: 'date',
      index: true,
      admin: { readOnly: true, description: 'Start of its latest edition.' },
    },
    {
      name: 'latest',
      type: 'json',
      admin: {
        readOnly: true,
        description: 'Its latest edition and winner, for the competitions list (the sync).',
      },
    },
  ],
}
