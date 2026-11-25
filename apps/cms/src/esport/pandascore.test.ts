import { describe, expect, it } from 'vitest'
import {
  bracketOf,
  matchOf,
  standingsOf,
  syncUrls,
  tierOf,
  tournamentOf,
  type RawMatch,
} from './pandascore'
import { nextLink, structureQueue } from './sync'

const raw: RawMatch = {
  id: 1001,
  name: 'Grand final: FURIA vs Spirit',
  status: 'finished',
  scheduled_at: '2026-11-15T10:00:00Z',
  begin_at: '2026-11-15T10:05:00Z',
  end_at: '2026-11-15T12:40:00Z',
  number_of_games: 5,
  winner_id: 11,
  forfeit: false,
  draw: false,
  modified_at: '2026-11-15T12:41:00Z',
  opponents: [
    {
      type: 'Team',
      opponent: {
        id: 10,
        name: 'Team Spirit',
        acronym: 'Spirit',
        image_url: 'https://cdn.pandascore.co/spirit.png',
      },
    },
    { type: 'Team', opponent: { id: 11, name: 'FURIA', acronym: null, image_url: null } },
  ],
  results: [
    { team_id: 11, score: 3 },
    { team_id: 10, score: 0 },
  ],
  league: { id: 5, name: 'BLAST', image_url: 'https://cdn.pandascore.co/blast.png' },
  serie: { id: 7, full_name: 'Rivals Hong Kong 2026', name: 'Rivals' },
  tournament: {
    id: 42,
    name: 'Playoffs',
    tier: 'S',
    begin_at: '2026-11-13T00:00:00Z',
    end_at: null,
    slug: 'cs-go-blast-rivals-hong-kong-2026-playoffs',
    serie_id: 11100,
    has_bracket: true,
  },
  streams_list: [
    { language: 'ru', raw_url: 'https://twitch.tv/ru', official: true, main: false },
    { language: 'en', raw_url: 'https://twitch.tv/blast', official: true, main: true },
  ],
}

describe('PandaScore mapping', () => {
  it('reads a finished match: teams, scores by team id, winner side, stream', () => {
    const m = matchOf(raw, 'cs2')
    expect(m.team1).toEqual({
      pandaId: 10,
      name: 'Team Spirit',
      acronym: 'Spirit',
      logoUrl: 'https://cdn.pandascore.co/spirit.png',
    })
    expect(m.team2.name).toBe('FURIA')
    expect([m.score1, m.score2]).toEqual([0, 3])
    expect(m.winner).toBe(2)
    expect(m.bestOf).toBe(5)
    expect(m.status).toBe('finished')
    expect(m.streamUrl).toBe('https://twitch.tv/blast')
    expect(m.tournamentPandaId).toBe(42)
  })

  it('copes with a match not set yet (TBD teams, no results, unknown status)', () => {
    const m = matchOf({ id: 2, status: 'weird', opponents: [], results: null }, 'lol')
    expect(m.team1.name).toBe('TBD')
    expect(m.name).toBe('TBD vs TBD')
    expect([m.score1, m.score2, m.winner]).toEqual([null, null, null])
    expect(m.status).toBe('not_started')
    expect(m.streamUrl).toBeNull()
  })

  it('reads the tournament with its league, season and tier', () => {
    expect(tournamentOf(raw, 'cs2')).toEqual({
      pandaId: 42,
      game: 'cs2',
      name: 'Playoffs',
      slug: 'cs-go-blast-rivals-hong-kong-2026-playoffs',
      serieId: 11100,
      hasBracket: true,
      league: 'BLAST',
      leagueLogoUrl: 'https://cdn.pandascore.co/blast.png',
      serie: 'Rivals Hong Kong 2026',
      tier: 's',
      beginAt: '2026-11-13T00:00:00Z',
      endAt: null,
    })
    expect(tournamentOf({ id: 3 }, 'cs2')).toBeNull()
    expect(tierOf(null)).toBe('unranked')
    expect(tierOf('B')).toBe('b')
  })

  it('asks for the running matches, the next 7 days and the last 3 days', () => {
    const urls = syncUrls('cs2', new Date('2026-11-24T12:00:00Z'))
    expect(urls[0]).toBe('https://api.pandascore.co/csgo/matches/running?per_page=100')
    expect(urls[1]).toContain('/csgo/matches/upcoming?')
    expect(urls[1]).toContain('range[begin_at]=2026-11-24T12:00:00Z,2026-12-01T12:00:00Z')
    expect(urls[2]).toContain('range[end_at]=2026-11-21T12:00:00Z,2026-11-24T12:00:00Z')
    expect(syncUrls('r6', new Date())[0]).toContain('/r6siege/')
  })

  it('follows the Link header', () => {
    expect(
      nextLink(
        '<https://api.pandascore.co/x?page=2>; rel="next", <https://api.pandascore.co/x?page=9>; rel="last"',
      ),
    ).toBe('https://api.pandascore.co/x?page=2')
    expect(nextLink('<https://api.pandascore.co/x?page=1>; rel="first"')).toBeNull()
    expect(nextLink(null)).toBeNull()
  })
})

