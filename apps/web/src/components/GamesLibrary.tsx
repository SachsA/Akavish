'use client'

// The games library's filters and grid (/games). Every game is in the page
// (a few hundred, small rows); filtering happens here, and the filters live
// in the URL (?platform=ps5&year=2027…) so a view can be shared or
// bookmarked. The page itself stays cached: the server renders the first
// cards A to Z, and the query is read here, in the browser, once mounted
// (not with useSearchParams, which would leave the server nothing to render).
// lib/game-library.ts has the logic.

import { useEffect, useMemo, useState } from 'react'
import {
  dateGroupLabel,
  effectiveSort,
  filterGames,
  filtersToQuery,
  formatPlatforms,
  letterOf,
  parseFilters,
  platformsOf,
  yearsOf,
  type LibraryCompany,
  type LibraryFilters,
  type LibraryGame,
  type LibraryHit,
} from '@/lib/game-library'
import { intlTag } from '@/lib/i18n/config'
import { PLATFORM_FAMILIES, platformInfo, type PlatformInfo } from '@/lib/platforms'
import { GameCard } from './GameCard'
import { useI18n, useRegion } from './I18nProvider'
import { ReleaseDate } from './ReleaseDate'

const STEP = 60
const LETTERS = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']

const field =
  'h-9 rounded-md border border-zinc-800 bg-zinc-900 px-2 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none'

