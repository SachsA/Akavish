'use client'

import { useRouter, useSearchParams } from 'next/navigation'

// Header search input. Navigates to /search?q=… on submit.
//
// Uncontrolled on purpose: a controlled input would be reset to its initial
// state by hydration if someone types before the JS has loaded, and their query
// would be lost. With action + name, a submit before hydration (or without JS)
// is a plain GET to /search?q=…; once hydrated, onSubmit uses client routing.
export function SearchBar() {
  const router = useRouter()
  const current = useSearchParams().get('q') ?? ''

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const q = String(new FormData(e.currentTarget).get('q') ?? '').trim()
    if (q) router.push(`/search?q=${encodeURIComponent(q)}`)
  }

  return (
    <form action="/search" method="get" role="search" onSubmit={onSubmit} className="relative">
      <input
        // Re-mount when the URL's query changes, so the box shows the new one.
        key={current}
        type="search"
        name="q"
        defaultValue={current}
        placeholder="Search…"
        aria-label="Search articles"
        className="w-[5.5rem] sm:w-44 bg-zinc-900 border border-zinc-800 rounded-md pl-3 pr-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-400 sm:focus:w-56 transition-all"
      />
    </form>
  )
}
