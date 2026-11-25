'use client'

// The reader's esport follows in the browser: fetched once per page (one call,
// however many Follow buttons the page has: a calendar has hundreds), shared
// by every button, changed optimistically. /api/esport-follows behind it.

import { useSyncExternalStore } from 'react'
import type { EsportFollow, EsportFollowKind } from './readers'

type State = { follows: EsportFollow[] | null; loading: boolean }

let state: State = { follows: null, loading: false }
const listeners = new Set<() => void>()
const emit = (next: Partial<State>) => {
  state = { ...state, ...next }
  listeners.forEach((l) => l())
}

export const followKey = (kind: EsportFollowKind, pandaId: number) => `${kind}:${pandaId}`

/** Fetch the list once (signed-in readers only). */
export function loadEsportFollows(force = false) {
  if ((state.follows && !force) || state.loading) return
  emit({ loading: true })
  fetch('/api/esport-follows')
    .then((r) => (r.ok ? r.json() : Promise.reject(r)))
    .then((d: { follows: EsportFollow[] }) => emit({ follows: d.follows, loading: false }))
    .catch(() => emit({ follows: [], loading: false }))
}

/** Follow or unfollow; the button shows the new state at once and goes back if it fails. */
export async function toggleEsportFollow(follow: EsportFollow, on: boolean): Promise<string | null> {
  const before = state.follows ?? []
  const key = followKey(follow.kind, follow.pandaId)
  emit({
    follows: on ? [follow, ...before.filter((f) => followKey(f.kind, f.pandaId) !== key)] : before.filter((f) => followKey(f.kind, f.pandaId) !== key),
  })
  try {
    const res = await fetch(
      on ? '/api/esport-follows' : `/api/esport-follows?kind=${follow.kind}&id=${follow.pandaId}`,
      on
        ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ follow }) }
        : { method: 'DELETE' }
    )
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { code?: string }
      throw new Error(data.code ?? 'failed')
    }
    return null
  } catch (err) {
    emit({ follows: before })
    return (err as Error).message
  }
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** The follows (null until loaded). */
export function useEsportFollows(): EsportFollow[] | null {
  return useSyncExternalStore(
    subscribe,
    () => state.follows,
    () => null
  )
}
