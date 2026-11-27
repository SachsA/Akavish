import { describe, expect, it } from 'vitest'
import {
  detectPlayers,
  detectTeams,
  lineupsOf,
  playerOf,
  playerSlug,
  teamNames,
  teamSlug,
  teamStanding,
  type RawTournamentWithRosters,
} from './teams'

const navi = {
  id: 3216,
  name: 'Natus Vincere',
  acronym: 'NAVI',
  slug: 'natus-vincere-cs-go',
  image_url: 'x',
  location: 'UA',
}
const player = (id: number, name: string) => ({
  id,
  name,
  first_name: 'A',
  last_name: 'B',
  nationality: 'UA',
  role: null,
})

const stage = (
  id: number,
  serie: number,
  at: string,
  players: string[],
): RawTournamentWithRosters => ({
  id,
  begin_at: at,
  serie: { id: serie },
  league: { id: 1 },
  expected_roster: [{ team: navi, players: players.map((n, i) => player(i + 1, n)) }],
})

describe('teamSlug and playerOf', () => {
  it('puts the game first', () => {
    expect(teamSlug('cs2', 'Natus Vincere')).toBe('cs2-natus-vincere')
    expect(teamSlug('lol', 'Gen.G')).toBe('lol-gen-g')
  })
  it('keeps what a player page needs, nothing without an id and a name', () => {
    expect(
      playerOf({
        id: 1,
        name: 'Aleksib',
        first_name: 'Aleksi',
        last_name: 'Virolainen',
        nationality: 'FI',
        role: null,
      }),
    ).toEqual({
      pandaId: 1,
      name: 'Aleksib',
      firstName: 'Aleksi',
      lastName: 'Virolainen',
      nationality: 'FI',
      role: null,
    })
    expect(playerOf({ name: 'x' })).toBeNull()
  })
})

describe('lineupsOf', () => {
  it('keeps one lineup per team and edition, the latest stage’s, for the editions kept', () => {
    const { teams, lineups } = lineupsOf(
      [
        stage(1, 10, '2026-11-01T00:00:00Z', ['a', 'b']),
        stage(2, 10, '2026-11-05T00:00:00Z', ['a', 'c']),
        stage(3, 99, '2026-11-05T00:00:00Z', ['z']),
      ],
      'cs2',
      new Set([10]),
    )
    expect([...teams.values()].map((t) => [t.name, t.pandaSlug, t.location])).toEqual([
      ['Natus Vincere', 'natus-vincere-cs-go', 'UA'],
    ])
    expect([...lineups.keys()]).toEqual(['10:3216'])
    expect(lineups.get('10:3216')!.players.map((p) => p.name)).toEqual(['a', 'c'])
  })
})

describe('teamStanding', () => {
  it('takes the best tier of the last two years and the latest date', () => {
    const now = new Date('2026-11-27T00:00:00Z')
    expect(
      teamStanding(
        [
          { tier: 's', beginAt: '2020-01-01T00:00:00Z' },
          { tier: 'b', beginAt: '2026-06-01T00:00:00Z' },
          { tier: 'a', beginAt: '2026-10-01T00:00:00Z' },
        ],
        now,
      ),
    ).toEqual({ tier: 'a', lastAt: '2026-10-01T00:00:00Z' })
    expect(teamStanding([{ tier: 's', beginAt: '2019-01-01T00:00:00Z' }], now)).toEqual({
      tier: 's',
      lastAt: '2019-01-01T00:00:00Z',
    })
  })
})

describe('teamNames', () => {
  it('writes a team the ways headlines do', () => {
    expect(teamNames('Team Vitality', 'VIT')).toEqual(
      expect.arrayContaining(['Team Vitality', 'Vitality', 'VITALITY', 'VIT']),
    )
    expect(teamNames('FURIA Esports', 'FURIA')).toContain('FURIA')
    expect(teamNames('fnatic', 'FNC')).toEqual(expect.arrayContaining(['Fnatic', 'FNATIC', 'FNC']))
    expect(teamNames('T1', 'T1')).toEqual(['T1'])
    // Short acronyms without a digit read as words: left out.
    expect(teamNames('Gen.G', 'GE')).not.toContain('GE')
  })
})

describe('detectTeams', () => {
  const teams = [
    { id: 1, game: 'cs2' as const, names: teamNames('Spirit', 'TS') },
    { id: 2, game: 'cs2' as const, names: teamNames('MOUZ', 'MOUZ') },
    { id: 3, game: 'cs2' as const, names: teamNames('Eternal Fire', 'EF') },
    { id: 4, game: 'cs2' as const, names: teamNames('Fire', null) },
    { id: 5, game: 'lol' as const, names: teamNames('T1', 'T1') },
    { id: 6, game: 'valorant' as const, names: teamNames('T1', 'T1') },
    { id: 7, game: 'cs2' as const, names: teamNames('Heroic', 'HERO') },
  ]
  it('finds names as written, capitals too, not plain words', () => {
    expect(detectTeams('Spirit beat MOUZ to reach the final', teams, 'cs2')).toEqual([1, 2])
    expect(detectTeams('Imperial beat HEROIC 13-6', teams, 'cs2')).toEqual([7])
    expect(detectTeams('the spirit of the game', teams, 'cs2')).toEqual([])
  })
  it("keeps the article's game; without one, a shared name counts for none", () => {
    expect(detectTeams('T1 re-signs Zeus', teams, 'lol')).toEqual([5])
    expect(detectTeams('T1 re-signs Zeus', teams, null)).toEqual([])
  })
  it('drops a name found inside a longer one found', () => {
    expect(detectTeams('Eternal Fire reach Stage 2', teams, 'cs2')).toEqual([3])
  })
})

describe('players', () => {
  it('slugs a nickname', () => {
    expect(playerSlug('ZywOo')).toBe('zywoo')
    expect(playerSlug('s1mple')).toBe('s1mple')
    expect(playerSlug('???')).toBe('player')
  })
  const players = [
    { id: 1, game: 'cs2' as const, names: ['NiKo'], teams: [10] },
    { id: 2, game: 'cs2' as const, names: ['frozen'], teams: [20] },
    { id: 3, game: 'lol' as const, names: ['Zeus'], teams: [30] },
    { id: 4, game: 'cs2' as const, names: ['karrigan'], teams: [20] },
  ]
  it('finds nicknames with a capital or a digit on their own', () => {
    expect(detectPlayers('NiKo to become IGL', players, 'cs2', [])).toEqual([1])
    expect(detectPlayers('T1 re-signs Zeus', players, 'cs2', [])).toEqual([])
    expect(detectPlayers('T1 re-signs Zeus', players, 'lol', [])).toEqual([3])
  })
  it('a plain-word nickname only with one of its teams named', () => {
    expect(detectPlayers('a frozen lake, karrigan benched', players, 'cs2', [])).toEqual([])
    expect(detectPlayers('FaZe bench karrigan; frozen stays', players, 'cs2', [20])).toEqual([2, 4])
  })
})
