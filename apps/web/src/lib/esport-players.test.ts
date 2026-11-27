import { describe, expect, it } from 'vitest'
import { career, playerOf, playerTitles, teamNow } from './esport-players'
import type { Lineup } from './esport-teams'

const team = (id: number, name: string) => ({ pandaId: id, name, acronym: null, logo: null, slug: `cs2-${name.toLowerCase()}` })
const lineup = (at: string, t: ReturnType<typeof team> | null, winner: number | null = null): Lineup => ({
  edition: {
    id: at,
    pandaId: 1,
    game: 'cs2',
    name: at,
    beginAt: at,
    endAt: at,
    tier: 's',
    winner: winner == null ? null : team(winner, 'W'),
    prizePool: null,
    country: null,
    stages: [],
    competition: null,
  },
  players: [],
  team: t,
})

describe('playerOf', () => {
  it('maps a player with its teams, nothing without a slug', () => {
    const p = playerOf({ id: 3, pandaId: 11, slug: 'zywoo', name: 'ZywOo', firstName: 'Mathieu', nationality: 'FR', game: 'cs2', currentTeam: { pandaId: 3455, name: 'Vitality', slug: 'cs2-vitality' } })
    expect(p).toMatchObject({ id: '3', slug: 'zywoo', firstName: 'Mathieu', game: 'cs2', currentTeam: { name: 'Vitality', slug: 'cs2-vitality' } })
    expect(playerOf({ id: 4, pandaId: 1, name: 'x' })).toBeNull()
  })
})

describe('career and titles', () => {
  const a = team(1, 'Alpha')
  const b = team(2, 'Beta')
  const lineups = [lineup('2024-01-01', a, 1), lineup('2024-06-01', a), lineup('2025-01-01', b, 2), lineup('2025-03-01', b, 9), lineup('2023-01-01', null)]
  it('goes team by team, latest first', () => {
    expect(career(lineups).map((s) => [s.team.name, s.from, s.to, s.editions])).toEqual([
      ['Beta', '2025-01-01', '2025-03-01', 2],
      ['Alpha', '2024-01-01', '2024-06-01', 2],
    ])
  })
  it('counts the editions its team won', () => {
    expect(playerTitles(lineups).map((l) => l.edition.beginAt)).toEqual(['2025-01-01', '2024-01-01'])
  })
})

describe('teamNow', () => {
  const now = new Date('2026-11-27T00:00:00Z')
  const base = { id: '1', pandaId: 1, slug: 'x', name: 'x', firstName: null, lastName: null, nationality: null, role: null, game: 'lol' as const }
  const t1 = { pandaId: 9, name: 'T1', acronym: null, logo: null }
  it('takes the roster, else a recent last team', () => {
    expect(teamNow({ ...base, currentTeam: t1, lastTeam: null, lastAt: null }, now)).toEqual({ team: t1, current: true })
    expect(teamNow({ ...base, currentTeam: null, lastTeam: t1, lastAt: '2026-10-15T00:00:00Z' }, now)).toEqual({ team: t1, current: false })
    expect(teamNow({ ...base, currentTeam: null, lastTeam: t1, lastAt: '2024-10-15T00:00:00Z' }, now)).toBeNull()
  })
})
