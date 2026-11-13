import { describe, expect, it } from 'vitest'
import { highlight, parseSearchQuery, searchHref } from './search-query'

describe('parseSearchQuery', () => {
  it('reads q, category, game and page', () => {
    expect(
      parseSearchQuery(new URLSearchParams('q=+gears+&category=review&game=gears-of-war-4&page=2'))
    ).toEqual({ q: 'gears', category: 'review', game: 'gears-of-war-4', page: 2 })
  })

  it('drops what it does not know instead of failing', () => {
    expect(
      parseSearchQuery(new URLSearchParams('q=x&category=reviews&game=Bad Slug!&page=-3'))
    ).toEqual({ q: 'x', category: undefined, game: undefined, page: 1 })
    expect(parseSearchQuery(new URLSearchParams('page=abc')).page).toBe(1)
    expect(parseSearchQuery(new URLSearchParams()).q).toBe('')
  })

  it('caps the query length', () => {
    expect(parseSearchQuery(new URLSearchParams(`q=${'a'.repeat(300)}`)).q).toHaveLength(100)
  })
})

describe('searchHref', () => {
  it('leaves out what is unset, and page 1', () => {
    expect(searchHref({ q: 'gta vi' })).toBe('/search?q=gta+vi')
    expect(searchHref({ q: 'gta', category: 'news', page: 1 })).toBe('/search?q=gta&category=news')
    expect(searchHref({ q: 'gta', game: 'gta-vi', page: 3 })).toBe('/search?q=gta&game=gta-vi&page=3')
    expect(searchHref({})).toBe('/search')
  })
})

describe('highlight', () => {
  const marked = (text: string, q: string) =>
    highlight(text, q)
      .map((s) => (s.match ? `[${s.text}]` : s.text))
      .join('')

  it('marks every word of the query, case-insensitively', () => {
    expect(marked('Gears of War 4 review', 'gears review')).toBe('[Gears] of War 4 [review]')
    expect(marked('GTA VI is out', 'gta')).toBe('[GTA] VI is out')
  })

  it('prefers the longer word where two overlap', () => {
    expect(marked('Gears of War', 'gear gears')).toBe('[Gears] of War')
  })

  it('treats regex characters literally', () => {
    expect(marked('Is it 8.5/10? Yes (mostly)', '8.5/10? (mostly)')).toBe(
      'Is it [8.5/10?] Yes [(mostly)]'
    )
  })

  it('returns the text untouched without a query', () => {
    expect(highlight('Plain text', '  ')).toEqual([{ text: 'Plain text', match: false }])
    expect(highlight('', 'x')).toEqual([])
  })
})
