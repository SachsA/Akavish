import { describe, expect, it } from 'vitest'
import type { Release } from './game-library'
import { groupRows, onPlatform, recentRows, releaseRows, upcomingRows } from './release-calendar'

const r = (date: string | null, precision: Release['precision'], platforms = ['ps5']): Release => ({ date, precision, platforms })
const games = [
  { slug: 'a', name: 'Alpha', releases: [r('2027-03-03', 'day')] },
  { slug: 'b', name: 'Bravo', releases: [r('2027-03-01', 'month')] },
  { slug: 'c', name: 'Charlie', releases: [r('2027-01-01', 'quarter', ['pc'])] },
  { slug: 'd', name: 'Delta', releases: [r('2027-01-01', 'year')] },
  { slug: 'e', name: 'Echo', releases: [r(null, 'tba')] },
  { slug: 'f', name: 'Foxtrot', releases: [r('2026-11-19', 'day'), r('2027-06-01', 'month', ['switch-2'])] },
  { slug: 'g', name: 'Golf', releases: [r('2025-01-10', 'day')] },
  { slug: 'h', name: 'Hotel', releases: [r('2026-11-01', 'month')] },
]
const today = '2026-11-27'

describe('release calendar', () => {
  const rows = releaseRows(games)

  it('one row per release: a later port is its own line', () => {
    expect(rows.filter((x) => x.game.slug === 'f')).toHaveLength(2)
  })

  it('upcoming: a firm date before the vaguer period around it, TBA last', () => {
    // Hotel (November 2026) still counts until the month is over.
    expect(upcomingRows(rows, today, 'en').map((x) => x.game.slug)).toEqual(['h', 'a', 'b', 'c', 'f', 'd', 'e'])
  })

  it('out lately: latest first, older than six months left out', () => {
    // Hotel (November 2026) isn't out until the month is over.
    expect(recentRows(rows, today, 'en').map((x) => x.game.slug)).toEqual(['f'])
    expect(recentRows(rows, '2026-12-05', 'en').map((x) => x.game.slug)).toEqual(['f', 'h'])
  })

  it('headings by period, consecutive rows together; filter by console', () => {
    const groups = groupRows(upcomingRows(rows, today, 'en'), 'en')
    expect(groups.map((g) => [g.label, g.rows.length])).toEqual([
      ['November 2026', 1],
      ['March 2027', 2],
      ['Q1 2027', 1],
      ['June 2027', 1],
      ['2027', 1],
      ['TBA', 1],
    ])
    expect(groupRows(upcomingRows(rows, today, 'fr'), 'fr')[2].label).toBe('T1 2027')
    expect(onPlatform(upcomingRows(rows, today, 'en'), 'pc').map((x) => x.game.slug)).toEqual(['c'])
  })
})
