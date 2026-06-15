'use client'

import Link from 'next/link'

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="max-w-xl mx-auto px-4 py-24 text-center space-y-6">
      <p className="text-7xl font-black tracking-tight text-zinc-800">Oops</p>
      <h1 className="text-2xl font-bold text-white">Something went wrong</h1>
      <p className="text-zinc-400">
        An unexpected error occurred. Try again, or head back home.
      </p>
      <div className="flex justify-center gap-3 pt-2">
        <button
          onClick={reset}
          className="px-4 py-2 rounded-md bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition-colors"
        >
          Try again
        </button>
        <Link
          href="/"
          className="px-4 py-2 rounded-md border border-zinc-800 text-zinc-300 text-sm font-semibold hover:border-zinc-700 transition-colors"
        >
          Back home
        </Link>
      </div>
    </div>
  )
}
