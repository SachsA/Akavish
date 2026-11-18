import { describe, expect, it } from 'vitest'
import { matchEntities } from './entity-match'

const e = (...names: string[]) => ({ names, id: names[0] })
const consoles = [
  e('PC', 'PC', 'pc'),
  e('PlayStation 5', 'PS5', 'ps5'),
  e('PlayStation 4', 'PS4', 'ps4'),
  e('Nintendo Switch 2', 'Switch 2', 'switch-2'),
  e('Nintendo Switch', 'Switch', 'switch'),
]

describe('matchEntities', () => {
  it('finds consoles by short name, full name or a word', () => {
    expect(matchEntities(consoles, 'ps5').map((c) => c.id)).toEqual(['PlayStation 5'])
    expect(matchEntities(consoles, 'PS 5').map((c) => c.id)).toEqual(['PlayStation 5'])
    expect(matchEntities(consoles, 'playstation').map((c) => c.id)).toEqual(['PlayStation 5', 'PlayStation 4'])
    // Exact first: "switch" is the Switch before the Switch 2.
    expect(matchEntities(consoles, 'switch').map((c) => c.id)).toEqual(['Nintendo Switch', 'Nintendo Switch 2'])
    expect(matchEntities([e('Rockstar Games', 'rockstar-games')], 'rockstar')).toHaveLength(1)
  })
  it('stays quiet on short or unrelated queries', () => {
    expect(matchEntities(consoles, 'p')).toEqual([])
    expect(matchEntities(consoles, 'gta')).toEqual([])
    // A two-letter word inside a name isn't enough.
    expect(matchEntities([e('Xbox Game Studios')], 'ga')).toEqual([])
  })
})
