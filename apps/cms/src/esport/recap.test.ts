import { describe, expect, it } from 'vitest'
import {
  isBracketStage,
  mainGame,
  recapDay,
  recapMatchOf,
  recapSelection,
  recapText,
  stageRecords,
  standingsLines,
  swissRule,
  type RecapMatch,
} from './recap'

const doc = (over: Record<string, unknown> = {}) => ({
  game: 'cs2',
  status: 'finished',
  endAt: '2026-11-23T13:00:00Z',
  bestOf: 1,
  team1: { name: 'FaZe' },
  team2: { name: 'GOSH' },
  score1: 1,
  score2: 0,
  winner: 1,
  tournament: { id: 7, name: 'Stage 1', league: 'PGL Major', serie: 'Singapore 2026', tier: 's' },
  ...over,
})

const m = (over: Record<string, unknown> = {}) => recapMatchOf(doc(over) as never) as RecapMatch

describe('esport recap', () => {
  it('reads a match with its event and tier', () => {
    expect(m()).toMatchObject({
      event: 'PGL Major Singapore 2026',
      stage: 'Stage 1',
      tier: 's',
      winner: 1,
    })
    expect(recapMatchOf(doc({ tournament: null }) as never)).toBeNull()
    expect(recapMatchOf(doc({ endAt: null }) as never)).toBeNull()
  })

  it("keeps the Paris day's matches in the chosen tiers", () => {
    const list = [
      m({ endAt: '2026-11-23T13:00:00Z' }),
      m({ endAt: '2026-11-22T23:30:00Z' }), // 00:30 on the 23rd in Paris
      m({ endAt: '2026-11-23T23:30:00Z' }), // 00:30 on the 24th in Paris
      m({ endAt: '2026-11-23T10:00:00Z', tournament: { league: 'CCT', serie: 'S2', tier: 'd' } }),
    ]
    expect(recapSelection(list, '2026-11-23', ['s', 'a']).map((x) => x.endAt)).toEqual([
      '2026-11-22T23:30:00Z',
      '2026-11-23T13:00:00Z',
    ])
  })

  it('writes every match with its exact score, by game and event', () => {
    const text = recapText(
      [
        m(),
        m({
          game: 'valorant',
          team1: { name: 'FPX' },
          team2: { name: 'KBG' },
          score1: 2,
          score2: 1,
          bestOf: 3,
          tournament: { name: 'Playoffs', league: 'VCT', serie: 'Champions 2026', tier: 'a' },
        }),
      ],
      '2026-11-23',
    )
    expect(text).toContain('Monday, November 23')
    expect(text).toContain(
      '## Counter-Strike 2\n### PGL Major Singapore 2026 (tier S)\n- FaZe 1-0 GOSH, FaZe win (Stage 1, best of 1)',
    )
    expect(text).toContain(
      '## Valorant\n### VCT Champions 2026 (tier A)\n- FPX 2-1 KBG, FPX win (Playoffs, best of 3)',
    )
    expect(recapDay('2026-11-24')).toBe('Tuesday, November 24')
  })

  // The real PGL Major Singapore 2026 Stage 1, day 1 (2026-11-24).
  const day1: Array<[string, string, 1 | 2]> = [
    ['Heroic', 'Imperial', 2],
    ['9z', 'Lynn Vision', 2],
    ['NIP', 'M80', 1],
    ['100 Thieves', 'Chinggis Warriors', 1],
    ['Liquid', 'GOSH', 1],
    ['PVISION', 'DENDELE CS', 1],
    ['FaZe', 'Wildcard', 2],
    ['Eternal Fire', 'FlyQuest', 2],
    ['Heroic', 'Chinggis Warriors', 1],
    ['NIP', 'Lynn Vision', 1],
    ['9z', 'M80', 2],
    ['100 Thieves', 'Imperial', 2],
    ['Eternal Fire', 'DENDELE CS', 1],
    ['PVISION', 'FlyQuest', 2],
    ['Liquid', 'Wildcard', 1],
    ['FaZe', 'GOSH', 1],
  ]
  const stage1 = day1.map(([a, b, w]) =>
    m({
      team1: { name: a },
      team2: { name: b },
      winner: w,
      score1: w === 1 ? 1 : 0,
      score2: w === 2 ? 1 : 0,
    }),
  )

  it("counts each team's wins and losses in the stage", () => {
    const r = stageRecords(stage1)
    expect(r.slice(0, 4).map((x) => `${x.team} ${x.wins}-${x.losses}`)).toEqual([
      'FlyQuest 2-0',
      'Imperial 2-0',
      'Liquid 2-0',
      'NIP 2-0',
    ])
    expect(r.find((x) => x.team === 'FaZe')).toMatchObject({ wins: 1, losses: 1 })
    expect(r.filter((x) => x.losses === 2).map((x) => x.team)).toEqual([
      '9z',
      'Chinggis Warriors',
      'DENDELE CS',
      'GOSH',
    ])
  })

  it('knows the CS2 Major Swiss stages, never a verdict elsewhere', () => {
    expect(swissRule(m())).toEqual({ wins: 3, losses: 3 })
    expect(
      swissRule(m({ tournament: { name: 'Group A', league: 'IEM', serie: 'Cologne', tier: 's' } })),
    ).toBeNull()
    expect(swissRule(m({ game: 'valorant' }))).toBeNull()
    expect(isBracketStage('Playoffs')).toBe(true)
    expect(isBracketStage('Grand Final')).toBe(true)
    expect(isBracketStage('Stage 1')).toBe(false)
  })

  it('writes one standings line per record, with qualified and eliminated', () => {
    expect(standingsLines('Stage 1', stage1, { wins: 3, losses: 3 })).toEqual([
      'Standings of Stage 1 after these matches (wins-losses over every finished match of the stage; Swiss format: 3 wins qualify for the next stage, 3 losses eliminate):',
      '- 2-0: FlyQuest, Imperial, Liquid, NIP',
      '- 1-1: 100 Thieves, Eternal Fire, FaZe, Heroic, Lynn Vision, M80, PVISION, Wildcard',
      '- 0-2: 9z, Chinggis Warriors, DENDELE CS, GOSH',
    ])
    const later = [
      ...stage1,
      m({ team1: { name: 'FlyQuest' }, team2: { name: 'NIP' }, winner: 1 }),
      m({ team1: { name: 'GOSH' }, team2: { name: '9z' }, winner: 1 }),
    ]
    const lines = standingsLines('Stage 1', later, { wins: 3, losses: 3 })
    expect(lines).toContain('- 3-0 (qualified): FlyQuest')
    expect(lines).toContain('- 0-3 (eliminated): 9z')
    expect(standingsLines('Stage 1', stage1.slice(0, 1), null)).toEqual([])
  })

  it("adds the stage's standings under its matches, from every match of the stage so far", () => {
    const today = stage1.slice(8)
    const text = recapText(today, '2026-11-23', stage1)
    expect(text).toContain('- 2-0: FlyQuest, Imperial, Liquid, NIP')
    expect(text.indexOf('Standings of Stage 1')).toBeGreaterThan(text.indexOf('- FaZe 1-0 GOSH'))
    // A knockout stage gets none.
    const playoffs = stage1.map((x) => ({ ...x, tournamentId: 8, stage: 'Playoffs' }))
    expect(recapText(playoffs, '2026-11-23')).not.toContain('Standings of')
  })

  it('picks the game with the most matches', () => {
    expect(mainGame([m(), m(), m({ game: 'lol' })])).toBe('cs2')
    expect(mainGame([])).toBeNull()
  })
})
