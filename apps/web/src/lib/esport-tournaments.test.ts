import { describe, expect, it } from 'vitest'
import {
  bracketLayout,
  groupEvents,
  roundLabel,
  roundName,
  stageOf,
  swissVerdict,
  type StageMatch,
} from './esport-tournaments'
// The real CCT Europe Series #14 2026 playoffs (PandaScore 22377), as the CMS stores it.
import cct from './fixtures/bracket-cct-europe-14.json'

const m = (id: number, name: string, prev: Array<[number, 'winner' | 'loser']> = [], at = '2026-11-20T10:00:00Z'): StageMatch => ({
  id,
  name,
  at,
  status: 'finished',
  t1: null,
  t2: null,
  s1: null,
  s2: null,
  winner: null,
  bestOf: 3,
  prev: prev.map(([pid, type]) => ({ id: pid, type })),
})

describe('round names', () => {
  it('keeps the round, drops the match number and teams', () => {
    expect(roundLabel('Quarterfinal 2: SIN vs MZP')).toBe('Quarterfinal')
    expect(roundLabel('Round of 16 match 3: ex-INOX vs FORZE.R')).toBe('Round of 16')
    expect(roundLabel('Round 3: IMP vs FLY')).toBe('Round 3')
    expect(roundLabel('Grand Final: ENVY vs SIN')).toBe('Grand Final')
    expect(roundLabel('Upper bracket semifinal 1: A vs B')).toBe('Upper bracket semifinal')
  })

  it('says them in French on /fr', () => {
    expect(roundName('Quarterfinal', 'fr')).toBe('Quarts de finale')
    expect(roundName('Round 3', 'fr')).toBe('Ronde 3')
    expect(roundName('Upper bracket semifinal', 'fr')).toBe('Demi-finales (winner bracket)')
    expect(roundName('Quarterfinal', 'en')).toBe('Quarterfinal')
    expect(roundName('Showmatch', 'fr')).toBe('Showmatch')
  })
})

describe('bracket layout', () => {
  it('builds the tree of a real single-elimination bracket, each match level with the two it comes from', () => {
    const [main, ...rest] = bracketLayout(cct as StageMatch[])
    expect(rest).toEqual([])
    expect(main.columns.map((c) => `${c.label} ${c.matches.length}`)).toEqual([
      'Round of 16 8',
      'Quarterfinal 4',
      'Semifinal 2',
      'Grand Final 1',
    ])
    const ids = (i: number) => main.columns[i].matches.map((x) => x.id)
    expect(ids(2)).toEqual([1789191, 1789192])
    expect(ids(1)).toEqual([1789187, 1789188, 1789190, 1789189])
    expect(ids(0)).toEqual([1789181, 1789186, 1789180, 1789182, 1789184, 1789179, 1789185, 1789183])
  })

  it('splits a double elimination into upper, lower and the grand final', () => {
    const s = bracketLayout([
      m(1, 'Upper bracket semifinal 1: A vs B'),
      m(2, 'Upper bracket semifinal 2: C vs D'),
      m(3, 'Upper bracket final: A vs C', [[1, 'winner'], [2, 'winner']]),
      m(4, 'Lower bracket round 1: B vs D', [[1, 'loser'], [2, 'loser']]),
      m(5, 'Lower bracket final: C vs B', [[3, 'loser'], [4, 'winner']]),
      m(6, 'Grand final: A vs C', [[3, 'winner'], [5, 'winner']]),
    ])
    expect(s.map((x) => `${x.key}:${x.columns.map((c) => c.matches.length).join(',')}`)).toEqual([
      'upper:2,1',
      'lower:1,1',
      'final:1',
    ])
  })

  it('lays a Swiss stage out by round, in time order', () => {
    const s = bracketLayout([
      m(2, 'Round 2: A vs C', [], '2026-11-24T12:00:00Z'),
      m(1, 'Round 1: A vs B', [], '2026-11-24T08:00:00Z'),
      m(3, 'Round 1: C vs D', [], '2026-11-24T09:00:00Z'),
    ])
    expect(s[0].columns.map((c) => `${c.label}:${c.matches.map((x) => x.id).join(',')}`)).toEqual(['Round 1:1,3', 'Round 2:2'])
    expect(bracketLayout([])).toEqual([])
  })
})

describe('stages and events', () => {
  const doc = (over: Record<string, unknown> = {}) => ({
    pandaId: 22378,
    slug: 'cs-go-pgl-major-singapore-2026-stage-1',
    game: 'cs2',
    name: 'Stage 1',
    league: 'PGL Major',
    serie: 'Singapore 2026',
    tier: 's',
    serieId: 11176,
    beginAt: '2026-11-24T04:00:00Z',
    ...over,
  })

  it('reads a stage, and skips one without a slug', () => {
    expect(stageOf(doc())).toMatchObject({ id: 22378, event: 'PGL Major Singapore 2026', name: 'Stage 1', structure: null })
    expect(stageOf(doc({ slug: null }))).toBeNull()
  })

  it('groups the stages of one event, big events first', () => {
    const groups = groupEvents(
      [
        stageOf(doc({ pandaId: 2, slug: 'b', name: 'Stage 2', beginAt: '2026-11-28T04:00:00Z' })),
        stageOf(doc()),
        stageOf(doc({ pandaId: 3, slug: 'c', serieId: 1, league: 'CCT', serie: 'Europe #14', tier: 'c' })),
      ].filter((x) => x !== null),
    )
    expect(groups.map((g) => `${g.event}: ${g.stages.map((s) => s.name).join(', ')}`)).toEqual([
      'PGL Major Singapore 2026: Stage 1, Stage 2',
      'CCT Europe #14: Stage 1',
    ])
  })
})

describe('Swiss verdicts', () => {
  const major = { game: 'cs2' as const, event: 'PGL Major Singapore 2026', name: 'Stage 1' }
  it('only for the CS2 Major stages', () => {
    expect(swissVerdict(major, { wins: 3, losses: 1 })).toBe('qualified')
    expect(swissVerdict(major, { wins: 1, losses: 3 })).toBe('eliminated')
    expect(swissVerdict(major, { wins: 2, losses: 2 })).toBeNull()
    expect(swissVerdict({ ...major, name: 'Playoffs' }, { wins: 3, losses: 0 })).toBeNull()
    expect(swissVerdict({ ...major, game: 'valorant' }, { wins: 3, losses: 0 })).toBeNull()
  })
})
