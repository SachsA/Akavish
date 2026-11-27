// The "Result hidden" label over a result article's cover, shown only while
// scores are hidden (globals.css, `.akv-spoiler`). The card stays a link:
// opening the article is the reveal.
import { getMessages } from '@/lib/i18n/server'
import { esportGameOfSlug } from '@/lib/esport'
import { spoilerData } from '@/lib/spoilers'

/**
 * Classes for a card that may give a result away: `root` on the card, `blur`
 * on what to blur, `data` its game for the games scope (lib/spoilers.ts).
 */
export const spoilerClasses = (spoiler: boolean | undefined, gameSlug?: string | null) =>
  spoiler
    ? { root: 'akv-spoiler', blur: 'akv-spoiler-blur', data: spoilerData({ game: esportGameOfSlug(gameSlug) }) }
    : { root: '', blur: '', data: {} }

export function SpoilerVeil({ spoiler }: { spoiler: boolean | undefined }) {
  if (!spoiler) return null
  return (
    <span className="akv-spoiler-veil absolute inset-0 z-10 items-center justify-center">
      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/60 bg-zinc-950/85 px-3 py-1 text-xs font-semibold text-white">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
          <path d="M3 3l18 18" />
        </svg>
        {getMessages().spoilers.veil}
      </span>
    </span>
  )
}
