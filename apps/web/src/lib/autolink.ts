// ─── Links in article texts (2026-11-27) ─────────────────────────────────────
// An esport article links the teams and competitions it's about (ticked by the
// CMS) where its text first names them: "MOUZ" → /esport/teams/cs2-mouz.
// Only those, once each, never inside an editor's own link. Pure: the
// renderer (components/LexicalContent.tsx) asks for each text node in order.

export interface AutoLink {
  href: string
  names: string[]
  /** Teams: as written ("Spirit", not "spirit"); competitions: any case. */
  caseSensitive: boolean
}

export type Segment = { text: string; href?: string }

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Cut a text into plain and linked pieces: the first mention of each link not
 * `used` yet (whole words; the longest name wins at a spot). Marks the links
 * it places as used.
 */
export function linkify(text: string, links: AutoLink[], used: Set<string>): Segment[] {
  const out: Segment[] = []
  let rest = text
  for (;;) {
    let best: { index: number; length: number; href: string } | null = null
    for (const l of links) {
      if (used.has(l.href)) continue
      for (const name of l.names) {
        if (!name) continue
        const re = new RegExp(`(^|[^\\p{L}\\p{N}])(${escape(name)})(?=$|[^\\p{L}\\p{N}])`, l.caseSensitive ? 'u' : 'iu')
        const m = re.exec(rest)
        if (!m) continue
        const index = m.index + m[1].length
        if (!best || index < best.index || (index === best.index && name.length > best.length))
          best = { index, length: m[2].length, href: l.href }
      }
    }
    if (!best) break
    if (best.index > 0) out.push({ text: rest.slice(0, best.index) })
    out.push({ text: rest.slice(best.index, best.index + best.length), href: best.href })
    used.add(best.href)
    rest = rest.slice(best.index + best.length)
  }
  if (rest) out.push({ text: rest })
  return out
}
