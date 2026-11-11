import { describe, expect, it } from 'vitest'
import type { Article } from '@akavish/types'
import { pickLead, sectionArticles } from './home'

const a = (id: string) => ({ id, title: id }) as Article

describe('pickLead', () => {
  it('uses the newest article when nothing is featured', () => {
    expect(pickLead([a('1'), a('2'), a('3')], null)).toEqual({ lead: a('1'), others: [a('2'), a('3')] })
  })

  it("puts the editor's pick first and doesn't repeat it below", () => {
    expect(pickLead([a('1'), a('2'), a('3')], a('2'))).toEqual({ lead: a('2'), others: [a('1'), a('3')] })
  })

  it('accepts a featured article older than the whole feed', () => {
    expect(pickLead([a('1'), a('2')], a('9'))).toEqual({ lead: a('9'), others: [a('1'), a('2')] })
  })

  it('handles an empty site', () => {
    expect(pickLead([], null)).toEqual({ lead: undefined, others: [] })
  })
})

describe('sectionArticles', () => {
  const art = (id: string, category: string, publishedAt: string) =>
    ({ id, title: id, category, publishedAt }) as Article

  it('includes the lead and top stories, newest first, without duplicates', () => {
    const lead = art('9', 'esport', '2026-11-01T00:00:00Z') // older featured pick
    const top = art('1', 'esport', '2026-11-11T08:00:00Z')
    const all = [lead, top, art('2', 'news', '2026-11-10T00:00:00Z'), art('3', 'esport', '2026-11-10T00:00:00Z'), top]
    expect(sectionArticles(all, 'esport', 3).map((a) => a.id)).toEqual(['1', '3', '9'])
  })

  it('keeps to the limit and is empty for a category with nothing', () => {
    const all = [art('1', 'news', '2026-11-03'), art('2', 'news', '2026-11-02'), art('3', 'news', '2026-11-01')]
    expect(sectionArticles(all, 'news', 2).map((a) => a.id)).toEqual(['1', '2'])
    expect(sectionArticles(all, 'review', 3)).toEqual([])
  })
})
