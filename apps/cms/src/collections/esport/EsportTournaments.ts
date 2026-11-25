import type { CollectionConfig } from 'payload'
import { editors } from '../../access/roles'
import { ESPORT_GAMES, GAME_LABEL, TIERS } from '../../esport/pandascore'

/**
 * Esport tournaments, filled by the PandaScore sync (src/esport/sync.ts). One
 * row per PandaScore tournament (a stage: "Playoffs", "Group A"), with its
 * league and season ("IEM", "Katowice 2027") and its tier (S highest).
 */
export const EsportTournaments: CollectionConfig = {
  slug: 'esport-tournaments',
  labels: { singular: 'Esport tournament', plural: 'Esport tournaments' },
  admin: {
    group: 'Esport',
    useAsTitle: 'name',
    defaultColumns: ['league', 'serie', 'name', 'game', 'tier', 'beginAt'],
    description: 'From PandaScore, every 10 minutes. Read-only: fixes are lost at the next sync.',
  },
  // Public: the site's results and calendar pages read them.
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
    { name: 'name', type: 'text', required: true },
    { name: 'league', type: 'text' },
    { name: 'leagueLogoUrl', type: 'text' },
    { name: 'serie', type: 'text' },
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
    { name: 'beginAt', type: 'date', index: true },
    { name: 'endAt', type: 'date' },
    // The tournament pages (2026-11-25): URL, sibling stages, bracket.
    { name: 'slug', type: 'text', index: true, admin: { readOnly: true } },
    {
      name: 'serieId',
      type: 'number',
      index: true,
      admin: {
        readOnly: true,
        description: 'PandaScore season: the stages of one event share it.',
      },
    },
    { name: 'hasBracket', type: 'checkbox', defaultValue: false, admin: { readOnly: true } },
    {
      name: 'structure',
      type: 'json',
      admin: {
        readOnly: true,
        description:
          'Bracket matches (with the matches they follow from) and standings, from PandaScore (sync.ts).',
      },
    },
    { name: 'structureAt', type: 'date', admin: { readOnly: true } },
  ],
}
