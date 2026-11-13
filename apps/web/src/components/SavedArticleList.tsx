'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { categoryByValue } from '@/lib/categories'

export interface SavedItem {
  id: string
  slug: string
  title: string
  category: string
  coverImage?: string
  game?: string
  savedAt: string
}

/** The reader's saved articles on /account, each with a Remove button. */
export function SavedArticleList({ items }: { items: SavedItem[] }) {
  const router = useRouter()
  const [removed, setRemoved] = useState<Set<string>>(new Set())
  const [failed, setFailed] = useState<string | null>(null)

  async function remove(id: string) {
    setFailed(null)
    setRemoved((prev) => new Set(prev).add(id))
    const res = await fetch(`/api/bookmarks?article=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(
      () => null
    )
    if (!res?.ok) {
      setRemoved((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      setFailed(id)
      return
    }
    // Refresh the count and the pages behind the list.
    router.refresh()
  }

  const visible = items.filter((item) => !removed.has(item.id))
  if (visible.length === 0) return null

  return (
    <ul className="divide-y divide-zinc-800 border-y border-zinc-800">
      {visible.map((item) => (
        <li key={item.id} className="flex items-center gap-4 py-4">
          <Link
            href={`/article/${item.slug}`}
            tabIndex={-1}
            aria-hidden
            className="relative hidden sm:block shrink-0 w-32 aspect-video rounded-md overflow-hidden bg-zinc-800"
          >
            {item.coverImage && <Image src={item.coverImage} alt="" fill sizes="128px" className="object-cover" />}
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 text-xs mb-1">
              <span className="text-emerald-500 font-bold uppercase tracking-wide">
                {categoryByValue(item.category)?.singular ?? item.category}
              </span>
              {item.game && <span className="text-zinc-400">· {item.game}</span>}
              <span className="text-zinc-400">· Saved {formatDate(item.savedAt)}</span>
            </div>
            <h3 className="font-bold text-white">
              <Link href={`/article/${item.slug}`} className="hover:text-emerald-400 transition-colors">
                {item.title}
              </Link>
            </h3>
            {failed === item.id && (
              <p role="status" className="text-xs text-danger mt-1">
                Couldn’t remove it, try again.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => remove(item.id)}
            className="shrink-0 px-3 py-1.5 rounded-md border border-zinc-800 text-xs text-zinc-300 hover:text-white hover:border-zinc-700 transition-colors"
            aria-label={`Remove “${item.title}” from saved articles`}
          >
            Remove
          </button>
        </li>
      ))}
    </ul>
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
