import { describe, expect, it } from 'vitest'
import { cleanReleases, mergeReleases, parseReleaseDate, period, summarize, type Release } from './game-releases'

const r = (platforms: Release['platforms'], text: string): Release => ({ platforms, ...parseReleaseDate(text)! })

describe('parseReleaseDate', () => {
  it('reads every precision', () => {
    expect(parseReleaseDate('2026-11-19')).toEqual({ date: '2026-11-19', precision: 'day' })
    expect(parseReleaseDate('2026-11')).toEqual({ date: '2026-11-01', precision: 'month' })
    expect(parseReleaseDate('2027-q3')).toEqual({ date: '2027-07-01', precision: 'quarter' })
    expect(parseReleaseDate('2027')).toEqual({ date: '2027-01-01', precision: 'year' })
    expect(parseReleaseDate('TBA')).toEqual({ date: null, precision: 'tba' })
    expect(parseReleaseDate('')).toEqual({ date: null, precision: 'tba' })
  })
  it('refuses junk', () => {
    expect(parseReleaseDate('2026-02-30')).toBeNull()
    expect(parseReleaseDate('Late 2027')).toBeNull()
    expect(parseReleaseDate('1850')).toBeNull()
  })
})

describe('period', () => {
  it('spans the month, quarter or year', () => {
    expect(period(r([], '2027-Q4'))).toEqual(['2027-10-01', '2027-12-31'])
    expect(period(r([], '2028-02'))).toEqual(['2028-02-01', '2028-02-29'])
    expect(period(r([], 'TBA'))).toBeNull()
  })
})

describe('cleanReleases + summarize', () => {
  it('reads the consoles as stored, finds the first date, rounds the admin time zone', () => {
    const rows = cleanReleases([
      // ids, populated docs and slugs all read as the console; junk goes.
      { platforms: [12, { id: 13 }, '14', null, '', 12], date: '2022-02-15T00:00:00.000Z', precision: 'day' },
      { platforms: ['pc', 'ps4', 'xbox-one'], date: '2020-12-09T23:00:00.000Z', precision: 'day' }, // Paris midnight
      { platforms: ['switch-2'], date: null, precision: 'tba' },
    ])
    expect(rows[0].platforms).toEqual([12, 13, 14])
    expect(rows[1].date).toBe('2020-12-10')
    expect(summarize(rows)).toEqual({
      // The oldest release's consoles first.
      platforms: ['pc', 'ps4', 'xbox-one', 12, 13, 14, 'switch-2'],
      releaseDate: '2020-12-10T00:00:00.000Z',
      releaseDatePrecision: 'day',
    })
    expect(summarize(cleanReleases([{ platforms: ['pc'], precision: 'tba' }])).releaseDatePrecision).toBe('tba')
    expect(summarize([])).toEqual({ platforms: [], releaseDate: null, releaseDatePrecision: null })
  })
})

describe('mergeReleases', () => {
  const today = '2026-11-17'
  it('a delay replaces the date of those consoles', () => {
    const out = mergeReleases([r(['ps5', 'xbox-series'], '2026-05-26')], [r(['ps5', 'xbox-series'], '2026-11-19')], today)
    expect(out).toEqual([r(['ps5', 'xbox-series'], '2026-11-19')])
  })
  it('a new console is a new row, the others stay', () => {
    const out = mergeReleases([r(['pc', 'ps4', 'xbox-one'], '2020-12-10')], [r(['switch-2'], '2025-06-05')], today)
    expect(out).toEqual([r(['pc', 'ps4', 'xbox-one'], '2020-12-10'), r(['switch-2'], '2025-06-05')])
  })
  it('splits a row when one console moves', () => {
    const out = mergeReleases([r(['pc', 'ps5', 'xbox-series'], '2027')], [r(['ps5'], '2027-03-12')], today)
    expect(out).toHaveLength(2)
    expect(out.find((x) => x.platforms.includes('ps5'))).toEqual(r(['ps5'], '2027-03-12'))
    expect(out.find((x) => x.platforms.includes('pc'))).toEqual(r(['pc', 'xbox-series'], '2027'))
  })
  it('joins a row with the same date', () => {
    const out = mergeReleases([r(['ps5'], '2027-03-12'), r(['pc'], 'TBA')], [r(['pc'], '2027-03-12')], today)
    expect(out).toEqual([r(['ps5', 'pc'], '2027-03-12')])
  })
  it('a vaguer date that agrees changes nothing', () => {
    const known = [r(['ps5', 'xbox-series'], '2026-11-19')]
    expect(mergeReleases(known, [r(['ps5'], '2026')], today)).toEqual(known)
    expect(mergeReleases(known, [r(['ps5'], 'TBA')], today)).toEqual(known)
    expect(mergeReleases(known, [r([], '2026-Q4')], today)).toEqual(known)
  })
  it('a vaguer date that disagrees wins (delayed to 2027)', () => {
    const out = mergeReleases([r(['ps5'], '2026-11-19')], [r(['ps5'], '2027')], today)
    expect(out).toEqual([r(['ps5'], '2027')])
  })
  it('no consoles named: moves what is not out yet', () => {
    const out = mergeReleases(
      [r(['pc'], '2024-04-18'), r(['ps5', 'xbox-series'], 'TBA')],
      [r([], '2027-Q2')],
      today,
    )
    expect(out).toEqual([r(['pc'], '2024-04-18'), r(['ps5', 'xbox-series'], '2027-Q2')])
    expect(mergeReleases([], [r([], '2027')], today)).toEqual([r([], '2027')])
  })
  it('consoles named replace a row whose consoles were unknown', () => {
    expect(mergeReleases([r([], 'TBA')], [r(['pc', 'ps5'], '2027-09')], today)).toEqual([r(['pc', 'ps5'], '2027-09')])
  })
})
