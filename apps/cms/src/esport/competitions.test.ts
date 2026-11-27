import { describe, expect, it } from 'vitest'
import {
  competitionUrls,
  detectLeagues,
  editionDetails,
  editionNames,
  editionsOf,
  leagueSlug,
  mergeStages,
  prizeAmount,
  winnerOf,
  type RawTournament,
  type StageData,
} from './competitions'

const NOW = new Date('2026-11-27T12:00:00Z')

const t = (over: Partial<RawTournament> & { id: number }): RawTournament => ({
  name: 'Playoffs',
  slug: `stage-${over.id}`,
  tier: 's',
  begin_at: '2026-11-01T10:00:00Z',
  end_at: '2026-11-08T20:00:00Z',
  winner_id: null,
  winner_type: 'Team',
  league: { id: 1, name: 'IEM', slug: 'cs-go-iem', image_url: 'https://x/iem.png' },
  serie: {
    id: 10,
    full_name: 'Beijing 2026',
    year: 2026,
    slug: 'cs-go-iem-beijing-2026',
    winner_id: null,
    winner_type: 'Team',
  },
  ...over,
})

const stage = (id: number, endAt: string | null, winnerId: number | null = null): StageData => ({
  pandaId: id,
  name: `S${id}`,
  slug: null,
  tier: 's',
  beginAt: endAt,
  endAt,
  winnerId,
})

describe('leagueSlug', () => {
  it('puts the game first and keeps the name readable', () => {
    expect(leagueSlug('cs2', 'PGL Major')).toBe('cs2-pgl-major')
    expect(leagueSlug('r6', 'RE:L0:AD')).toBe('r6-re-l0-ad')
    expect(leagueSlug('lol', 'Ligue Française')).toBe('lol-ligue-francaise')
  })
})

describe('winnerOf', () => {
  it("takes PandaScore's winner first", () => {
    expect(winnerOf(7, [stage(1, '2026-12-01T00:00:00Z')], null, NOW)).toBe(7)
  })
  it('else the winner of the stage that ended last, once all are over', () => {
    const stages = [stage(1, '2026-11-04T00:00:00Z', 5), stage(2, '2026-11-08T00:00:00Z', 9)]
    expect(winnerOf(null, stages, null, NOW)).toBe(9)
  })
  it('nobody while a stage is on or the edition is not over', () => {
    expect(
      winnerOf(
        null,
        [stage(1, '2026-11-04T00:00:00Z', 5), stage(2, '2026-12-01T00:00:00Z')],
        null,
        NOW,
      ),
    ).toBeNull()
    expect(
      winnerOf(null, [stage(1, '2026-11-04T00:00:00Z', 5)], '2026-12-13T00:00:00Z', NOW),
    ).toBeNull()
  })
})

describe('mergeStages', () => {
  it('keeps one copy per stage, the newer, in time order', () => {
    const merged = mergeStages(
      [stage(2, '2026-11-08T00:00:00Z'), stage(1, '2026-11-04T00:00:00Z')],
      [stage(2, '2026-11-08T00:00:00Z', 3)],
    )
    expect(merged.map((s) => [s.pandaId, s.winnerId])).toEqual([
      [1, null],
      [2, 3],
    ])
  })
})

describe('prize pool and country', () => {
  it('reads the amount and keeps the biggest stage', () => {
    expect(prizeAmount('1,250,000 United States Dollar')).toBe(1_250_000)
    expect(prizeAmount('100000 United States Dollar')).toBe(100_000)
    expect(prizeAmount(null)).toBe(0)
    const d = editionDetails([
      { ...stage(1, null), prizePool: '100000 United States Dollar', country: null },
      { ...stage(2, null), prizePool: '1,000,000 United States Dollar', country: 'SG' },
    ])
    expect(d).toEqual({ prizePool: '1,000,000 United States Dollar', country: 'SG' })
  })
})

