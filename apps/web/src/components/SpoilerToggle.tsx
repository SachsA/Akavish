'use client'

// The anti-spoil switch, above every esport page (EsportNav). For a visitor it
// is remembered on this device; for a signed-in reader it lasts for the visit,
// their default being on /account ("Default setting" link). lib/spoilers.ts.

import { useSyncExternalStore } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from './LocaleLink'
import { useI18n } from './I18nProvider'
import { chooseSpoilers, spoilersHidden, subscribeSpoilers } from '@/lib/spoilers'

export function useSpoilersHidden(): boolean | null {
  return useSyncExternalStore<boolean | null>(subscribeSpoilers, spoilersHidden, () => null)
}

export function SpoilerToggle() {
  const { t } = useI18n()
  const { isSignedIn } = useUser()
  const hidden = useSpoilersHidden()
  const on = hidden === true

  return (
    <div
      className={`mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border px-4 py-3 transition-colors ${
        on ? 'border-emerald-500/60 bg-emerald-500/10' : 'border-zinc-800 bg-zinc-900/50'
      }`}
    >
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={hidden === null}
        onClick={() => chooseSpoilers(on ? 'show' : 'hide', Boolean(isSignedIn))}
        className="inline-flex items-center gap-3 text-sm font-semibold text-white"
      >
        <EyeIcon off={on} />
        <span className="whitespace-nowrap">{t.spoilers.switchLabel}</span>
        <span
          aria-hidden="true"
          className={`relative inline-block h-6 w-11 shrink-0 rounded-full transition-colors ${
            on ? 'bg-emerald-500' : 'bg-zinc-700'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-[#ffffff] shadow-sm transition-transform ${
              on ? 'translate-x-5' : ''
            }`}
          />
        </span>
        {/* The state in words from sm up; on a phone the switch alone (aria-checked). */}
        <span className={`hidden whitespace-nowrap sm:inline ${on ? 'text-emerald-400' : 'text-zinc-400'}`}>
          {on ? t.spoilers.hidden : t.spoilers.shown}
        </span>
      </button>
      <span className="text-xs text-zinc-400">
        {on ? t.spoilers.hiddenHint : t.spoilers.shownHint}
      </span>
      <Link
        href="/account#preferences"
        className="ml-auto text-xs font-semibold text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
      >
        {t.spoilers.defaultLink}
      </Link>
    </div>
  )
}

export function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M3 3l18 18" />}
    </svg>
  )
}
