import type { CollectionConfig } from 'payload'
import { editors } from '../../access/roles'
import { ESPORT_GAMES, GAME_LABEL } from '../../esport/pandascore'

/**
 * Esport players (2026-11-27, step 3), from PandaScore: everyone in a lineup
 * of a tier S / A / B edition (esport-lineups) or in a team's current roster.
 * One page each on the site (/esport/players/<slug>). No photo. Filled by
 * src/esport/competitions-sync.ts; only the aliases are editors'.
 */
export const EsportPlayers: CollectionConfig = {
  slug: 'esport-players',
  labels: { singular: 'Esport player', plural: 'Esport players' },
  admin: {
    group: 'Esport',
    useAsTitle: 'name',
    defaultColumns: ['name', 'game', 'currentTeam', 'nationality', 'lastAt'],
    description:
      'From PandaScore, every hour. Only the aliases are yours: the rest is rewritten by the sync.',
  },
  access: { read: () => true, create: () => false, update: editors, delete: editors },
  // What an article or a lineup shows of a player.
  defaultPopulate: { pandaId: true, name: true, slug: true, game: true, aliases: true },
  fields: [
    {
      name: 'pandaId',
      type: 'number',
      required: true,
      unique: true,
      index: true,
      admin: { readOnly: true },
    },
    { name: 'name', type: 'text', required: true, admin: { description: 'Nickname ("ZywOo").' } },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      index: true,
      admin: { readOnly: true, description: 'The page: /esport/players/<slug> ("zywoo").' },
    },
    { name: 'firstName', type: 'text' },
    { name: 'lastName', type: 'text' },
    { name: 'nationality', type: 'text', admin: { description: 'Country code (FR…).' } },
    { name: 'role', type: 'text' },
    {
      name: 'game',
      type: 'select',
      index: true,
      options: ESPORT_GAMES.map((g) => ({ label: GAME_LABEL[g], value: g })),
    },
    {
      name: 'currentTeam',
      type: 'relationship',
      relationTo: 'esport-teams',
      index: true,
      admin: { description: "In this team's current roster (PandaScore)." },
    },
    {
      name: 'lastTeam',
      type: 'relationship',
      relationTo: 'esport-teams',
      admin: { description: 'The team of its latest lineup.' },
    },
    {
      name: 'lastAt',
      type: 'date',
      index: true,
      admin: { readOnly: true, description: 'Start of the latest edition it played.' },
    },
    {
      name: 'aliases',
      type: 'text',
      hasMany: true,
      admin: {
        description: 'Other names articles use: an article naming one gets this player ticked.',
      },
    },
  ],
}
