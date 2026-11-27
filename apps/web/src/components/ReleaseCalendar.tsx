'use client'

// The release calendar's list (/games/releases): upcoming releases under
// their month, quarter or year, then the last six months', filtered by
// console in the browser (?platform=ps5 in the URL, shareable). The page
// sorts and groups (lib/release-calendar.ts).

import { useEffect, useMemo, useState } from 'react'
import { formatPlatforms, type Release } from '@/lib/game-library'
import { PLATFORM_FAMILIES, platformInfo, sortPlatforms, type PlatformInfo } from '@/lib/platforms'
import { groupRows, onPlatform, type ReleaseRow } from '@/lib/release-calendar'
import { GameCard } from './GameCard'
import { useI18n } from './I18nProvider'
import Link from './LocaleLink'
import { ReleaseDate } from './ReleaseDate'

const field =
  'h-9 rounded-md border border-zinc-800 bg-zinc-900 px-2 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-hidden'

export function ReleaseCalendar({
  upcoming,
  recent,
  platforms,
}: {
  upcoming: ReleaseRow[]
  recent: ReleaseRow[]
  platforms: PlatformInfo[]
}) {
  const { locale, t, href } = useI18n()
  const [platform, setPlatform] = useState<string | undefined>(undefined)
  useEffect(() => {
    const read = () => setPlatform(new URLSearchParams(window.location.search).get('platform') || undefined)
    read()
    window.addEventListener('popstate', read)
    return () => window.removeEventListener('popstate', read)
  }, [])
  const choose = (p: string | undefined) => {
    setPlatform(p)
    window.history.replaceState(null, '', `${href('/games/releases')}${p ? `?platform=${encodeURIComponent(p)}` : ''}`)
  }

  const consoles = useMemo(
    () => sortPlatforms([...new Set([...upcoming, ...recent].flatMap((r) => r.release.platforms))], platforms),
    [upcoming, recent, platforms],
  )
  const coming = useMemo(() => groupRows(onPlatform(upcoming, platform), locale), [upcoming, platform, locale])
  const out = useMemo(() => groupRows(onPlatform(recent, platform), locale), [recent, platform, locale])

  const line = (release: Release) => (
    <span className="block">
      {release.precision === 'day' && <ReleaseDate release={release} />}
      {release.platforms.length > 0 && (
        <span className="block truncate text-zinc-500">{formatPlatforms(release.platforms, platforms)}</span>
      )}
    </span>
  )
  const grid = (rows: ReleaseRow[]) => (
    <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {rows.map(({ game, release }) => (
        <li key={`${game.slug}-${release.date ?? 'tba'}-${release.platforms.join('.')}`}>
          <GameCard slug={game.slug} name={game.name} cover={game.cover} line={line(release)} />
        </li>
      ))}
    </ul>
  )
  const heading = 'text-xs uppercase tracking-widest text-zinc-400 mb-6 font-bold'
  const period = 'text-sm font-bold text-white mb-3'

  return (
    <div>
      <div className="mb-8">
        <select
          aria-label={t.games.console}
          value={platform ?? ''}
          onChange={(e) => choose(e.target.value || undefined)}
          className={field}
        >
          <option value="">{t.games.allConsoles}</option>
          {PLATFORM_FAMILIES.map((fam) => {
            const list = consoles.filter((p) => (platformInfo(p, platforms)?.family ?? 'other') === fam)
            if (!list.length) return null
            return (
              <optgroup key={fam} label={t.games.families[fam]}>
                {list.map((p) => (
                  <option key={p} value={p}>
                    {platformInfo(p, platforms)?.label ?? p}
                  </option>
                ))}
              </optgroup>
            )
          })}
        </select>
      </div>

      <section className="mb-12">
        <h2 className={heading}>{t.games.releasesUpcoming}</h2>
        {coming.length === 0 ? (
          <p className="text-zinc-400">{t.games.releasesNone}</p>
        ) : (
          <div className="space-y-8">
            {coming.map((g) => (
              <div key={g.label}>
                <h3 className={period}>{g.label}</h3>
                {grid(g.rows)}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className={heading}>{t.games.releasesRecent}</h2>
        {out.length === 0 ? (
          <p className="text-zinc-400">{t.games.releasesNone}</p>
        ) : (
          <div className="space-y-8">
            {out.map((g) => (
              <div key={g.label}>
                <h3 className={period}>{g.label}</h3>
                {grid(g.rows)}
              </div>
            ))}
          </div>
        )}
        <p className="mt-8">
          <Link
            href={`/games?status=out&sort=new${platform ? `&platform=${encodeURIComponent(platform)}` : ''}`}
            className="text-sm font-semibold text-emerald-400 hover:text-emerald-300"
          >
            {t.games.releasesOlder}
          </Link>
        </p>
      </section>
    </div>
  )
}