export function GamesLibrary({
  games,
  companies,
  platforms: platformList,
  genres,
  today,
}: {
  games: LibraryGame[]
  companies: LibraryCompany[]
  /** Every console (CMS Platforms), in the site's order. */
  platforms: PlatformInfo[]
  genres: string[]
  /** The page's day (YYYY-MM-DD), so "upcoming" agrees with the server. */
  today: string
}) {
  const { locale, t, href } = useI18n()
  useRegion() // re-render when the reader switches the English date style
  // The query string: empty on the server, read from the address bar once
  // mounted, kept in step with back / forward.
  const [query, setQuery] = useState('')
  const [q, setQ] = useState('')
  useEffect(() => {
    const read = () => {
      setQuery(window.location.search)
      setQ(parseFilters(new URLSearchParams(window.location.search)).q ?? '')
    }
    read()
    window.addEventListener('popstate', read)
    return () => window.removeEventListener('popstate', read)
  }, [])
  const filters = useMemo(() => parseFilters(new URLSearchParams(query)), [query])
  // How many cards are shown; back to the first batch whenever the filters change.
  const [more, setMore] = useState({ key: '', n: STEP })
  const shown = more.key === query ? more.n : STEP

  const go = (next: LibraryFilters) => {
    if (!next.year) next.month = undefined
    const search = filtersToQuery(next)
    // Next keeps its router in step with history.replaceState.
    window.history.replaceState(null, '', `${href('/games')}${search}`)
    setQuery(search)
  }
  const set = (patch: Partial<LibraryFilters>) => go({ ...filters, ...patch })

  // The name box filters as you type, the URL follows a moment later.
  useEffect(() => {
    if ((filters.q ?? '') === q.trim()) return
    const id = setTimeout(() => set({ q: q.trim() || undefined }), 250)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const live = { ...filters, q: q.trim() || undefined }
  const hits = useMemo(() => filterGames(games, live, today, locale), [games, live.q, filters, today, locale]) // eslint-disable-line react-hooks/exhaustive-deps
  const sort = effectiveSort(filters)
  const years = useMemo(() => yearsOf(games), [games])
  const platforms = useMemo(() => platformsOf(games, platformList), [games, platformList])
  const usedCompanies = useMemo(() => {
    const used = new Set(games.flatMap((g) => [...g.developers, ...g.publishers]))
    return companies.filter((c) => used.has(c.slug))
  }, [games, companies])
  // Letters that have games once the other filters apply.
  const lettersWithGames = useMemo(
    () => new Set(filterGames(games, { ...live, letter: undefined }, today, locale).map((h) => letterOf(h.game.name))),
    [games, live.q, filters, today, locale], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const monthName = (m: number) => {
    const s = new Date(Date.UTC(2000, m - 1, 1)).toLocaleDateString(intlTag(locale), { month: 'long', timeZone: 'UTC' })
    return s.charAt(0).toUpperCase() + s.slice(1)
  }
  const active = Object.keys(filters).some((k) => k !== 'sort')

  // Groups: by letter (A to Z) or by period (by date). Under a month, the
  // games whose date is only known to the quarter or the year come last.
  const exact = hits.filter((h) => !h.vague)
  const vague = hits.filter((h) => h.vague)
  const visible = [...exact, ...vague].slice(0, shown)
  const groups: Array<{ key: string; label: string; hits: LibraryHit[] }> = []
  for (const h of visible) {
    const label = h.vague
      ? t.games.vague
      : sort === 'az'
        ? letterOf(h.game.name)
        : dateGroupLabel(h.release, locale)
    const last = groups.at(-1)
    if (last && last.label === label) last.hits.push(h)
    else groups.push({ key: `${groups.length}-${label}`, label, hits: [h] })
  }

  return (
    <div>
      <form
        role="search"
        aria-label={t.games.filters}
        onSubmit={(e) => e.preventDefault()}
        className="mb-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-2"
      >
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t.games.search}
          aria-label={t.games.search}
          className={`${field} col-span-2 sm:col-span-3 lg:col-span-4 xl:col-span-2`}
        />
        <select
          aria-label={t.games.console}
          value={filters.platform ?? ''}
          onChange={(e) => set({ platform: e.target.value || undefined })}
          className={field}
        >
          <option value="">{t.games.allConsoles}</option>
          {PLATFORM_FAMILIES.map((fam) => {
            const list = platforms.filter((p) => (platformInfo(p, platformList)?.family ?? 'other') === fam)
            if (!list.length) return null
            return (
              <optgroup key={fam} label={t.games.families[fam]}>
                {list.map((p) => (
                  <option key={p} value={p}>
                    {platformInfo(p, platformList)?.label ?? p}
                  </option>
                ))}
              </optgroup>
            )
          })}
        </select>
        <select
          aria-label={t.games.year}
          value={filters.year ?? ''}
          onChange={(e) => set({ year: e.target.value ? Number(e.target.value) : undefined })}
          className={field}
        >
          <option value="">{t.games.anyYear}</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <select
          aria-label={t.games.month}
          value={filters.month ?? ''}
          disabled={!filters.year}
          onChange={(e) => set({ month: e.target.value ? Number(e.target.value) : undefined })}
          className={`${field} disabled:opacity-50`}
        >
          <option value="">{t.games.anyMonth}</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {monthName(m)}
            </option>
          ))}
        </select>
        <select
          aria-label={t.games.company}
          value={filters.company ?? ''}
          onChange={(e) => set({ company: e.target.value || undefined })}
          className={field}
        >
          <option value="">{t.games.anyCompany}</option>
          {usedCompanies.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          aria-label={t.games.genre}
          value={filters.genre ?? ''}
          onChange={(e) => set({ genre: e.target.value || undefined })}
          className={field}
        >
          <option value="">{t.games.anyGenre}</option>
          {genres.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <select
          aria-label={t.games.sort}
          value={sort}
          onChange={(e) => set({ sort: e.target.value as LibraryFilters['sort'] })}
          className={field}
        >
          <option value="az">{t.games.sortAz}</option>
          <option value="new">{t.games.sortNew}</option>
          <option value="old">{t.games.sortOld}</option>
        </select>
      </form>

      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-3">
        <div role="group" aria-label={t.games.status} className="inline-flex rounded-md border border-zinc-800 p-0.5">
          {(
            [
              [undefined, t.games.statusAll],
              ['out', t.games.statusOut],
              ['upcoming', t.games.statusUpcoming],
            ] as const
          ).map(([value, label]) => (
            <button
              key={label}
              type="button"
              aria-pressed={filters.status === value}
              onClick={() => set({ status: value })}
              className={`px-3 h-8 rounded text-sm transition-colors ${
                filters.status === value ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-sm text-zinc-400" aria-live="polite">
          {t.games.results(hits.length)}
        </p>
        {active && (
          <button
            type="button"
            onClick={() => {
              setQ('')
              go({})
            }}
            className="text-sm text-emerald-400 hover:text-emerald-300"
          >
            {t.games.reset}
          </button>
        )}
      </div>

      <nav aria-label={t.games.letters} className="mb-8 flex flex-wrap gap-1">
        <button
          type="button"
          aria-pressed={!filters.letter}
          onClick={() => set({ letter: undefined })}
          className={`h-8 px-2.5 rounded-md border text-sm transition-colors ${
            !filters.letter ? 'border-emerald-500 text-white' : 'border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700'
          }`}
        >
          {t.games.allLetters}
        </button>
        {LETTERS.map((l) => {
          const on = filters.letter === l
          const empty = !lettersWithGames.has(l)
          return (
            <button
              key={l}
              type="button"
              aria-pressed={on}
              disabled={empty && !on}
              onClick={() => set({ letter: on ? undefined : l })}
              className={`w-8 h-8 inline-flex items-center justify-center rounded-md border text-sm transition-colors disabled:opacity-30 disabled:cursor-default ${
                on ? 'border-emerald-500 text-white' : 'border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700'
              }`}
            >
              {l}
            </button>
          )
        })}
      </nav>

      {hits.length === 0 ? (
        <p className="text-zinc-400">{t.games.noResults}</p>
      ) : (
        <div className="space-y-10">
          {groups.map((g) => (
            <section key={g.key} aria-label={g.label}>
              <h2 className="mb-4 pb-2 border-b border-zinc-800 text-sm font-semibold uppercase tracking-wider text-zinc-400">
                {g.label}
              </h2>
              <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {g.hits.map((h) => (
                  <li key={h.game.slug}>
                    <GameCard
                      slug={h.game.slug}
                      name={h.game.name}
                      cover={h.game.cover}
                      line={
                        h.release ? (
                          <>
                            <ReleaseDate release={h.release} />
                            {h.release.platforms.length > 0 && <> · {formatPlatforms(h.release.platforms, platformList)}</>}
                          </>
                        ) : undefined
                      }
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {hits.length > shown && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => setMore({ key: query, n: shown + STEP })}
                className="px-4 h-10 rounded-md border border-zinc-700 text-sm text-zinc-200 hover:border-emerald-500 hover:text-white"
              >
                {t.games.more(Math.min(STEP, hits.length - shown))}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
