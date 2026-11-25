import { describe, expect, it } from 'vitest'
import {
  ESPORT_GAMES,
  ESPORT_GAME_SLUGS,
  esportGameOfSlug,
  choicesOf,
  filterRows,
  filtersToQuery,
  groupRows,
  isEsportGame,
  parseFilters,
  rowOf,
  type EsportRow,
} from './esport'

const doc = (over: Record<string, unknown> = {}) => ({
  pandaId: 1,
  game: 'cs2',
  status: 'finished',
  name: 'Final',
  beginAt: '2026-11-24T23:30:00Z',
  endAt: '2026-11-25T00:10:00Z',
  bestOf: 3,
  team1: { name: 'FURIA', acronym: 'FUR', logoUrl: 'https://x/f.png' },
  team2: { name: 'Spirit' },
  score1: 2,
  score2: 1,
  winner: 1,
  tournament: {
    pandaId: 9,
    league: 'PGL Major',
    serie: 'Singapore 2026',
    name: 'Stage 1',
    tier: 's',
  },
  ...over,
})

describe('rowOf', () => {
  it('reads a match, its teams and its event', () => {
    const r = rowOf(doc())!
    expect(r.event).toBe('PGL Major Singapore 2026')
    expect(r.stage).toBe('Stage 1')
    expect(r.tier).toBe('s')
    expect(r.t1).toEqual({ name: 'FURIA', acronym: 'FUR', logo: 'https://x/f.png' })
    expect(r.t2).toEqual({ name: 'Spirit', acronym: null, logo: null })
    expect([r.s1, r.s2, r.winner]).toEqual([2, 1, 1])
  })

  it("doesn't repeat the league when the season already names it", () => {
    expect(
      rowOf(doc({ tournament: { league: 'IEM', serie: 'IEM Katowice 2027', tier: 'a' } }))!.event,
    ).toBe('IEM Katowice 2027')
  })

  it('skips an unknown game or a match without a date', () => {
    expect(rowOf(doc({ game: 'dota2' }))).toBeNull()
    expect(rowOf(doc({ beginAt: null, scheduledAt: null }))).toBeNull()
  })
})

describe('filters', () => {
  const rows = [
    rowOf(doc())!,
    rowOf(
      doc({
        pandaId: 2,
        game: 'valorant',
        tournament: { league: 'VCT', serie: 'Ascension 2026', tier: 'c' },
      }),
    )!,
  ] as EsportRow[]

  it('round-trip through the URL, ignoring junk', () => {
    const f = parseFilters(
      '?game=cs2&tier=s,a,zz&event=PGL%20Major%20Singapore%202026&day=2026-11-24',
    )
    expect(f).toEqual({
      game: 'cs2',
      tiers: ['s', 'a'],
      event: 'PGL Major Singapore 2026',
      day: '2026-11-24',
    })
    expect(parseFilters(filtersToQuery(f))).toEqual(f)
    expect(parseFilters('?game=dota2&day=yesterday')).toEqual({
      game: '',
      tiers: [],
      event: '',
      day: '',
    })
    expect(filtersToQuery({ game: '', tiers: [], event: '', day: '' })).toBe('')
  })

  it('filter by game, tier and the day in the reader’s time zone', () => {
    expect(
      filterRows(rows, { game: 'valorant', tiers: [], event: '', day: '' }, 'UTC').map((r) => r.id),
    ).toEqual([2])
    expect(
      filterRows(rows, { game: '', tiers: ['s'], event: '', day: '' }, 'UTC').map((r) => r.id),
    ).toEqual([1])
    // 23:30 UTC on the 24th is the 25th in Paris (UTC+1).
    expect(
      filterRows(rows, { game: 'cs2', tiers: [], event: '', day: '2026-11-25' }, 'Europe/Paris'),
    ).toHaveLength(1)
    expect(
      filterRows(rows, { game: 'cs2', tiers: [], event: '', day: '2026-11-25' }, 'UTC'),
    ).toHaveLength(0)
  })

  it('offer only the events and games present', () => {
    const c = choicesOf(rows, { game: '', tiers: [], event: '', day: '' }, 'UTC')
    expect(c.events).toEqual(['PGL Major Singapore 2026', 'VCT Ascension 2026']) // tier S first
    expect(c.games).toEqual(['cs2', 'valorant'])
    expect(
      choicesOf(rows, { game: 'valorant', tiers: [], event: '', day: '' }, 'UTC').events,
    ).toEqual(['VCT Ascension 2026'])
  })
})

describe('groupRows', () => {
  it('groups by day, then event, biggest tier first, matches in time order', () => {
    const rows = [
      rowOf(doc({ pandaId: 1, beginAt: '2026-11-24T10:00:00Z' }))!,
      rowOf(
        doc({
          pandaId: 2,
          beginAt: '2026-11-24T08:00:00Z',
          tournament: { league: 'CCT', serie: 'S2', tier: 'd' },
        }),
      )!,
      rowOf(doc({ pandaId: 3, beginAt: '2026-11-24T12:00:00Z' }))!,
      rowOf(doc({ pandaId: 4, beginAt: '2026-11-23T12:00:00Z' }))!,
    ]
    const soonest = groupRows(rows, 'UTC', 'soonest')
    expect(soonest.map((d) => d.day)).toEqual(['2026-11-23', '2026-11-24'])
    expect(soonest[1].events.map((e) => e.event)).toEqual(['PGL Major Singapore 2026', 'CCT S2'])
    expect(soonest[1].events[0].rows.map((r) => r.id)).toEqual([1, 3])
    expect(groupRows(rows, 'UTC', 'newest')[0].day).toBe('2026-11-24')
  })
})

describe('esport games', () => {
  it('knows the five games of /esport/<game>, and their CMS games', () => {
    expect(ESPORT_GAMES.filter(isEsportGame)).toHaveLength(5)
    expect(isEsportGame('fifa')).toBe(false)
    expect(isEsportGame('page')).toBe(false)
    for (const g of ESPORT_GAMES) expect(ESPORT_GAME_SLUGS[g].length).toBeGreaterThan(0)
    expect(ESPORT_GAME_SLUGS.cs2).toEqual(['counter-strike-2'])
  })
})

describe('esport game of a CMS game', () => {
  it('names the esport game for the card badge', () => {
    expect(esportGameOfSlug('counter-strike-2')).toBe('cs2')
    expect(esportGameOfSlug('tom-clancy-s-rainbow-six-siege-x')).toBe('r6')
    expect(esportGameOfSlug('gta-6')).toBeNull()
    expect(esportGameOfSlug(undefined)).toBeNull()
  })
})