describe('brackets and standings', () => {
  const team = (id: number, name: string, acronym: string) => ({
    type: 'Team',
    opponent: { id, name, acronym, image_url: `https://cdn/${id}.png` },
  })
  // Shaped like the real RUSH Brno 2026 playoffs (tournament 22438).
  const bracket = [
    {
      id: 3,
      name: 'Grand Final: ENVY vs SIN',
      status: 'finished',
      begin_at: '2026-11-22T16:30:00Z',
      number_of_games: 3,
      opponents: [team(1, 'Envy', 'ENVY'), team(2, 'Sinners', 'SIN')],
      results: [
        { team_id: 2, score: 1 },
        { team_id: 1, score: 2 },
      ],
      winner_id: 1,
      previous_matches: [
        { match_id: 1, type: 'winner' },
        { match_id: 2, type: 'winner' },
      ],
    },
    {
      id: 1,
      name: 'Semifinal 1: ALL vs ENVY',
      status: 'finished',
      begin_at: '2026-11-21T13:30:00Z',
      opponents: [team(4, 'Alliance', 'ALL'), team(1, 'Envy', 'ENVY')],
      results: [],
      winner_id: 1,
      previous_matches: [],
    },
    {
      id: 2,
      name: 'Semifinal 2: TBD vs TBD',
      status: 'not_started',
      scheduled_at: '2026-11-21T18:30:00Z',
      opponents: [],
      previous_matches: [{ match_id: 9, type: 'loser' }],
    },
  ]

  it('reads a bracket: teams, scores by team id, winner, the matches it follows from', () => {
    const b = bracketOf(bracket, 'cs2')
    expect(b.map((m) => m.id)).toEqual([1, 2, 3])
    const final = b[2]
    expect(final).toMatchObject({
      name: 'Grand Final: ENVY vs SIN',
      t1: { name: 'Envy', acronym: 'ENVY', logo: 'https://cdn/1.png' },
      s1: 2,
      s2: 1,
      winner: 1,
      bestOf: 3,
      prev: [
        { id: 1, type: 'winner' },
        { id: 2, type: 'winner' },
      ],
    })
    expect(b[1]).toMatchObject({ t1: null, t2: null, prev: [{ id: 9, type: 'loser' }] })
    expect(bracketOf({ error: 'x' }, 'cs2')).toEqual([])
  })

  it('reads standings in rank order', () => {
    const s = standingsOf([
      { rank: 2, wins: 2, losses: 0, team: { id: 5, name: 'Team Liquid', acronym: 'TL' } },
      { rank: 1, wins: 3, losses: 0, team: { id: 6, name: 'FlyQuest', acronym: 'FLY' } },
      { rank: 3, wins: 0, losses: 3, team: null },
    ])
    expect(s.map((x) => `${x.rank} ${x.team.acronym} ${x.wins}-${x.losses}`)).toEqual([
      '1 FLY 3-0',
      '2 TL 2-0',
    ])
  })

  it('fetches the moved tournaments first, then the never-fetched, big tiers first', () => {
    const row = (
      pandaId: number,
      tier: string,
      structureAt: string | null,
      beginAt = '2026-11-20',
    ) => ({
      id: pandaId,
      pandaId,
      game: 'cs2' as const,
      tier: tier as never,
      beginAt,
      structureAt,
    })
    const rows = [
      row(1, 'd', '2026-11-25'),
      row(2, 's', '2026-11-25'),
      row(3, 'a', null),
      row(4, 'd', null),
      row(5, 'c', '2026-11-25'),
    ]
    expect(structureQueue(rows, new Set([1, 5])).map((r) => r.pandaId)).toEqual([5, 1, 3, 4])
    expect(structureQueue(rows, new Set(), 1).map((r) => r.pandaId)).toEqual([3])
  })
})
