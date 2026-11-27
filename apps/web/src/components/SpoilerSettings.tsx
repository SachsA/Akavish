'use client'

// What anti-spoil hides (lib/spoilers.ts, SpoilerPrefs): final scores, live
// scores, winners, whole brackets, result articles (blur / hide / show), for
// some games only, for the followed teams only. Saved at each change on this
// device and, signed in, on the Clerk account (unsafeMetadata.spoilerPrefs)
// so it follows the reader. On /account → Preferences and under the switch
// on every esport page (SpoilerToggle).

import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { ESPORT_GAME_LABEL, ESPORT_GAMES, type EsportGame } from '@/lib/esport'
import { PREFS_EVENT, savePrefs, storedPrefs, type SpoilerPart, type SpoilerPrefs } from '@/lib/spoilers'
import { useI18n } from './I18nProvider'

const chip = (on: boolean) =>
  `rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
    on ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300' : 'border-zinc-700 text-zinc-300 hover:border-zinc-500'
  }`

export function SpoilerSettings() {
  const { t } = useI18n()
  const { user, isSignedIn } = useUser()
  const [prefs, setPrefs] = useState<SpoilerPrefs | null>(null)
  const [state, setState] = useState<'idle' | 'saved' | 'error'>('idle')
  useEffect(() => {
    const read = () => setPrefs(storedPrefs())
    read()
    window.addEventListener(PREFS_EVENT, read)
    return () => window.removeEventListener(PREFS_EVENT, read)
  }, [])
  if (!prefs) return null

  async function change(patch: Partial<SpoilerPrefs>) {
    const next = { ...prefs!, ...patch }
    setPrefs(next)
    savePrefs(next)
    setState('idle')
    if (!user) return setState('saved')
    try {
      await user.update({ unsafeMetadata: { ...user.unsafeMetadata, spoilerPrefs: next } })
      // A copy for the CMS: a result's push leaves the score out.
      void fetch('/api/notify-settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ settings: { hideScores: user.unsafeMetadata?.hideScores === true && next.scores } }),
      }).catch(() => undefined)
      setState('saved')
    } catch {
      setState('error')
    }
  }

  const parts: Array<{ key: SpoilerPart; label: string; hint: string }> = [
    { key: 'scores', label: t.spoilers.partScores, hint: t.spoilers.partScoresHint },
    { key: 'live', label: t.spoilers.partLive, hint: t.spoilers.partLiveHint },
    { key: 'winners', label: t.spoilers.partWinners, hint: t.spoilers.partWinnersHint },
    { key: 'brackets', label: t.spoilers.partBrackets, hint: t.spoilers.partBracketsHint },
  ]
  const toggleGame = (g: EsportGame) =>
    change({ games: prefs.games.includes(g) ? prefs.games.filter((x) => x !== g) : [...prefs.games, g] })
  const heading = 'text-xs font-bold uppercase tracking-widest text-zinc-400'

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-white">{t.spoilers.settingsTitle}</p>
        <p className="mt-0.5 text-xs text-zinc-400">{t.spoilers.settingsHint}</p>
      </div>
      <ul className="space-y-3">
        {parts.map((p) => (
          <li key={p.key} className="flex items-start justify-between gap-4">
            <span>
              <span className="block text-sm text-zinc-100">{p.label}</span>
              <span className="block text-xs text-zinc-400">{p.hint}</span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={prefs[p.key]}
              aria-label={p.label}
              onClick={() => change({ [p.key]: !prefs[p.key] })}
              className={`relative mt-0.5 inline-block h-6 w-11 shrink-0 rounded-full transition-colors ${
                prefs[p.key] ? 'bg-emerald-500' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-[#ffffff] shadow-sm transition-transform ${
                  prefs[p.key] ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </li>
        ))}
      </ul>

      <div className="space-y-2">
        <p className={heading}>{t.spoilers.articles}</p>
        <p className="text-xs text-zinc-400">{t.spoilers.articlesHint}</p>
        <div role="radiogroup" aria-label={t.spoilers.articles} className="flex flex-wrap gap-2">
          {(['blur', 'hide', 'show'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={prefs.articles === v}
              onClick={() => change({ articles: v })}
              className={chip(prefs.articles === v)}
            >
              {v === 'blur' ? t.spoilers.articlesBlur : v === 'hide' ? t.spoilers.articlesHide : t.spoilers.articlesShow}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className={heading}>{t.spoilers.games}</p>
        <div role="group" aria-label={t.spoilers.games} className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={prefs.games.length === 0}
            onClick={() => change({ games: [] })}
            className={chip(prefs.games.length === 0)}
          >
            {t.spoilers.gamesAll}
          </button>
          {ESPORT_GAMES.map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={prefs.games.includes(g)}
              onClick={() => toggleGame(g)}
              className={chip(prefs.games.includes(g))}
            >
              {ESPORT_GAME_LABEL[g]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className={heading}>{t.spoilers.teams}</p>
        <div role="radiogroup" aria-label={t.spoilers.teams} className="flex flex-wrap gap-2">
          <button
            type="button"
            role="radio"
            aria-checked={prefs.teams === 'all'}
            onClick={() => change({ teams: 'all' })}
            className={chip(prefs.teams === 'all')}
          >
            {t.spoilers.teamsAll}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={prefs.teams === 'followed'}
            disabled={!isSignedIn}
            onClick={() => change({ teams: 'followed' })}
            className={`${chip(prefs.teams === 'followed')} disabled:opacity-50`}
          >
            {t.spoilers.teamsFollowed}
          </button>
        </div>
        {!isSignedIn && <p className="text-xs text-zinc-400">{t.spoilers.teamsSignIn}</p>}
      </div>

      <p role="status" className="text-xs">
        {state === 'saved' && <span className="text-emerald-400">{t.spoilers.saved}</span>}
        {state === 'error' && <span className="text-danger">{t.spoilers.error}</span>}
      </p>
    </div>
  )
}
