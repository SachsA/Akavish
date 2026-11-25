'use client'

// The bell in the header (signed-in readers): what their followed teams,
// tournaments and matches did (lib/esport-follows.ts in the CMS makes the
// notifications). The unread count is asked on load and every 2 minutes while
// the tab is visible; opening the list marks it all read. A result's score
// follows the anti-spoil switch (`.akv-score` / `.akv-mask`, globals.css).

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from './LocaleLink'
import { useI18n } from './I18nProvider'
import { BellIcon } from './esport/EsportFollowButton'
import type { ReaderNotification } from '@/lib/readers'

const POLL_MS = 2 * 60 * 1000

type Team = { name?: string; acronym?: string | null }
const teamName = (x: unknown) => ((x as Team)?.name ?? '?') as string

function ago(iso: string, locale: string): string {
  const s = (new Date(iso).getTime() - Date.now()) / 1000
  const rtf = new Intl.RelativeTimeFormat(locale === 'fr' ? 'fr' : 'en', { numeric: 'auto' })
  const abs = Math.abs(s)
  if (abs < 60) return rtf.format(Math.round(s), 'second')
  if (abs < 3600) return rtf.format(Math.round(s / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(s / 3600), 'hour')
  return rtf.format(Math.round(s / 86400), 'day')
}

function Item({ n, onOpen }: { n: ReaderNotification; onOpen: () => void }) {
  const { t, locale } = useI18n()
  const d = n.data
  const where = [d.event, d.stage].filter(Boolean).join(' · ')
  let title: React.ReactNode
  let sub: React.ReactNode = where
  if (n.kind === 'match_start') title = t.bell.started(teamName(d.t1), teamName(d.t2))
  else if (n.kind === 'match_end') {
    title = t.bell.ended(teamName(d.t1), teamName(d.t2))
    const score = d.s1 != null && d.s2 != null ? `${teamName(d.t1)} ${d.s1} – ${d.s2} ${teamName(d.t2)}` : null
    sub = (
      <>
        {score && (
          <span className="akv-match block">
            <span className="akv-score font-semibold text-zinc-200">{score}</span>
            <span className="akv-mask italic">{t.bell.scoreHidden}</span>
          </span>
        )}
        {where}
      </>
    )
  } else {
    title = t.bell.article((Array.isArray(d.teams) ? d.teams : []).join(', '))
    sub = String(d.title ?? '')
  }
  return (
    <Link
      // Older ones point at the tournament page only: open the match there.
      href={
        n.url.startsWith('/esport/tournaments/') && !n.url.includes('#') && d.matchId
          ? `${n.url}#match-${d.matchId}`
          : n.url
      }
      onClick={onOpen}
      className={`block px-4 py-3 hover:bg-zinc-800/60 ${n.readAt ? '' : 'bg-emerald-500/5'}`}
    >
      <span className="flex items-start gap-2">
        {!n.readAt && <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-white">{title}</span>
          <span className="mt-0.5 block text-xs text-zinc-400">{sub}</span>
          <span className="mt-1 block text-[11px] text-zinc-500" suppressHydrationWarning>
            {ago(n.createdAt, locale)}
          </span>
        </span>
      </span>
    </Link>
  )
}

export function NotificationBell() {
  const { t, locale } = useI18n()
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<ReaderNotification[] | null>(null)
  const box = useRef<HTMLDivElement>(null)

  const count = useCallback(() => {
    fetch('/api/notifications?limit=0')
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d: { unread: number }) => setUnread(d.unread))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    count()
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') count()
    }, POLL_MS)
    return () => window.clearInterval(id)
  }, [count])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  async function toggle() {
    const next = !open
    setOpen(next)
    if (!next) return
    try {
      const r = await fetch(`/api/notifications?limit=20&locale=${locale}`)
      const d = (await r.json()) as { docs: ReaderNotification[]; unread: number }
      setItems(d.docs)
      // Seen: the list keeps its "new" marks until it closes, the count goes.
      if (d.unread > 0) {
        await fetch('/api/notifications', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ read: 'all' }),
        })
        setUnread(0)
      }
    } catch {
      setItems([])
    }
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={t.bell.label(unread)}
        title={t.bell.title}
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-900 hover:text-white"
      >
        <BellIcon className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-emerald-500 px-1 text-[10px] font-bold leading-4 text-[#ffffff]">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 shadow-xl">
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5">
            <span className="text-sm font-bold text-white">{t.bell.title}</span>
            <Link href="/account#esport" className="text-xs font-semibold text-emerald-400 hover:text-emerald-300">
              {t.bell.seeFollows}
            </Link>
          </div>
          <div className="max-h-[26rem] divide-y divide-zinc-800 overflow-y-auto">
            {items === null ? (
              <p className="px-4 py-6 text-sm text-zinc-400">…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-6 text-sm text-zinc-400">{t.bell.empty}</p>
            ) : (
              items.map((n) => <Item key={n.id} n={n} onOpen={() => setOpen(false)} />)
            )}
          </div>
        </div>
      )}
    </div>
  )
}
