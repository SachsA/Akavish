// ─── Anti-spoil: hide esport scores ──────────────────────────────────────────
// One switch, "hide scores", read by the whole site from <html data-spoilers>:
// "hide" blurs the result articles in lists (Article.spoiler) and hides the
// scores of /esport/results and /esport/calendar; a match or a card can still
// be revealed one by one. Decided in the browser, so every page stays cached.
//
// Where the choice comes from (2026-11-25, Alex):
//   1. this visit: the switch on a page, for a signed-in reader (sessionStorage);
//   2. the default: a visitor's switch (kept on this device), or the reader's
//      setting on /account (Clerk unsafeMetadata.hideScores, copied here);
//   3. otherwise scores are shown.
// The inline script in layout.tsx applies it before the first paint.
//
// What "hide" hides (2026-11-27, Alex): each reader picks (SpoilerPrefs,
// components/SpoilerSettings.tsx), everything by default. Final scores, live
// scores, winners and eliminated, whole brackets and standings, result
// articles (blurred, hidden from the lists, or shown), for some games only,
// for the teams they follow only. The categories are attributes on <html>
// read by globals.css (`data-sp-off`, `data-sp-hide`), set before the first
// paint too; the games and teams scope marks what stays visible with
// `.akv-free` once the page is up (components/SpoilerScope.tsx), so the safe
// way round: hidden first, shown after. Kept on this device
// (`akv-spoiler-prefs`) and, signed in, on the Clerk account
// (unsafeMetadata.spoilerPrefs), so it follows the reader.

import type { EsportGame } from './esport'

export type SpoilerMode = 'hide' | 'show'

export const SPOILER_VISIT_KEY = 'akv-spoilers-visit'
export const SPOILER_DEFAULT_KEY = 'akv-spoilers'

const valid = (v: unknown): v is SpoilerMode => v === 'hide' || v === 'show'

/** The mode from the stored values (pure, unit-tested). */
export function resolveSpoilers(visit: unknown, fallback: unknown): SpoilerMode {
  if (valid(visit)) return visit
  if (valid(fallback)) return fallback
  return 'show'
}

// ─── What to hide ────────────────────────────────────────────────────────────

export const SPOILER_PREFS_KEY = 'akv-spoiler-prefs'

/** The categories a reader can leave visible while scores are hidden. */
export const SPOILER_PARTS = ['scores', 'live', 'winners', 'brackets'] as const
export type SpoilerPart = (typeof SPOILER_PARTS)[number]

export interface SpoilerPrefs {
  /** Finished matches' scores (results, calendar, brackets, standings' records, the bell, push). */
  scores: boolean
  /** Scores of matches being played. */
  live: boolean
  /** Who won: the winner in bold, "qualified" / "eliminated", a bracket's winners. */
  winners: boolean
  /** A tournament's whole bracket and standings, blurred behind a button. */
  brackets: boolean
  /** Result articles in the lists: blurred, gone, or shown. */
  articles: 'blur' | 'hide' | 'show'
  /** Only these games; empty: every game. */
  games: EsportGame[]
  /** Every team, or only the teams (and matches) the reader follows. */
  teams: 'all' | 'followed'
}

export const DEFAULT_SPOILER_PREFS: SpoilerPrefs = {
  scores: true,
  live: true,
  winners: true,
  brackets: true,
  articles: 'blur',
  games: [],
  teams: 'all',
}

const GAMES: readonly EsportGame[] = ['cs2', 'valorant', 'lol', 'r6', 'rl']

/** Stored or synced prefs, cleaned: anything unknown takes the default (pure, tested). */
export function parsePrefs(raw: unknown): SpoilerPrefs {
  let v: unknown = raw
  if (typeof raw === 'string') {
    try {
      v = JSON.parse(raw)
    } catch {
      v = null
    }
  }
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  const bool = (k: SpoilerPart) => (typeof o[k] === 'boolean' ? (o[k] as boolean) : DEFAULT_SPOILER_PREFS[k])
  return {
    scores: bool('scores'),
    live: bool('live'),
    winners: bool('winners'),
    brackets: bool('brackets'),
    articles: o.articles === 'hide' || o.articles === 'show' ? o.articles : 'blur',
    games: Array.isArray(o.games) ? GAMES.filter((g) => (o.games as unknown[]).includes(g)) : [],
    teams: o.teams === 'followed' ? 'followed' : 'all',
  }
}

/** The <html> attributes for these prefs: what stays visible, what leaves the lists. */
export function prefsAttributes(p: SpoilerPrefs): { off: string; hide: string } {
  const off = SPOILER_PARTS.filter((k) => !p[k])
  if (p.articles === 'show') off.push('articles' as never)
  return { off: off.join(' '), hide: p.articles === 'hide' ? 'articles' : '' }
}

/** Runs before first paint (layout.tsx): same rules, no imports. */
export const RESTORE_SPOILERS = `try{var h=document.documentElement,v=sessionStorage.getItem('${SPOILER_VISIT_KEY}'),d=localStorage.getItem('${SPOILER_DEFAULT_KEY}'),m=v==='hide'||v==='show'?v:d==='hide'||d==='show'?d:'show';h.dataset.spoilers=m;var p=JSON.parse(localStorage.getItem('${SPOILER_PREFS_KEY}')||'{}')||{},o=[];['scores','live','winners','brackets'].forEach(function(k){if(p[k]===false)o.push(k)});if(p.articles==='show')o.push('articles');if(o.length)h.dataset.spOff=o.join(' ');if(p.articles==='hide')h.dataset.spHide='articles'}catch(e){}`

