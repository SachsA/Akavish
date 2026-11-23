'use client'

// The language menu in the header, next to the theme switch: the current flag,
// and a small list 🇬🇧 EN · 🇺🇸 EN · 🇫🇷 FR. The two English entries only change
// how dates are written; French moves to the /fr version of the same page.
//
// The choice goes in two cookies (read by the proxy on the next visit, so a
// French reader who picked English isn't sent back to /fr) and, when signed
// in, in the Clerk account (`unsafeMetadata.locale` / `.region`), so a new
// device picks it up on the first page.
//
// Flags are inline SVG, not emoji: Windows shows emoji flags as two letters.

import { useUser } from '@clerk/nextjs'
import { useEffect, useId, useRef, useState } from 'react'
import {
  COOKIE_MAX_AGE,
  isLocale,
  isRegion,
  LOCALE_COOKIE,
  localizePath,
  REGION_COOKIE,
  stripLocale,
  type Locale,
  type Region,
} from '@/lib/i18n/config'
import { regionChanged, useI18n, useRegion } from './I18nProvider'

type Choice = 'en-GB' | 'en-US' | 'fr'

const CHOICES: Array<{ id: Choice; locale: Locale; region?: Region; code: string }> = [
  { id: 'en-GB', locale: 'en', region: 'GB', code: 'EN' },
  { id: 'en-US', locale: 'en', region: 'US', code: 'EN' },
  { id: 'fr', locale: 'fr', code: 'FR' },
]

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`
}

function hasCookie(name: string) {
  return document.cookie.split('; ').some((c) => c.startsWith(`${name}=`))
}

/** Remember the choice, then show the page in that language. */
function apply(locale: Locale, region: Region | undefined, current: Locale) {
  setCookie(LOCALE_COOKIE, locale)
  if (region) setCookie(REGION_COOKIE, region)
  if (locale !== current) {
    const { pathname, search, hash } = window.location
    window.location.assign(localizePath(locale, stripLocale(pathname)) + search + hash)
  } else {
    regionChanged()
  }
}

export function LanguageMenu() {
  const { locale, t } = useI18n()
  const region = useRegion()
  const { user, isSignedIn } = useUser()
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)

  const current: Choice = locale === 'fr' ? 'fr' : region === 'GB' ? 'en-GB' : 'en-US'

  // A signed-in reader on a device that never chose: take the account's choice.
  useEffect(() => {
    if (!isSignedIn || !user || hasCookie(LOCALE_COOKIE)) return
    const saved = user.unsafeMetadata as { locale?: unknown; region?: unknown }
    if (!isLocale(saved.locale)) return
    apply(saved.locale, isRegion(saved.region) ? saved.region : undefined, locale)
  }, [isSignedIn, user, locale])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function choose(choice: (typeof CHOICES)[number]) {
    setOpen(false)
    if (isSignedIn && user) {
      // Best effort: the cookie already holds the choice on this device.
      user
        .update({
          unsafeMetadata: {
            ...user.unsafeMetadata,
            locale: choice.locale,
            ...(choice.region ? { region: choice.region } : {}),
          },
        })
        .catch(() => {})
    }
    apply(choice.locale, choice.region, locale)
  }

  const currentLabel = t.language.options[current]

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={t.language.current(currentLabel)}
        title={t.language.current(currentLabel)}
        className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-zinc-900 transition-colors"
      >
        <Flag id={current} />
      </button>
      {open && (
        <ul
          id={menuId}
          role="menu"
          aria-label={t.language.menu}
          className="absolute right-0 top-full mt-2 z-50 min-w-26 rounded-lg border border-zinc-800 bg-zinc-950 py-1 shadow-xl shadow-black/40"
        >
          {CHOICES.map((choice) => (
            <li key={choice.id} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={choice.id === current}
                aria-label={t.language.options[choice.id]}
                onClick={() => choose(choice)}
                className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-sm transition-colors hover:bg-zinc-900 ${
                  choice.id === current ? 'text-white font-semibold' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Flag id={choice.id} />
                <span>{choice.code}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** 20×14 flags, simplified so they stay crisp at that size. */
function Flag({ id }: { id: Choice }) {
  const common = {
    width: 20,
    height: 14,
    'aria-hidden': true,
    className: 'rounded-[2px] ring-1 ring-black/20 shrink-0',
  }
  if (id === 'fr') {
    return (
      <svg viewBox="0 0 3 2" {...common}>
        <rect width="1" height="2" fill="#002654" />
        <rect x="1" width="1" height="2" fill="#ffffff" />
        <rect x="2" width="1" height="2" fill="#ce1126" />
      </svg>
    )
  }
  if (id === 'en-US') {
    return (
      <svg viewBox="0 0 19 13" {...common}>
        <rect width="19" height="13" fill="#ffffff" />
        {[0, 2, 4, 6, 8, 10, 12].map((y) => (
          <rect key={y} y={y} width="19" height="1" fill="#b22234" />
        ))}
        <rect width="8" height="7" fill="#3c3b6e" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 60 30" {...common}>
      <clipPath id="uk-flag-clip">
        <path d="M0,0 v30 h60 v-30 z" />
      </clipPath>
      <g clipPath="url(#uk-flag-clip)">
        <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#ffffff" strokeWidth="6" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#c8102e" strokeWidth="2" />
        <path d="M30,0 v30 M0,15 h60" stroke="#ffffff" strokeWidth="10" />
        <path d="M30,0 v30 M0,15 h60" stroke="#c8102e" strokeWidth="6" />
      </g>
    </svg>
  )
}