describe('editionsOf', () => {
  it('groups the stages into editions of a league, with the winner', () => {
    const { leagues, series } = editionsOf(
      [
        t({ id: 1, name: 'Group A', end_at: '2026-11-04T20:00:00Z', winner_id: 5 }),
        t({
          id: 2,
          name: 'Playoffs',
          winner_id: 3240,
          prizepool: '1,000,000 United States Dollar',
          country: 'CN',
        }),
      ],
      'cs2',
      NOW,
    )
    expect([...leagues.values()]).toEqual([
      {
        pandaId: 1,
        game: 'cs2',
        name: 'IEM',
        slug: 'cs2-iem',
        pandaSlug: 'cs-go-iem',
        logoUrl: 'https://x/iem.png',
      },
    ])
    const s = series.get(10)!
    expect(s.name).toBe('Beijing 2026')
    expect(s.stages.map((x) => x.name)).toEqual(['Group A', 'Playoffs'])
    expect(s.winnerPandaId).toBe(3240)
    expect(s.tier).toBe('s')
    expect(s.prizePool).toBe('1,000,000 United States Dollar')
    expect(s.country).toBe('CN')
    expect(s.endAt).toBe('2026-11-08T20:00:00Z')
  })
  it('leaves out the editions under tier B, and their leagues', () => {
    const { leagues, series } = editionsOf([t({ id: 1, tier: 'c' })], 'cs2', NOW)
    expect(series.size).toBe(0)
    expect(leagues.size).toBe(0)
  })
  it('skips a winner that is not a team', () => {
    const { series } = editionsOf([t({ id: 1, winner_id: 4, winner_type: 'Player' })], 'cs2', NOW)
    expect(series.get(10)!.winnerPandaId).toBeNull()
  })
})

describe('competitionUrls', () => {
  it('reads tier S, A and B: on now, coming, finished', () => {
    const urls = competitionUrls('cs2')
    expect(urls).toHaveLength(3)
    expect(
      urls.every((u) => u.includes('/csgo/tournaments/') && u.includes('filter[tier]=s,a,b')),
    ).toBe(true)
    expect(urls[2]).toContain('/past?')
  })
})

describe('editionNames', () => {
  it('names an edition the ways articles do', () => {
    const pgl = editionNames('PGL Major', 'Singapore 2026', 'cs2')
    expect(pgl).toEqual(
      expect.arrayContaining(['PGL Major Singapore', 'PGL Singapore Major', 'Singapore Major']),
    )
    expect(editionNames('VCT', 'Champions 2026', 'valorant')).toEqual([
      'VCT Champions',
      'Valorant Champions',
    ])
    expect(editionNames('VCT', 'Masters London 2026', 'valorant')).toContain('Masters London')
  })
  it('skips qualifiers and editions with no name but a year', () => {
    expect(editionNames('PGL', 'Astana: European Qualifier 2025', 'cs2')).toEqual([])
    expect(editionNames('Worlds', '2026', 'lol')).toEqual([])
  })
})

describe('detectLeagues', () => {
  const leagues = [
    { id: 1, game: 'cs2' as const, names: ['PGL Major', 'Singapore Major'] },
    { id: 2, game: 'cs2' as const, names: ['PGL'] },
    { id: 3, game: 'cs2' as const, names: ['Esports World Cup'] },
    { id: 4, game: 'lol' as const, names: ['Esports World Cup', 'Worlds', 'LCK'] },
    { id: 5, game: 'cs2' as const, names: ['ESL'] },
  ]
  it('finds whole names, case and accents aside', () => {
    expect(detectLeagues('NIP beat Liquid at the singapore MAJOR', leagues, 'cs2')).toEqual([1])
    expect(detectLeagues('Bilibili win Worlds 2026', leagues, 'lol')).toEqual([4])
    expect(detectLeagues('Wesley joins the team', leagues, 'cs2')).toEqual([])
  })
  it("keeps the article's game only", () => {
    expect(detectLeagues('Esports World Cup', leagues, 'lol')).toEqual([4])
    // No game: a name several games share counts for none.
    expect(detectLeagues('Esports World Cup', leagues, null)).toEqual([])
  })
  it('drops a name found inside a longer one found', () => {
    expect(detectLeagues('PGL\nSingapore Major', leagues, 'cs2')).toEqual([1])
  })
  it('reads the lines apart', () => {
    expect(detectLeagues('Team news\nPGL', leagues, 'cs2')).toEqual([2])
    expect(detectLeagues('Singapore\nMajor', leagues, 'cs2')).toEqual([])
  })
})
