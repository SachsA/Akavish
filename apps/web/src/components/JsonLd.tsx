import { serializeJsonLd } from '@/lib/structured-data'

/**
 * JSON-LD blocks. An array gives one script per object, each with its own
 * `@context`: a top-level array is valid for Google, but scripts that read
 * `data["@context"]` (browser extensions, Safari) threw on it, and Sentry
 * caught it as our error (AKAVISH-WEB-4, 2026-11-27).
 */
export function JsonLd({ data }: { data: unknown }) {
  const items = Array.isArray(data) ? data : [data]
  return (
    <>
      {items.map((item, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(item) }} />
      ))}
    </>
  )
}
