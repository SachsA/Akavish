'use client'

// The anti-spoil switch, above every esport page (EsportNav). For a visitor it
// is remembered on this device; for a signed-in reader it lasts for the visit,
// their default being on /account ("Default setting" link). lib/spoilers.ts.
// "Choose what is hidden" opens the settings right under it (SpoilerSettings);
// switching it on shows a small bubble pointing there for a few seconds.

import { useEffect, useState, useSyncExternalStore } from 'react'
import { SpoilerSettings } from './SpoilerSettings'
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
  const [open, setOpen] = useState(false)
  const [bubble, setBubble] = useState(false)
  useEffect(() => {
    if (!bubble) return
    const id = window.setTimeout(() => setBubble(false), 8000)
    return () => window.clearTimeout(id)
  }, [bubble])

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
        onClick={() => {
          chooseSpoilers(on ? 'show' : 'hide', Boolean(isSignedIn))
          setBubble(!on && !open)
        }}
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
      <span className="relative ml-auto flex items-center gap-4">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => {
            setOpen(!open)
            setBubble(false)
          }}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300"
        >
          <GearIcon />
          {open ? t.spoilers.settingsClose : t.spoilers.settingsOpen}
        </button>
        {isSignedIn && (
          <Link
            href="/account#preferences"
            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
          >
            {t.spoilers.defaultLink}
          </Link>
        )}
        {bubble && (
          // Right after switching on: where to choose what is hidden. Goes by itself.
          <button
            type="button"
            onClick={() => {
              setOpen(true)
              setBubble(false)
            }}
            className="absolute right-0 top-full z-30 mt-2 whitespace-nowrap rounded-lg border border-emerald-500/60 bg-zinc-950 px-3 py-2 text-xs font-semibold text-emerald-300 shadow-lg before:absolute before:-top-1.5 before:right-6 before:h-3 before:w-3 before:rotate-45 before:border-l before:border-t before:border-emerald-500/60 before:bg-zinc-950"
          >
            {t.spoilers.bubble}
          </button>
        )}
      </span>
      {open && (
        <div className="basis-full border-t border-zinc-800 pt-4">
          <SpoilerSettings />
        </div>
      )}
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

function GearIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  )
}

