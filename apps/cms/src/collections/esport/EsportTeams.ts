import type { CollectionConfig } from 'payload'
import { editors } from '../../access/roles'
import { ESPORT_GAMES, GAME_LABEL } from '../../esport/pandascore'

/**
 * Esport teams, from PandaScore (one row per PandaScore team: a club has one
 * per game). Since 2026-11-27 the winners of the competitions
 * (src/esport/competitions-sync.ts); the team pages will add the others.
 */
export const EsportTeams: CollectionConfig = {
  slug: 'esport-teams',
  labels: { singular: 'Esport team', plural: 'Esport teams' },
  admin: {
    group: 'Esport',
    useAsTitle: 'name',
    defaultColumns: ['name', 'acronym', 'game', 'location'],
    description: 'From PandaScore. Read-only: fixes are lost at the next sync.',
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
      index: true,
      options: ESPORT_GAMES.map((g) => ({ label: GAME_LABEL[g], value: g })),
    },
    { name: 'name', type: 'text', required: true },
    { name: 'acronym', type: 'text' },
    { name: 'slug', type: 'text', index: true, admin: { readOnly: true } },
    { name: 'logoUrl', type: 'text' },
    { name: 'location', type: 'text', admin: { description: 'Country code (FR, DE…).' } },
  ],
}
