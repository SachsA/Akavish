import { highlight } from '@/lib/search-query'

/** `text` with every word of `query` wrapped in <mark> (search results, suggestions). */
export function Highlight({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlight(text, query).map((segment, i) =>
        segment.match ? (
          <mark key={i} className="bg-emerald-500/25 text-inherit rounded-sm px-0.5 -mx-0.5">
            {segment.text}
          </mark>
        ) : (
          segment.text
        )
      )}
    </>
  )
}
