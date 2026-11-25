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

/** Runs before first paint (layout.tsx): same rule, no imports. */
export const RESTORE_SPOILERS = `try{var v=sessionStorage.getItem('${SPOILER_VISIT_KEY}'),d=localStorage.getItem('${SPOILER_DEFAULT_KEY}'),m=v==='hide'||v==='show'?v:d==='hide'||d==='show'?d:'show';document.documentElement.dataset.spoilers=m}catch(e){}`

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
