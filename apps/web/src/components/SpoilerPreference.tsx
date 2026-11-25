'use client'

// /account → Preferences: hide esport scores by default. Saved on the reader's
// Clerk account (unsafeMetadata.hideScores: a display choice, nothing
// private), so it follows them on every device; also applied right away.

import { useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { useI18n } from './I18nProvider'
import { setDefaultSpoilers } from '@/lib/spoilers'

export function SpoilerPreference() {
  const { t } = useI18n()
  const { user, isLoaded } = useUser()
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const on = user?.unsafeMetadata?.hideScores === true

  async function toggle() {
    if (!user) return
    const next = !on
    setState('saving')
    try {
      await user.update({ unsafeMetadata: { ...user.unsafeMetadata, hideScores: next } })
      setDefaultSpoilers(next ? 'hide' : 'show', { endVisit: true })
      // A copy for the CMS: a result's push notification then leaves the score out.
      void fetch('/api/notify-settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ settings: { hideScores: next } }),
      }).catch(() => undefined)
      setState('saved')
    } catch {
      setState('error')
    }
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <label className="flex items-center justify-between gap-4">
        <span className="text-sm font-semibold text-white">{t.spoilers.prefHide}</span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={t.spoilers.prefHide}
          disabled={!isLoaded || state === 'saving'}
          onClick={toggle}
          className={`relative inline-block h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
            on ? 'bg-emerald-500' : 'bg-zinc-700'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-[#ffffff] shadow-sm transition-transform ${
              on ? 'translate-x-5' : ''
            }`}
          />
        </button>
      </label>
      <p className="mt-2 text-xs text-zinc-400">{t.spoilers.prefHint}</p>
      <p role="status" className="mt-1 text-xs">
        {state === 'saved' && <span className="text-emerald-400">{t.spoilers.saved}</span>}
        {state === 'error' && <span className="text-danger">{t.spoilers.error}</span>}
      </p>
    </div>
  )
}
