import type { CollectionConfig } from 'payload'
import { editors } from '../../access/roles'
import { ESPORT_GAMES, GAME_LABEL, TIERS } from '../../esport/pandascore'

/**
 * Esport teams (2026-11-27), from PandaScore (one row per PandaScore team: a
 * club has one per game): every team that played a tier S / A / B edition,
 * with its current roster. One page each on the site
 * (/esport/teams/<slug>). Filled by src/esport/competitions-sync.ts; only the
 * aliases are editors'.
 */
export const EsportTeams: CollectionConfig = {
  slug: 'esport-teams',
  labels: { singular: 'Esport team', plural: 'Esport teams' },
  admin: {
    group: 'Esport',
    useAsTitle: 'name',
    defaultColumns: ['name', 'acronym', 'game', 'tier', 'lastAt'],
    description:
      'From PandaScore, every hour. Only the aliases are yours: the rest is rewritten by the sync.',
  },
  access: { read: () => true, create: () => false, update: editors, delete: editors },
  // What an article, an edition's winner or a lineup shows of a team: never its roster.
  defaultPopulate: {
    pandaId: true,
    game: true,
    name: true,
    acronym: true,
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
      index: true,
      options: ESPORT_GAMES.map((g) => ({ label: GAME_LABEL[g], value: g })),
    },
    { name: 'name', type: 'text', required: true },
    { name: 'acronym', type: 'text' },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      index: true,
      admin: { readOnly: true, description: 'The page: /esport/teams/<slug> ("cs2-vitality").' },
    },
    { name: 'pandaSlug', type: 'text', admin: { readOnly: true } },
    { name: 'logoUrl', type: 'text' },
    { name: 'location', type: 'text', admin: { description: 'Country code (FR, DE…).' } },
    {
      name: 'tier',
      type: 'select',
      index: true,
      defaultValue: 'unranked',
      admin: { description: 'Best tier played in the last two years.' },
      options: TIERS.map((t) => ({
        label: t === 'unranked' ? 'Unranked' : t.toUpperCase(),
        value: t,
      })),
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
        description:
          'Other names articles use ("NaVi", "Les Bleus de Vitality"): an article naming one gets this team ticked.',
      },
    },
    {
      name: 'players',
      type: 'json',
      admin: {
        readOnly: true,
        description: 'Current roster from PandaScore: nickname, real name, country, role.',
      },
    },
    { name: 'playersAt', type: 'date', admin: { readOnly: true } },
  ],
}
