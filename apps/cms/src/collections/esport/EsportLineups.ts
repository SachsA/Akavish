import type { CollectionConfig } from 'payload'
import { editors } from '../../access/roles'
import { ESPORT_GAMES, GAME_LABEL, TIERS } from '../../esport/pandascore'

/**
 * Who played each esport edition (2026-11-27): one row per team and edition,
 * with its players as they were then (PandaScore's `expected_roster`). The
 * team pages' history and roster changes; the player pages next. Filled by
 * src/esport/competitions-sync.ts.
 */
export const EsportLineups: CollectionConfig = {
  slug: 'esport-lineups',
  labels: { singular: 'Esport lineup', plural: 'Esport lineups' },
  admin: {
    group: 'Esport',
    useAsTitle: 'key',
    defaultColumns: ['team', 'series', 'game', 'beginAt'],
    description: 'From PandaScore, every hour. Read-only: fixes are lost at the next sync.',
  },
  access: { read: () => true, create: () => false, update: editors, delete: editors },
  fields: [
    {
      name: 'key',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { readOnly: true, description: 'PandaScore serie id : team id.' },
    },
    { name: 'team', type: 'relationship', relationTo: 'esport-teams', index: true },
    { name: 'series', type: 'relationship', relationTo: 'esport-series', index: true },
    {
      name: 'game',
      type: 'select',
      required: true,
      index: true,
      options: ESPORT_GAMES.map((g) => ({ label: GAME_LABEL[g], value: g })),
    },
    {
      name: 'tier',
      type: 'select',
      defaultValue: 'unranked',
      options: TIERS.map((t) => ({
        label: t === 'unranked' ? 'Unranked' : t.toUpperCase(),
        value: t,
      })),
    },
    { name: 'beginAt', type: 'date', index: true },
    {
      // The same players as rows: a player page finds its lineups (2026-11-27).
      name: 'members',
      type: 'relationship',
      relationTo: 'esport-players',
      hasMany: true,
      admin: { readOnly: true },
    },
    {
      name: 'players',
      type: 'json',
      admin: { readOnly: true, description: 'Nickname, real name, country, role, PandaScore id.' },
    },
  ],
}
