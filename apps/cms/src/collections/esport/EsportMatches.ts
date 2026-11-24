import type { CollectionConfig, Field } from 'payload'
import { editors } from '../../access/roles'
import { ESPORT_GAMES, GAME_LABEL, MATCH_STATUSES } from '../../esport/pandascore'

const team = (name: string): Field => ({
  name,
  type: 'group',
  fields: [
    { name: 'pandaId', type: 'number' },
    { name: 'name', type: 'text' },
    { name: 'acronym', type: 'text' },
    { name: 'logoUrl', type: 'text' },
  ],
})

/**
 * Esport matches, filled by the PandaScore sync (src/esport/sync.ts): the
 * last 3 days and the next 7, for CS2, Valorant, LoL, R6 and Rocket League.
 * The site's Results and Calendar pages and the morning recap read them.
 */
export const EsportMatches: CollectionConfig = {
  slug: 'esport-matches',
  labels: { singular: 'Esport match', plural: 'Esport matches' },
  admin: {
    group: 'Esport',
    useAsTitle: 'name',
    defaultColumns: ['name', 'game', 'status', 'beginAt', 'score1', 'score2'],
    description: 'From PandaScore, every 10 minutes. Read-only: fixes are lost at the next sync.',
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
    { name: 'tournament', type: 'relationship', relationTo: 'esport-tournaments', index: true },
    { name: 'name', type: 'text', required: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      index: true,
      options: MATCH_STATUSES.map((s) => ({ label: s.replace('_', ' '), value: s })),
    },
    { name: 'scheduledAt', type: 'date' },
    { name: 'beginAt', type: 'date', index: true },
    { name: 'endAt', type: 'date', index: true },
    { name: 'bestOf', type: 'number' },
    team('team1'),
    team('team2'),
    { name: 'score1', type: 'number' },
    { name: 'score2', type: 'number' },
    {
      name: 'winner',
      type: 'number',
      admin: { description: '1 or 2; empty before the end or for a draw.' },
    },
    { name: 'forfeit', type: 'checkbox', defaultValue: false },
    { name: 'draw', type: 'checkbox', defaultValue: false },
    { name: 'streamUrl', type: 'text' },
    { name: 'modifiedAt', type: 'date' },
  ],
}
