import { describe, expect, it } from 'vitest'
import { daysUntil, groupByMonth, safeUrl, splitEvents, type CalendarEvent } from './events'

const ev = (slug: string, startAt: string, extra: Partial<CalendarEvent> = {}): CalendarEvent => ({
  slug,
  name: slug,
  kind: 'showcase',
  startAt,
  timeKnown: true,
  endAt: null,
  location: null,
  streamUrl: null,
  officialUrl: null,
  summary: null,
  summaryFr: null,
  article: null,
  ...extra,
})

describe('events calendar', () => {
  const now = Date.parse('2026-12-11T02:00:00Z') // The Game Awards, an hour in

  it('splits on now, upcoming soonest first, past latest first', () => {
    const tga = ev('tga-2026', '2026-12-11T01:00:00Z')
    const gdc = ev('gdc-2027', '2027-03-01T00:00:00Z', { timeKnown: false, endAt: '2027-03-04T00:00:00Z' })
    const tgs = ev('tgs-2027', '2027-09-16T00:00:00Z', { timeKnown: false, endAt: '2027-09-20T00:00:00Z' })
    const sop = ev('sop-sept-2026', '2026-09-03T22:00:00Z', { timeKnown: false })
    const onl = ev('onl-2026', '2026-08-25T18:00:00Z')
    const { live, upcoming, past } = splitEvents([tgs, sop, tga, onl, gdc], now)
    expect(live.map((e) => e.slug)).toEqual(['tga-2026'])
    expect(upcoming.map((e) => e.slug)).toEqual(['gdc-2027', 'tgs-2027'])
    expect(past.map((e) => e.slug)).toEqual(['sop-sept-2026', 'onl-2026'])
  })

  it('a show is over 4 hours after its start; an expo at the end of its last day', () => {
    const tga = ev('tga', '2026-12-11T01:00:00Z')
    expect(splitEvents([tga], Date.parse('2026-12-11T05:30:00Z')).past).toHaveLength(1)
    const expo = ev('expo', '2027-08-25T00:00:00Z', { timeKnown: false, endAt: '2027-08-29T00:00:00Z' })
    expect(splitEvents([expo], Date.parse('2027-08-27T10:00:00Z')).live).toHaveLength(1)
    expect(splitEvents([expo], Date.parse('2027-08-31T10:00:00Z')).past).toHaveLength(1)
  })

  it('groups by month, counts the days, keeps only web links', () => {
    const list = [ev('a', '2027-03-01T00:00:00Z'), ev('b', '2027-03-20T00:00:00Z'), ev('c', '2027-06-05T00:00:00Z')]
    expect(groupByMonth(list).map((g) => [g.month, g.events.length])).toEqual([
      ['2027-03', 2],
      ['2027-06', 1],
    ])
    expect(daysUntil(ev('tga', '2026-12-11T01:00:00Z'), Date.parse('2026-11-27T09:00:00Z'))).toBe(14)
    // Dec 10 at 8 pm in New York: 13 days there.
    expect(daysUntil(ev('tga', '2026-12-11T01:00:00Z'), Date.parse('2026-11-27T09:00:00Z'), 'America/New_York')).toBe(13)
    expect(daysUntil(ev('gdc', '2027-03-01T00:00:00Z', { timeKnown: false }), Date.parse('2027-02-28T23:00:00Z'), 'Asia/Tokyo')).toBe(0)
    expect(safeUrl('https://youtube.com/@thegameawards')).toBe('https://youtube.com/@thegameawards')
    expect(safeUrl('javascript:alert(1)')).toBeNull()
    expect(safeUrl(null)).toBeNull()
  })
})
