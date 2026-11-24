import { describe, expect, it } from 'vitest'
import { matchOf, syncUrls, tierOf, tournamentOf, type RawMatch } from './pandascore'
import { nextLink } from './sync'

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