function read(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key)
  } catch {
    return null
  }
}

function write(storage: () => Storage, key: string, value: string | null) {
  try {
    if (value === null) storage().removeItem(key)
    else storage().setItem(key, value)
  } catch {
    // Storage blocked: the choice lasts for this page only.
  }
}

/** The mode the stored values give now. */
export function storedSpoilers(): SpoilerMode {
  return resolveSpoilers(
    read(() => sessionStorage, SPOILER_VISIT_KEY),
    read(() => localStorage, SPOILER_DEFAULT_KEY),
  )
}

/** Put the mode on <html> (and tell the open pages). */
export function applySpoilers(mode: SpoilerMode = storedSpoilers()) {
  document.documentElement.dataset.spoilers = mode
}

/** The switch on a page: for this visit (signed in) or as this device's default (visitor). */
export function chooseSpoilers(mode: SpoilerMode, signedIn: boolean) {
  if (signedIn) write(() => sessionStorage, SPOILER_VISIT_KEY, mode)
  else write(() => localStorage, SPOILER_DEFAULT_KEY, mode)
  applySpoilers(mode)
}

/** The reader's default (from /account, or read from Clerk at load): it also ends a visit's choice when set by hand. */
export function setDefaultSpoilers(mode: SpoilerMode, { endVisit }: { endVisit: boolean }) {
  write(() => localStorage, SPOILER_DEFAULT_KEY, mode)
  if (endVisit) write(() => sessionStorage, SPOILER_VISIT_KEY, null)
  applySpoilers()
}

/** For useSyncExternalStore: re-render when <html data-spoilers> changes. */
export function subscribeSpoilers(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-spoilers'],
  })
  return () => observer.disconnect()
}

export const spoilersHidden = () => document.documentElement.dataset.spoilers === 'hide'

/** The prefs kept on this device. */
export function storedPrefs(): SpoilerPrefs {
  return parsePrefs(read(() => localStorage, SPOILER_PREFS_KEY))
}

/** Put the prefs on <html>, and tell the page (the games and teams scope). */
export function applyPrefs(p: SpoilerPrefs = storedPrefs()) {
  const { off, hide } = prefsAttributes(p)
  const h = document.documentElement
  if (off) h.dataset.spOff = off
  else delete h.dataset.spOff
  if (hide) h.dataset.spHide = hide
  else delete h.dataset.spHide
  window.dispatchEvent(new CustomEvent(PREFS_EVENT, { detail: p }))
}

export const PREFS_EVENT = 'akv-spoiler-prefs'

/** Keep the prefs on this device and apply them. */
export function savePrefs(p: SpoilerPrefs) {
  write(() => localStorage, SPOILER_PREFS_KEY, JSON.stringify(p))
  applyPrefs(p)
}

// ─── Games and teams scope ───────────────────────────────────────────────────

/** What a spoiler-prone element is about (its data-* attributes). */
export interface SpoilerSubject {
  game: string | null
  /** PandaScore team ids. */
  teams: number[]
  /** The PandaScore match id, for a followed match. */
  match: number | null
  /** Text to look for a followed team's name in (an article's title). */
  text: string
}

export interface FollowedScope {
  teams: Array<{ id: number; label: string; acronym?: string | null }>
  matches: number[]
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const word = (needle: string, flags: string) =>
  new RegExp(`(^|[^\\p{L}\\p{N}])${escape(needle)}($|[^\\p{L}\\p{N}])`, flags)

/** A followed team named in a text: full name, or a 3+ letter acronym in capitals (as the CMS's mentionsTeam). */
export function mentionsTeam(text: string, team: { label: string; acronym?: string | null }): boolean {
  const name = team.label.trim()
  if (name.length >= 3 && word(name, 'iu').test(text)) return true
  const ac = team.acronym?.trim() ?? ''
  return ac.length >= 3 && ac !== name && word(ac, 'u').test(text)
}

/**
 * Whether the prefs leave this element visible: another game than the ones
 * protected, or nothing the reader follows when only their teams are (pure,
 * tested). Unknown game with a games list: protected (the safe side).
 */
export function isFree(s: SpoilerSubject, p: SpoilerPrefs, followed: FollowedScope): boolean {
  if (p.games.length && s.game && !p.games.includes(s.game as EsportGame)) return true
  if (p.teams === 'followed') {
    const mine =
      s.teams.some((id) => followed.teams.some((t) => t.id === id)) ||
      (s.match != null && followed.matches.includes(s.match)) ||
      (!!s.text && followed.teams.some((t) => mentionsTeam(s.text, t)))
    return !mine
  }
  return false
}

/** The data-* attributes SpoilerScope reads on a spoiler-prone element. */
export function spoilerData(s: {
  game?: string | null
  teams?: Array<number | null | undefined>
  match?: number | null
}): Record<string, string> {
  const teams = (s.teams ?? []).filter((x): x is number => typeof x === 'number')
  return {
    ...(s.game ? { 'data-eg': s.game } : {}),
    ...(teams.length ? { 'data-teams': teams.join(' ') } : {}),
    ...(s.match != null ? { 'data-match': String(s.match) } : {}),
  }
}
