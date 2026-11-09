import { describe, expect, it } from 'vitest'
import { appendPage, hasMore } from './feed'

const a = (id: string) => ({ id })

describe('appendPage', () => {
  it('appends the next page', () => {
    expect(appendPage([a('1'), a('2')], [a('3')]).map((x) => x.id)).toEqual(['1', '2', '3'])
  })

  // An article published while the reader scrolls shifts every page by one,
  // so page 2 starts with the last item already shown.
  it('drops articles already in the list', () => {
    expect(appendPage([a('1'), a('2')], [a('2'), a('3')]).map((x) => x.id)).toEqual(['1', '2', '3'])
  })
})

describe('hasMore', () => {
  it('is true until the last page', () => {
    expect(hasMore(1, 3)).toBe(true)
    expect(hasMore(3, 3)).toBe(false)
    expect(hasMore(1, 0)).toBe(false) // empty section: Payload reports 0 pages
  })
})
