'use client'

// /account → Preferences: what the followed teams, tournaments and matches
// notify the reader of (match starts, results, news and transfers). Saved in
// the CMS (Readers → notify), which makes the notifications.

import { useEffect, useState } from 'react'
import { useI18n } from './I18nProvider'
import type { NotifySettings as Settings } from '@/lib/readers'

const KEYS: Array<keyof Settings> = ['matchStart', 'results', 'news']

export function NotifySettings() {
  const { t } = useI18n()
  const [s, setS] = useState<Settings | null>(null)
  const [state, setState] = useState<'idle' | 'saved' | 'error'>('idle')

  useEffect(() => {
    fetch('/api/notify-settings')
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d: Settings) => setS(d))
      .catch(() => setS({ matchStart: true, results: true, news: true }))
  }, [])

  async function flip(key: keyof Settings) {
    if (!s) return
    const next = { ...s, [key]: !s[key] }
    setS(next)
    try {
      const r = await fetch('/api/notify-settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ settings: next }),
      })
      if (!r.ok) throw new Error()
      setState('saved')
    } catch {
      setS(s)
      setState('error')
    }
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <p className="text-sm font-semibold text-white">{t.bell.settingsTitle}</p>
      <p className="mt-1 mb-3 text-xs text-zinc-400">{t.bell.settingsHint}</p>
      <ul className="space-y-2">
        {KEYS.map((key) => (
          <li key={key} className="flex items-center justify-between gap-4 text-sm text-zinc-200">
            <span>{t.bell[key]}</span>
            <button
              type="button"
              role="switch"
              aria-checked={s?.[key] === true}
              aria-label={t.bell[key]}
              disabled={s === null}
              onClick={() => flip(key)}
              className={`relative inline-block h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
                s?.[key] ? 'bg-emerald-500' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-[#ffffff] shadow-sm transition-transform ${
                  s?.[key] ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </li>
        ))}
      </ul>
      <p role="status" className="mt-2 text-xs">
        {state === 'saved' && <span className="text-emerald-400">{t.spoilers.saved}</span>}
        {state === 'error' && <span className="text-danger">{t.spoilers.error}</span>}
      </p>
    </div>
  )
}
