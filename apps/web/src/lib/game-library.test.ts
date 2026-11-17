import { describe, expect, it } from 'vitest'
import { PLATFORMS as CMS_PLATFORMS } from '../../../cms/src/lib/platforms'
import {
  dateGroupLabel,
  effectiveSort,
  filterGames,
  filtersToQuery,
  formatPlatforms,
  formatRelease,
  isOut,
  parseFilters,
  platformsOf,
  releaseMatch,
  yearsOf,
  type LibraryGame,
  type Release,
} from './game-library'
import { PLATFORMS } from './platforms'

const r = (platforms: string[], date: string | null, precision: Release['precision'] = 'day'): Release => ({
  platforms,
  date,
  precision,
})
const game = (name: string, releases: Release[], extra: Partial<LibraryGame> = {}): LibraryGame => ({
  slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  name,
  releases,
  developers: [],
  publishers: [],
  genres: [],
  ...extra,
})
const TODAY = '2026-11-17'

const skyrim = game('Skyrim', [r(['pc', 'ps3', 'xbox-360'], '2011-11-11'), r(['switch'], '2017-11-17')], {
  publishers: ['bethesda-softworks'],
  genres: ['RPG'],
})
const gta = game('Grand Theft Auto VI', [r(['ps5', 'xbox-series'], '2026-11-19')], { publishers: ['rockstar-games'] })
const fable = game('Fable', [r(['pc', 'xbox-series'], '2027-11-01', 'month')])
const metro = game('Metro 2039', [r(['pc', 'ps5'], '2027-10-01', 'quarter')])
const witcher = game('The Witcher 4', [r(['pc', 'ps5'], null, 'tba')])
const all = [skyrim, gta, fable, metro, witcher]

describe('platforms', () => {
  it('match the CMS list, value for value', () => {
    expect(PLATFORMS.map((p) => p.value)).toEqual(CMS_PLATFORMS.map((p) => p.value))
  })
})

describe('URL filters', () => {
  it('round-trips, drops junk', () => {
    const f = parseFilters(new URLSearchParams('platform=ps5&year=2027&month=11&status=upcoming&sort=old&letter=g'))
    expect(f).toEqual({ platform: 'ps5', year: 2027, month: 11, status: 'upcoming', sort: 'old', letter: 'G' })
    expect(filtersToQuery(f)).toBe('?letter=G&platform=ps5&year=2027&month=11&status=upcoming&sort=old')
    expect(parseFilters(new URLSearchParams('platform=ps6&year=3000&month=4&status=soon&company=<x>'))).toEqual({})
    expect(filtersToQuery({})).toBe('')
  })
  it('sorts by date once a period or upcoming is asked', () => {
    expect(effectiveSort({})).toBe('az')
    expect(effectiveSort({ year: 2027 })).toBe('old')
    expect(effectiveSort({ status: 'out' })).toBe('new')
    expect(effectiveSort({ year: 2027, sort: 'az' })).toBe('az')
  })
})

describe('dates', () => {
  it('formats every precision in both languages', () => {
    expect(formatRelease(r([], '2026-11-19'), 'en', 'US')).toBe('Nov 19, 2026')
    expect(formatRelease(r([], '2026-11-19'), 'fr')).toBe('19 nov. 2026')
    expect(formatRelease(r([], '2027-11-01', 'month'), 'en')).toBe('November 2027')
    expect(formatRelease(r([], '2027-11-01', 'month'), 'fr')).toBe('Novembre 2027')
    expect(formatRelease(r([], '2027-10-01', 'quarter'), 'en')).toBe('Q4 2027')
    expect(formatRelease(r([], '2027-10-01', 'quarter'), 'fr')).toBe('T4 2027')
    expect(formatRelease(r([], '2027-01-01', 'year'), 'en')).toBe('2027')
    expect(formatRelease(r([], null, 'tba'), 'fr')).toBe('Date à venir')
    expect(formatPlatforms(['xbox-series', 'pc', 'ps5'])).toBe('PC, PS5, Xbox Series')
  })
  it('a month is out once it is over', () => {
    expect(isOut(r([], '2026-11-01', 'month'), TODAY)).toBe(false)
    expect(isOut(r([], '2026-10-01', 'month'), TODAY)).toBe(true)
    expect(isOut(r([], '2026-11-17'), TODAY)).toBe(true)
    expect(isOut(r([], null, 'tba'), TODAY)).toBe(false)
  })
})

describe('filtering', () => {
  it('console and year match the same release: the Switch port is 2017, not 2011', () => {
    expect(filterGames(all, { platform: 'switch', year: 2017 }, TODAY, 'en').map((h) => h.game.name)).toEqual(['Skyrim'])
    expect(filterGames(all, { platform: 'switch', year: 2011 }, TODAY, 'en')).toEqual([])
    const hit = filterGames(all, { platform: 'switch' }, TODAY, 'en')[0]
    expect(hit.release).toEqual(r(['switch'], '2017-11-17'))
  })
  it('a month shows exact dates first, coarser ones apart', () => {
    const hits = filterGames(all, { year: 2027, month: 11 }, TODAY, 'en')
    expect(hits.map((h) => [h.game.name, h.vague])).toEqual([
      ['Metro 2039', true],
      ['Fable', false],
    ])
    expect(releaseMatch(r([], '2027-07-01', 'quarter'), { year: 2027, month: 11 }, TODAY)).toBeNull()
  })
  it('upcoming, out, publisher, letter, name', () => {
    expect(filterGames(all, { status: 'upcoming' }, TODAY, 'en').map((h) => h.game.name)).toEqual([
      'Grand Theft Auto VI',
      'Metro 2039',
      'Fable',
      'The Witcher 4',
    ])
    expect(filterGames(all, { status: 'out' }, TODAY, 'en').map((h) => h.game.name)).toEqual(['Skyrim'])
    expect(filterGames(all, { company: 'rockstar-games' }, TODAY, 'en').map((h) => h.game.name)).toEqual([
      'Grand Theft Auto VI',
    ])
    expect(filterGames(all, { letter: 'T' }, TODAY, 'en').map((h) => h.game.name)).toEqual(['The Witcher 4'])
    expect(filterGames(all, { q: 'witch' }, TODAY, 'en').map((h) => h.game.name)).toEqual(['The Witcher 4'])
    expect(filterGames(all, { genre: 'RPG', sort: 'new' }, TODAY, 'en').map((h) => h.game.name)).toEqual(['Skyrim'])
  })
  it('date order keeps undated games last', () => {
    expect(filterGames(all, { sort: 'new' }, TODAY, 'en').map((h) => h.game.name)).toEqual([
      'Fable',
      'Metro 2039',
      'Grand Theft Auto VI',
      'Skyrim',
      'The Witcher 4',
    ])
  })
  it('menus and headings', () => {
    expect(yearsOf(all)).toEqual([2027, 2026, 2017, 2011])
    expect(platformsOf(all)).toEqual(['pc', 'ps5', 'ps3', 'xbox-series', 'xbox-360', 'switch'])
    expect(dateGroupLabel(r([], '2026-11-19'), 'fr')).toBe('Novembre 2026')
    expect(dateGroupLabel(undefined, 'en')).toBe('TBA')
  })
})
