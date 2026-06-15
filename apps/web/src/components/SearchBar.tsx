'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'

// Header search input. Navigates to /search?q=… on submit.
export function SearchBar() {
  const router = useRouter()
  const params = useSearchParams()
  const [value, setValue] = useState('')

  // Keep the field in sync with the URL (external system) when navigating to
  // /search?q=… — a legitimate effect-driven sync.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue(params.get('q') ?? '')
  }, [params])

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = value.trim()
    if (q) router.push(`/search?q=${encodeURIComponent(q)}`)
  }

  return (
    <form onSubmit={onSubmit} className="relative">
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search…"
        aria-label="Search articles"
        className="w-28 sm:w-44 bg-zinc-900 border border-zinc-800 rounded-md pl-3 pr-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 focus:w-40 sm:focus:w-56 transition-all"
      />
    </form>
  )
}
