import { describe, expect, it } from 'vitest'
import { pagedTitle, pageHref, parsePage } from './pagination'

describe('parsePage', () => {
  it('defaults to page 1', () => {
    expect(parsePage(undefined)).toBe(1)
  })
  it('accepts whole numbers from 1', () => {
    expect(parsePage('1')).toBe(1)
    expect(parsePage('12')).toBe(12)
  })
  it('rejects anything else', () => {
    for (const bad of ['0', '-1', 'abc', '2.5', '', '01', '9999999', ['2', '3']]) {
      expect(parsePage(bad)).toBeNull()
    }
  })
})

describe('pageHref / pagedTitle', () => {
  it('keeps page 1 on the bare URL and title', () => {
    expect(pageHref('/news', 1)).toBe('/news')
    expect(pagedTitle('News', 1)).toBe('News')
  })
  it('adds the page number after that', () => {
    expect(pageHref('/news', 3)).toBe('/news?page=3')
    expect(pagedTitle('News', 3)).toBe('News (page 3)')
  })
})
