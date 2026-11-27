'use client'

// A block that gives results away (a bracket, standings): blurred behind a
// "Show the results" button while scores are hidden (globals.css, `.akv-zone`;
// lib/spoilers.ts). Revealed for this page view only.

import { useState } from 'react'
import { useI18n } from '../I18nProvider'
import { EyeIcon } from '../SpoilerToggle'
import { spoilerData } from '@/lib/spoilers'

export function SpoilerZone({
  children,
  game,
  teams = [],
}: {
  children: React.ReactNode
  /** For the games and teams scope (lib/spoilers.ts). */
  game?: string
  teams?: Array<number | null | undefined>
}) {
  const { t } = useI18n()
  const [revealed, setRevealed] = useState(false)
  return (
    <div className="akv-zone relative" data-revealed={revealed || undefined} {...spoilerData({ game, teams })}>
      <div className="akv-zone-veil absolute inset-0 z-10 items-start justify-center pt-16">
        <div className="flex flex-col items-center gap-3 rounded-lg border border-emerald-500/60 bg-zinc-950/90 px-6 py-5 text-center">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-white">
            <EyeIcon off />
            {t.esport.resultsHidden}
          </span>
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="h-9 rounded-md bg-emerald-500 px-4 text-sm font-semibold text-[#ffffff] hover:bg-emerald-400"
          >
            {t.esport.showResults}
          </button>
        </div>
      </div>
      <div className="akv-zone-content">{children}</div>
    </div>
  )
}
