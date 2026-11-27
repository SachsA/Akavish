import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SPOILER_PREFS,
  RESTORE_SPOILERS,
  isFree,
  mentionsTeam,
  parsePrefs,
  prefsAttributes,
  resolveSpoilers,
} from './spoilers'

describe('anti-spoil mode', () => {
  it("this visit's choice, then the default, then shown", () => {
    expect(resolveSpoilers('hide', 'show')).toBe('hide')
    expect(resolveSpoilers(null, 'hide')).toBe('hide')
    expect(resolveSpoilers('junk', 'show')).toBe('show')
    expect(resolveSpoilers(null, null)).toBe('show')
  })

  it('the inline script follows the same rule', () => {
    const run = (visit: string | null, def: string | null) => {
      const html = { dataset: {} as Record<string, string> }
      const store = (v: string | null) => ({ getItem: () => v })
      new Function('sessionStorage', 'localStorage', 'document', RESTORE_SPOILERS)(
        store(visit),
        store(def),
        {
          documentElement: html,
        },
      )
      return html.dataset.spoilers
    }
    expect(run('show', 'hide')).toBe('show')
    expect(run(null, 'hide')).toBe('hide')
    expect(run(null, null)).toBe('show')
  })
})

describe('what anti-spoil hides', () => {
  it('cleans stored prefs: unknown values take the default', () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_SPOILER_PREFS)
    expect(parsePrefs('not json')).toEqual(DEFAULT_SPOILER_PREFS)
    expect(parsePrefs({ scores: false, articles: 'hide', games: ['cs2', 'fortnite'], teams: 'followed', live: 'x' })).toEqual({
      ...DEFAULT_SPOILER_PREFS,
      scores: false,
      articles: 'hide',
      games: ['cs2'],
      teams: 'followed',
    })
  })

  it('puts what stays visible and what leaves the lists on <html>', () => {
    expect(prefsAttributes(DEFAULT_SPOILER_PREFS)).toEqual({ off: '', hide: '' })
    expect(prefsAttributes({ ...DEFAULT_SPOILER_PREFS, live: false, brackets: false, articles: 'show' })).toEqual({
      off: 'live brackets articles',
      hide: '',
    })
    expect(prefsAttributes({ ...DEFAULT_SPOILER_PREFS, articles: 'hide' }).hide).toBe('articles')
  })

  it('the inline script sets the same attributes before the first paint', () => {
    const run = (prefs: unknown) => {
      const html = { dataset: {} as Record<string, string> }
      const store = (v: string | null) => ({ getItem: () => v })
      const local = { getItem: (k: string) => (k === 'akv-spoiler-prefs' ? JSON.stringify(prefs) : 'hide') }
      new Function('sessionStorage', 'localStorage', 'document', RESTORE_SPOILERS)(store(null), local, {
        documentElement: html,
      })
      return html.dataset
    }
    expect(run({ winners: false, articles: 'hide' })).toEqual({ spoilers: 'hide', spOff: 'winners', spHide: 'articles' })
    expect(run(null)).toEqual({ spoilers: 'hide' })
  })

  it('games and teams scope: what stays visible', () => {
    const vit = { id: 3455, label: 'Team Vitality', acronym: 'VIT' }
    const followed = { teams: [vit], matches: [99] }
    const s = (over: Partial<Parameters<typeof isFree>[0]>) => ({ game: 'cs2', teams: [], match: null, text: '', ...over })
    const p = DEFAULT_SPOILER_PREFS
    expect(isFree(s({}), p, followed)).toBe(false)
    // Only CS2 protected: a LoL result shows.
    expect(isFree(s({ game: 'lol' }), { ...p, games: ['cs2'] }, followed)).toBe(true)
    expect(isFree(s({ game: 'cs2' }), { ...p, games: ['cs2'] }, followed)).toBe(false)
    // Only my teams: theirs hidden, the others shown.
    const mine = { ...p, teams: 'followed' as const }
    expect(isFree(s({ teams: [3455, 1] }), mine, followed)).toBe(false)
    expect(isFree(s({ teams: [7, 8] }), mine, followed)).toBe(true)
    expect(isFree(s({ match: 99 }), mine, followed)).toBe(false)
    expect(isFree(s({ text: 'Vitality win IEM Cologne' }), mine, followed)).toBe(true) // "Team Vitality" isn't in it
    expect(isFree(s({ text: 'VIT beat FaZe in the final' }), mine, followed)).toBe(false)
    expect(isFree(s({ text: 'Team Vitality lift the trophy' }), mine, followed)).toBe(false)
  })

  it('a team name counts as a whole word', () => {
    expect(mentionsTeam('G2 Esports sign a new AWPer', { label: 'G2 Esports', acronym: 'G2' })).toBe(true)
    expect(mentionsTeam('MOUZ NXT', { label: 'MOUZ', acronym: null })).toBe(true)
    expect(mentionsTeam('Mouzer', { label: 'MOUZ', acronym: null })).toBe(false)
  })
})
