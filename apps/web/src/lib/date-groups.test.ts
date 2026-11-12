import { describe, expect, it } from 'vitest'
import { groupByDate } from './date-groups'

const now = new Date('2026-11-12T15:00:00Z')
const a = (id: number, publishedAt?: string) => ({ id, publishedAt })

describe('groupByDate', () => {
  it('splits by day with Today and Yesterday, then full dates', () => {
    const groups = groupByDate(
      [
        a(1, '2026-11-12T14:00:00Z'),
        a(2, '2026-11-12T01:00:00Z'),
        a(3, '2026-11-11T23:59:00Z'),
        a(4, '2026-11-10T09:00:00Z'),
        a(5, '2025-12-11T09:00:00Z'),
      ],
      'day',
      now,
    )
    expect(groups.map((g) => g.label)).toEqual([
      'Today',
      'Yesterday',
      'Tuesday, November 10',
      'Thursday, December 11, 2025',
    ])
    expect(groups[0].items.map((i) => i.id)).toEqual([1, 2])
  })

  it('groups by year, and keeps undated items last', () => {
    const groups = groupByDate(
      [
        a(1, '2026-09-03T00:00:00Z'),
        a(2, '2026-06-02T00:00:00Z'),
        a(3),
        a(4, '2025-12-11T00:00:00Z'),
      ],
      'year',
      now,
    )
    expect(groups.map((g) => [g.label, g.items.length])).toEqual([
      ['2026', 2],
      ['2025', 1],
      ['Undated', 1],
    ])
  })
})
