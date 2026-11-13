'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'
import type { GameHit, SearchHit, SearchResponse } from '@/lib/search'
import { categoryByValue } from '@/lib/categories'
import { searchHref, SUGGEST_MIN_CHARS } from '@/lib/search-query'
import { Highlight } from './Highlight'

const DEBOUNCE_MS = 200
const SUGGESTED_ARTICLES = 5

type Option =
  | { kind: 'game'; href: string; game: GameHit }
  | { kind: 'article'; href: string; hit: SearchHit }
  | { kind: 'all'; href: string }

// Header search box, with suggestions as you type (games, then articles, then
// "See all results"). Enter without a highlighted suggestion goes to /search.
//
// The input stays uncontrolled on purpose: a controlled input would be reset to
// its initial state by hydration if someone types before the JS has loaded, and
// their query would be lost. With action + name, a submit before hydration (or
// without JS) is a plain GET to /search?q=…; once hydrated, onSubmit uses client
// routing. What's typed is mirrored into `text` from onInput for the suggestions.
//
// ARIA: the combobox pattern (input + listbox, aria-activedescendant), so arrow
// keys move through the suggestions while focus stays in the box.
export function SearchBar() {
  const router = useRouter()
  const pathname = usePathname()
  const current = useSearchParams().get('q') ?? ''
  const listId = useId()

  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [result, setResult] = useState<{ q: string; hits: SearchHit[]; games: GameHit[] } | null>(
    null
  )
  const formRef = useRef<HTMLFormElement>(null)

  const q = text.trim()
  const ready = q.length >= SUGGEST_MIN_CHARS

  // Fetch suggestions, debounced, dropping answers to an older query.
  useEffect(() => {
    if (!ready) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}&limit=${SUGGESTED_ARTICLES}&games=1`, {
        signal: controller.signal,
      })
        .then((r) => (r.ok ? r.json() : Promise.reject(r)))
        .then((data: SearchResponse) => {
          setResult({ q, hits: data.hits, games: data.games ?? [] })
          // The list just changed under the highlight: start over from the box.
          setActive(-1)
        })
        .catch(() => {
          // Aborted, rate limited or offline: keep whatever was shown; Enter still works.
        })
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [q, ready])

  // Close on navigation (a suggestion was followed, or the form submitted).
  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- closing the
       dropdown when the route changes is the intent here. */
    setOpen(false)
  }, [pathname, current])

  const fresh = result && result.q === q ? result : null
  const options: Option[] = !ready
    ? []
    : [
        ...(fresh?.games ?? []).map((game) => ({
          kind: 'game' as const,
          href: `/game/${game.slug}`,
          game,
        })),
        ...(fresh?.hits ?? []).map((hit) => ({
          kind: 'article' as const,
          href: `/article/${hit.slug}`,
          hit,
        })),
        { kind: 'all' as const, href: searchHref({ q }) },
      ]
  const expanded = open && ready
  const optionId = (i: number) => `${listId}-${i}`

  function go(href: string) {
    setOpen(false)
    router.push(href)
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (expanded && active >= 0 && options[active]) return go(options[active].href)
    const value = String(new FormData(e.currentTarget).get('q') ?? '').trim()
    if (value) go(searchHref({ q: value }))
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      if (expanded) e.preventDefault()
      setOpen(false)
      setActive(-1)
      return
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    if (!ready) return
    e.preventDefault()
    setOpen(true)
    setActive((i) => {
      const n = options.length
      if (e.key === 'ArrowDown') return i + 1 >= n ? 0 : i + 1
      return i <= 0 ? n - 1 : i - 1
    })
  }

  return (
    <form
      ref={formRef}
      action="/search"
      method="get"
      role="search"
      onSubmit={onSubmit}
      onBlur={(e) => {
        if (!formRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false)
      }}
      className="relative"
    >
      <input
        // Re-mount when the URL's query changes, so the box shows the new one.
        key={current}
        type="search"
        name="q"
        defaultValue={current}
        placeholder="Search…"
        aria-label="Search articles"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={expanded && active >= 0 ? optionId(active) : undefined}
        autoComplete="off"
        enterKeyHint="search"
        onInput={(e) => {
          setText(e.currentTarget.value)
          setActive(-1)
          setOpen(true)
        }}
        onFocus={(e) => {
          setText(e.currentTarget.value)
          setOpen(true)
        }}
        onKeyDown={onKeyDown}
        className="w-[5.5rem] sm:w-44 bg-zinc-900 border border-zinc-800 rounded-md pl-3 pr-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-400 sm:focus:w-56 transition-all"
      />
      <div
        hidden={!expanded}
        className="fixed inset-x-4 top-14 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[26rem] z-50 rounded-lg border border-zinc-800 bg-zinc-950 shadow-xl shadow-black/40 overflow-hidden"
      >
        <ul id={listId} role="listbox" aria-label="Suggestions" className="max-h-[70vh] overflow-y-auto py-1">
          {options.map((option, i) => (
            // The link itself is the option (an option's children are presentational,
            // so a link inside one would be an interactive element nobody can reach).
            <li key={option.href} role="none">
              <Link
                href={option.href}
                id={optionId(i)}
                role="option"
                aria-selected={i === active}
                tabIndex={-1}
                // Keep focus in the box until the click lands.
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 text-sm ${
                  i === active ? 'bg-zinc-900' : ''
                } ${option.kind === 'all' ? 'border-t border-zinc-800 text-emerald-400 font-semibold' : ''}`}
              >
                {option.kind === 'game' && <GameRow game={option.game} q={q} />}
                {option.kind === 'article' && <ArticleRow hit={option.hit} q={q} />}
                {option.kind === 'all' && <span>See all results for “{q}”</span>}
              </Link>
            </li>
          ))}
        </ul>
        {fresh && fresh.hits.length === 0 && fresh.games.length === 0 && (
          <p className="px-3 pb-2 -mt-1 text-xs text-zinc-400">No quick match, try the full search.</p>
        )}
      </div>
    </form>
  )
}

function Thumb({ src }: { src?: string }) {
  return (
    <span className="relative shrink-0 w-14 aspect-video rounded overflow-hidden bg-zinc-800">
      {src && <Image src={src} alt="" fill sizes="56px" className="object-cover" />}
    </span>
  )
}

function GameRow({ game, q }: { game: GameHit; q: string }) {
  return (
    <>
      <Thumb src={game.cover} />
      <span className="min-w-0">
        <span className="block text-[11px] uppercase tracking-wide font-bold text-zinc-400">Game</span>
        <span className="block truncate text-zinc-100">
          <Highlight text={game.name} query={q} />
        </span>
      </span>
    </>
  )
}

function ArticleRow({ hit, q }: { hit: SearchHit; q: string }) {
  return (
    <>
      <Thumb src={hit.coverImage} />
      <span className="min-w-0">
        <span className="block text-[11px] uppercase tracking-wide font-bold text-emerald-500">
          {categoryByValue(hit.category)?.singular ?? hit.category}
        </span>
        <span className="block truncate text-zinc-100">
          <Highlight text={hit.title} query={q} />
        </span>
      </span>
    </>
  )
}
