import { describe, expect, it } from 'vitest'
import {
  mainGame,
  recapDay,
  recapMatchOf,
  recapSelection,
  recapText,
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
  tournament: { name: 'Stage 1', league: 'PGL Major', serie: 'Singapore 2026', tier: 's' },
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

  it('picks the game with the most matches', () => {
    expect(mainGame([m(), m(), m({ game: 'lol' })])).toBe('cs2')
    expect(mainGame([])).toBeNull()
  })
})
