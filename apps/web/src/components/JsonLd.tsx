import { serializeJsonLd } from '@/lib/structured-data'

/** One JSON-LD block. Pass an array to emit several objects in one script. */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />
  )
}
