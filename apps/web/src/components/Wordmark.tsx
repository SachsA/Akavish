/**
 * The Akavish wordmark: "Akav" in white, "ish" dimmed.
 *
 * Single source of truth on purpose. This used to be hand-written at each call
 * site, which is how the header, the footer and the card placeholder ended up
 * reading "AKV" while the home hero and the OG image read "Akavish".
 *
 * Pass sizing through `className` (e.g. `text-xl`, `text-5xl`) — weight,
 * tracking and colours belong to the mark and shouldn't be overridden.
 *
 * Note: the share images (`lib/og.tsx`, used by every `opengraph-image.tsx`) deliberately repeat
 * the markup instead of importing this. It renders through `next/og`, which
 * supports neither Tailwind classes nor arbitrary components — keep the two in
 * sync by hand if the mark ever changes.
 */
export function Wordmark({
  className = '',
  primary = 'text-white',
  // zinc-500: 4.1:1 on the zinc-950 background, enough for large bold text
  // (WCAG 3:1). zinc-600 was 2.6:1. The mark is never rendered small.
  muted = 'text-zinc-500',
}: {
  className?: string
  /**
   * Colour of the "Akav" half. Both halves are props rather than inherited:
   * the spans carry their own text colour, so a colour set on the parent would
   * be overridden and silently ignored.
   */
  primary?: string
  /** Colour of the "ish" half. */
  muted?: string
}) {
  return (
    <span className={`font-black tracking-tight ${className}`}>
      <span className={primary}>Akav</span>
      <span className={muted}>ish</span>
    </span>
  )
}
