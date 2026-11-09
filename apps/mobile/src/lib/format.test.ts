import { describe, expect, it } from 'vitest'
import { articleUrl, byline, formatDate } from './format'

describe('formatDate', () => {
  it('formats in UTC, so the day never shifts with the phone time zone', () => {
    expect(formatDate('2026-11-09T23:30:00.000Z')).toBe('Nov 9, 2026')
    expect(formatDate('2026-11-10T00:15:00.000Z')).toBe('Nov 10, 2026')
  })

  it('returns an empty string for a missing or invalid date', () => {
    expect(formatDate(undefined)).toBe('')
    expect(formatDate('not a date')).toBe('')
  })
})

describe('articleUrl', () => {
  it('points at the web article and escapes the slug', () => {
    expect(articleUrl('gta-6-trailer')).toBe('https://akavish.gg/article/gta-6-trailer')
    expect(articleUrl('a b')).toBe('https://akavish.gg/article/a%20b')
  })
})

describe('byline', () => {
  it('joins the non-empty parts', () => {
    expect(byline('Alex', 'Nov 9, 2026', '4 min read')).toBe('Alex · Nov 9, 2026 · 4 min read')
    expect(byline('Alex', '', undefined)).toBe('Alex')
  })
})
