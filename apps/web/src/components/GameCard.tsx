// A game in the library grid: cover, name, and one line under it (its
// release on the filtered console, or its first one). Server-safe: the
// library renders it in the browser, the page's static list on the server.

import Image from 'next/image'
import type { ReactNode } from 'react'
import Link from './LocaleLink'

export function GameCard({ slug, name, cover, line }: { slug: string; name: string; cover?: string; line?: ReactNode }) {
  return (
    <Link
      href={`/game/${slug}`}
      className="group block h-full rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden hover:border-zinc-700 transition-colors"
    >
      <span className="relative block aspect-video bg-zinc-800">
        {cover && (
          <Image
            src={cover}
            // Decorative: the name is right under it, in the same link.
            alt=""
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            className="object-cover"
          />
        )}
      </span>
      <span className="block px-3 py-2">
        <span className="block text-sm font-semibold text-zinc-100 group-hover:text-emerald-400 transition-colors line-clamp-2">
          {name}
        </span>
        {line && <span className="block text-xs text-zinc-400 mt-0.5">{line}</span>}
      </span>
    </Link>
  )
}
