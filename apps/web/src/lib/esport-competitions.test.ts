import { describe, expect, it } from 'vitest'
import {
  competitionOf,
  countryName,
  editionOf,
  editionStatus,
  editionTitle,
  formatPrize,
  groupEditions,
  isQualifier,
  palmares,
  sortCompetitions,
  type Edition,
} from './esport-competitions'

const NOW = new Date('2026-11-27T12:00:00Z')

const edition = (over: Partial<Edition>): Edition => ({
  id: '1',
  pandaId: 1,
  game: 'cs2',
  name: 'Beijing 2026',
  beginAt: '2026-11-01T00:00:00Z',
  endAt: '2026-11-08T00:00:00Z',
  tier: 's',
  winner: null,
  prizePool: null,
  country: null,
  stages: [],
  competition: null,
  ...over,
})

describe('competitionOf / editionOf', () => {
  it('maps a CMS competition with its last winner', () => {
    const c = competitionOf({
      id: 3,
      slug: 'cs2-iem',
      name: 'IEM',
      game: 'cs2',
      tier: 's',
      logoUrl: 'https://x/iem.png',
      lastAt: '2026-11-01T00:00:00Z',
      latest: {
        editions: 59,
        champion: { edition: { name: 'Beijing 2026' }, team: { pandaId: 3240, name: 'MOUZ', acronym: 'MOUZ', logoUrl: null } },
      },
    })
    expect(c).toMatchObject({ id: '3', slug: 'cs2-iem', editions: 59, champion: { edition: 'Beijing 2026', team: { name: 'MOUZ', pandaId: 3240 } } })
    expect(competitionOf({ id: 4, slug: 'x', name: 'X', game: 'chess' })).toBeNull()
  })
  it('maps an edition with its winner, stages and competition', () => {
    const e = editionOf({
      id: 9,
      pandaId: 11000,
      game: 'lol',
      name: '2026',
      beginAt: '2026-10-15T00:00:00Z',
      endAt: '2026-11-15T00:00:00Z',
      tier: 's',
      winner: { pandaId: 1, name: 'Bilibili Gaming', acronym: 'BLG', logoUrl: null },
      prizePool: '5,000,000 United States Dollar',
      stages: [{ pandaId: 5, name: 'Playoffs', slug: 'lol-worlds-2026-playoffs', tier: 's' }, { name: 'no id' }],
      league: { slug: 'lol-worlds', name: 'Worlds', game: 'lol', logoUrl: null },
    })
    expect(e?.winner?.name).toBe('Bilibili Gaming')
    expect(e?.stages.map((s) => s.slug)).toEqual(['lol-worlds-2026-playoffs'])
    expect(e?.competition).toEqual({ slug: 'lol-worlds', name: 'Worlds', game: 'lol', logo: null })
  })
})

describe('editionStatus and groupEditions', () => {
  it('tells coming, on now and over', () => {
    expect(editionStatus(edition({ beginAt: '2026-12-01T00:00:00Z', endAt: null }), NOW)).toBe('upcoming')
    expect(editionStatus(edition({ endAt: '2026-12-13T00:00:00Z' }), NOW)).toBe('running')
    expect(editionStatus(edition({}), NOW)).toBe('past')
  })
  it('groups them: on now by tier, coming by date, over latest first (S and A, no qualifiers)', () => {
    const g = groupEditions(
      [
        edition({ id: 'a', tier: 'b', endAt: '2026-12-01T00:00:00Z' }),
        edition({ id: 'b', tier: 's', endAt: '2026-12-13T00:00:00Z' }),
        edition({ id: 'c', beginAt: '2026-12-05T00:00:00Z', endAt: null }),
        edition({ id: 'd', beginAt: '2026-11-30T00:00:00Z', endAt: null }),
        edition({ id: 'e', endAt: '2026-11-20T00:00:00Z' }),
        edition({ id: 'f', endAt: '2026-11-25T00:00:00Z' }),
        edition({ id: 'g', name: 'Copenhagen: European RMR A 2026', endAt: '2026-11-26T00:00:00Z' }),
        edition({ id: 'h', endAt: '2026-08-01T00:00:00Z' }),
        edition({ id: 'i', tier: 'b', endAt: '2026-11-26T00:00:00Z' }),
      ],
      NOW,
    )
    expect(g.running.map((e) => e.id)).toEqual(['b', 'a'])
    expect(g.upcoming.map((e) => e.id)).toEqual(['d', 'c'])
    expect(g.recent.map((e) => e.id)).toEqual(['f', 'e'])
  })
})

describe('qualifiers and palmares', () => {
  it('spots qualifiers and regional stages', () => {
    expect(isQualifier('Copenhagen: American RMR 2024')).toBe(true)
    expect(isQualifier('Astana: European Qualifier 2025')).toBe(true)
    expect(isQualifier('Singapore 2026')).toBe(false)
  })
  it('lists the main editions latest first, the qualifiers apart', () => {
    const p = palmares([
      edition({ id: 'old', beginAt: '2024-03-17T00:00:00Z' }),
      edition({ id: 'q', name: 'Copenhagen: European RMR A 2024' }),
      edition({ id: 'new', beginAt: '2026-11-23T00:00:00Z' }),
    ])
    expect(p.main.map((e) => e.id)).toEqual(['new', 'old'])
    expect(p.qualifiers.map((e) => e.id)).toEqual(['q'])
  })
})

describe('sortCompetitions', () => {
  it('puts the active ones first by tier, the old ones apart', () => {
    const c = (slug: string, tier: 's' | 'a', lastAt: string) =>
      competitionOf({ id: slug, slug, name: slug, game: 'cs2', tier, lastAt })!
    const r = sortCompetitions([c('a1', 'a', '2026-10-01T00:00:00Z'), c('s1', 's', '2026-06-01T00:00:00Z'), c('old', 's', '2019-01-01T00:00:00Z')], NOW)
    expect(r.active.map((x) => x.slug)).toEqual(['s1', 'a1'])
    expect(r.archive.map((x) => x.slug)).toEqual(['old'])
  })
})

describe('formatting', () => {
  it('names an edition once', () => {
    expect(editionTitle('IEM', 'Beijing 2026')).toBe('IEM Beijing 2026')
    expect(editionTitle('Worlds', '2026')).toBe('Worlds 2026')
    expect(editionTitle('VCT', 'VCT Masters 2026')).toBe('VCT Masters 2026')
  })
  it('writes the prize pool in the reader’s language', () => {
    expect(formatPrize('1,250,000 United States Dollar', 'en')).toBe('$1,250,000')
    expect(formatPrize('1250000 United States Dollar', 'fr')).toMatch(/1\s?250\s?000\s?\$/)
    expect(formatPrize('500 Credits', 'en')).toBe('500 Credits')
    expect(formatPrize(null, 'en')).toBeNull()
  })
  it('names the country', () => {
    expect(countryName('SG', 'en')).toBe('Singapore')
    expect(countryName('SG', 'fr')).toBe('Singapour')
    expect(countryName(null, 'en')).toBeNull()
  })
})
