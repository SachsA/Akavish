import { describe, expect, it } from 'vitest'
import { linkify, type AutoLink } from './autolink'

const links: AutoLink[] = [
  { href: '/esport/teams/cs2-spirit', names: ['Spirit', 'Team Spirit'], caseSensitive: true },
  { href: '/esport/teams/cs2-mouz', names: ['MOUZ'], caseSensitive: true },
  { href: '/esport/competitions/cs2-blast-rivals', names: ['BLAST Rivals'], caseSensitive: false },
]

describe('linkify', () => {
  it('links the first mention of each, once', () => {
    const used = new Set<string>()
    expect(linkify('Team Spirit beat MOUZ at blast rivals; Spirit again', links, used)).toEqual([
      { text: 'Team Spirit', href: '/esport/teams/cs2-spirit' },
      { text: ' beat ' },
      { text: 'MOUZ', href: '/esport/teams/cs2-mouz' },
      { text: ' at ' },
      { text: 'blast rivals', href: '/esport/competitions/cs2-blast-rivals' },
      { text: '; Spirit again' },
    ])
    // Later paragraphs: already linked.
    expect(linkify('MOUZ won', links, used)).toEqual([{ text: 'MOUZ won' }])
  })
  it('keeps case for teams and whole words only', () => {
    const used = new Set<string>()
    expect(linkify('the spirit of MOUZESPORTS', links, used)).toEqual([{ text: 'the spirit of MOUZESPORTS' }])
    expect(used.size).toBe(0)
  })
})
