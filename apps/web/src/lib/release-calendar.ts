// ─── The release calendar (/games/releases) ──────────────────────────────────
// Every release of the games library (one row per group of consoles released
// together, so a later Switch 2 port is its own line), upcoming soonest first
// under "December 2026", "Q1 2027", "2027", "TBA", and the last six months'
// releases latest first under their month. Pure: the page and its tests.

import { dateGroupLabel, isOut, period, type LibraryGame, type Release } from './game-library'
import type { Locale } from './i18n/config'

export interface ReleaseRow {
  game: Pick<LibraryGame, 'slug' | 'name' | 'cover'>
  release: Release
}

/** How far back the "out" side goes. */
export const RECENT_DAYS = 183

const RANK: Record<Release['precision'], number> = { day: 0, month: 1, quarter: 2, year: 3, tba: 4 }

export function releaseRows(games: Array<Pick<LibraryGame, 'slug' | 'name' | 'cover' | 'releases'>>): ReleaseRow[] {
  return games.flatMap((g) =>
    g.releases.map((release) => ({ game: { slug: g.slug, name: g.name, cover: g.cover }, release })),
  )
}

/**
 * Not out yet, soonest first: by the last day it can fall on, so a firm date
 * comes before the vaguer period around it ("Mar 3, 2027", "March 2027",
 * "Q1 2027", then "2027"); TBA last.
 */
export function upcomingRows(rows: ReleaseRow[], today: string, locale: Locale): ReleaseRow[] {
  return rows
    .filter((r) => !isOut(r.release, today))
    .sort(
      (a, b) =>
        (period(a.release)?.[1] ?? '9999').localeCompare(period(b.release)?.[1] ?? '9999') ||
        RANK[a.release.precision] - RANK[b.release.precision] ||
        (a.release.date ?? '').localeCompare(b.release.date ?? '') ||
        a.game.name.localeCompare(b.game.name, locale),
    )
}

/** Out in the last `days` days, latest first. */
export function recentRows(rows: ReleaseRow[], today: string, locale: Locale, days = RECENT_DAYS): ReleaseRow[] {
  const since = new Date(Date.parse(`${today}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10)
  return rows
    .filter((r) => isOut(r.release, today) && (period(r.release)?.[0] ?? '') >= since)
    .sort(
      (a, b) =>
        (b.release.date ?? '').localeCompare(a.release.date ?? '') ||
        a.game.name.localeCompare(b.game.name, locale),
    )
}

/** Consecutive rows under the same heading ("December 2026", "Q1 2027", "TBA"). */
export function groupRows(rows: ReleaseRow[], locale: Locale): Array<{ label: string; rows: ReleaseRow[] }> {
  const out: Array<{ label: string; rows: ReleaseRow[] }> = []
  for (const r of rows) {
    const label = dateGroupLabel(r.release, locale)
    const last = out[out.length - 1]
    if (last && last.label === label) last.rows.push(r)
    else out.push({ label, rows: [r] })
  }
  return out
}

/** Only the rows on this console (all without one). */
export function onPlatform(rows: ReleaseRow[], platform?: string): ReleaseRow[] {
  return platform ? rows.filter((r) => r.release.platforms.includes(platform)) : rows
}
