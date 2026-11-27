'use client'

// A competition's winner (the competitions pages, 2026-11-27): hidden behind
// "Show the winner" while anti-spoil hides winners (globals.css, `.akv-champ`;
// lib/spoilers.ts), for that game and, with "followed teams only", that team.
// Revealed one by one, for this page view.

import { useState } from 'react'
import { useI18n } from '../I18nProvider'
import { spoilerData } from '@/lib/spoilers'

export function ChampionReveal({
  children,
  game,
  team,
}: {
  children: React.ReactNode
  game: string
  /** PandaScore team id, for the followed-teams scope. */
  team: number | null
}) {
  const { t } = useI18n()
  const [revealed, setRevealed] = useState(false)
  return (
    <span
      className="akv-match inline-flex min-w-0 items-center"
      data-revealed={revealed || undefined}
      {...spoilerData({ game, teams: [team] })}
    >
      <span className="akv-champ min-w-0 items-center gap-2">{children}</span>
      <button
        type="button"
        onClick={() => setRevealed(true)}
        className="akv-champ-mask items-center rounded-full border border-zinc-700 px-2.5 py-0.5 text-xs text-zinc-300 hover:border-emerald-500 hover:text-white"
      >
        {t.esport.showWinner}
      </button>
    </span>
  )
}
