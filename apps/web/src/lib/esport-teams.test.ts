import { describe, expect, it } from 'vitest'
import { lineupOf, rosterHistory, rosterMoves, teamNames, teamOf, type Lineup } from './esport-teams'

const p = (id: number, name: string) => ({ pandaId: id, name, firstName: null, lastName: null, nationality: 'FR', role: null })

const lineup = (at: string, ids: number[]): Lineup => ({
  edition: {
    id: at,
    pandaId: 1,
    game: 'cs2',
    name: at,
    beginAt: at,
    endAt: at,
    tier: 's',
    winner: null,
    prizePool: null,
    country: null,
    stages: [],
    competition: null,
  },
  players: ids.map((i) => p(i, `p${i}`)),
})

describe('teamOf / lineupOf', () => {
  it('maps a team with its roster, nothing without a slug', () => {
    const t = teamOf({ id: 4, pandaId: 3216, slug: 'cs2-natus-vincere', game: 'cs2', name: 'Natus Vincere', acronym: 'NAVI', tier: 's', players: [p(1, 'Aleksib'), { name: 'no id' }] })
    expect(t).toMatchObject({ id: '4', slug: 'cs2-natus-vincere', acronym: 'NAVI', tier: 's' })
    expect(t?.players.map((x) => x.name)).toEqual(['Aleksib'])
    expect(teamOf({ id: 5, pandaId: 1, game: 'cs2', name: 'X' })).toBeNull()
  })
  it('maps a lineup with its edition', () => {
    const l = lineupOf({ players: [p(1, 'a')], series: { id: 9, pandaId: 10, game: 'cs2', name: 'Singapore 2026', league: { slug: 'cs2-pgl-major', name: 'PGL Major', game: 'cs2' } } })
    expect(l?.edition.competition?.slug).toBe('cs2-pgl-major')
    expect(lineupOf({ players: [] })).toBeNull()
  })
})

describe('rosterHistory', () => {
  it('makes one period of consecutive editions with the same players, latest first', () => {
    const h = rosterHistory([
      lineup('2026-01-01', [1, 2, 3, 4, 5]),
      lineup('2026-03-01', [5, 4, 3, 2, 1]),
      lineup('2026-06-01', [1, 2, 3, 4, 6]),
      lineup('2026-02-01', []),
    ])
    expect(h.map((x) => [x.from, x.to, x.editions])).toEqual([
      ['2026-06-01', '2026-06-01', 1],
      ['2026-01-01', '2026-03-01', 2],
    ])
    expect(rosterMoves(h[0], h[1])).toEqual({ joined: [p(6, 'p6')], left: [p(5, 'p5')] })
  })
})

describe('teamNames', () => {
  it('matches the CMS rule', () => {
    expect(teamNames('Team Vitality', 'VIT')).toEqual(expect.arrayContaining(['Vitality', 'VITALITY', 'VIT']))
    expect(teamNames('T1', 'T1')).toEqual(['T1'])
  })
})
