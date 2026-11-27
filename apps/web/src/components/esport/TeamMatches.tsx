'use client'

// A team's next matches or last results (its page, 2026-11-27): the
// opponent, the score (anti-spoil: masked while scores are hidden, revealed
// one by one, globals.css `.akv-match`), the event. A row opens the match on
// its tournament page.

import { useState } from 'react'
import Link from '../LocaleLink'
import { useI18n, useRegion } from '../I18nProvider'
import { formatDate } from '@/lib/i18n/dates'
import { spoilerData } from '@/lib/spoilers'
import type { EsportRow } from '@/lib/esport'

export function TeamMatches({
  rows,
  team,
  teamPages,
}: {
  rows: EsportRow[]
  /** The page's team (PandaScore id): the other side is the opponent. */
  team: number
  /** Opponents with a page: PandaScore id → slug. */
  teamPages: Record<number, string>
}) {
  const { t, locale } = useI18n()
  const region = useRegion()
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set())
  return (
    <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800">
      {rows.map((r) => {
        const home = r.t1.id === team
        const us = home ? r.t1 : r.t2
        const them = home ? r.t2 : r.t1
        const live = r.status === 'running'
        const scored = (r.status === 'finished' || live) && r.s1 != null && r.s2 != null
        const ours = home ? r.s1 : r.s2
        const theirs = home ? r.s2 : r.s1
        const won = scored && r.winner != null && (r.winner === 1) === home
        const lost = scored && r.winner != null && !won
        const slug = them.id != null ? teamPages[them.id] : undefined
        return (
          <li
            key={r.id}
            data-revealed={revealed.has(r.id) || undefined}
            {...spoilerData({ game: r.game, teams: [r.t1.id, r.t2.id], match: r.id })}
            className={`akv-match ${live ? 'akv-live ' : ''}relative flex items-center gap-3 px-4 py-2.5 text-sm`}
          >
            {r.tournamentSlug && (
              <Link
                href={`/esport/tournaments/${r.tournamentSlug}#match-${r.id}`}
                aria-label={t.esport.openMatch(r.t1.name, r.t2.name)}
                className="absolute inset-0"
              />
            )}
            <span className="w-20 shrink-0 text-xs text-zinc-400" suppressHydrationWarning>
              {live ? (
                <span className="font-bold uppercase text-red-400">{t.esport.live}</span>
              ) : (
                formatDate(r.at, { locale, region, style: 'short' })
              )}
            </span>
            <span className="min-w-0 flex-1 truncate">
              <span className="text-zinc-400">{t.esport.versus} </span>
              {slug ? (
                <Link href={`/esport/teams/${slug}`} className="relative z-10 font-semibold text-white hover:text-emerald-400">
                  {them.name}
                </Link>
              ) : (
                <span className="font-semibold text-white">{them.name}</span>
              )}
              <span className="ml-2 hidden text-xs text-zinc-500 sm:inline">{r.event}</span>
            </span>
            <span className="w-24 shrink-0 text-right font-bold tabular-nums">
              {scored ? (
                <>
                  <span className={`akv-score ${won ? 'text-emerald-400' : lost ? 'text-red-400' : 'text-white'}`}>
                    {won ? `${t.esport.winShort} ` : lost ? `${t.esport.lossShort} ` : ''}
                    {`${ours} – ${theirs}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setRevealed((s) => new Set(s).add(r.id))}
                    aria-label={t.spoilers.revealLabel(us.name, them.name)}
                    className="akv-mask relative z-10 h-7 w-full rounded-md border border-emerald-500/60 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/10"
                  >
                    {t.spoilers.reveal}
                  </button>
                </>
              ) : (
                <span className="text-xs font-normal text-zinc-400">{r.bestOf ? t.esport.bestOf(r.bestOf) : 'vs'}</span>
              )}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
