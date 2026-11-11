// ─── Media for drafts: cover image and videos ────────────────────────────────
// Every draft needs a cover, and stories about a trailer or a showcase need the
// video. Rules, in order:
//
// Cover
//   1. An image URL the editor pasted in Discord (Modifier → Image).
//   2. The share image (og:image) of an OFFICIAL source: a publisher's or
//      platform's own press visual, made to be shared.
//   3. The cover of the story's game in the CMS (Games collection).
//   Never an image from a press outlet's page: their photos and thumbnails are
//   theirs, not ours to reuse. Without any of the above the draft says so on
//   Discord, and Publish refuses until an image is added.
//
// Videos
//   YouTube videos embedded or linked in the sources' articles, with their
//   title and channel from YouTube's oEmbed (public, no key). The model picks
//   the official ones about the story; the article links them in "Watch".

import type { FetchLike } from './anthropic'
import type { ScoutContext } from './context'
import type { DraftSource } from './draft-prompt'
import { USER_AGENT } from './extract'

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export interface Cover {
  id: number
  url?: string | null
  /** Where it came from, for the Discord card. */
  origin: string
}

export interface Video {
  id: string
  title: string
  channel: string
  url: string
}

/** Download an image (https, ≤ 8 MB, jpeg/png/webp/gif) and store it in Media. */
export async function uploadImage(
  ctx: ScoutContext,
  url: string,
  alt: string,
): Promise<{ id: number; url?: string | null }> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('image: not a URL')
  }
  if (parsed.protocol !== 'https:') throw new Error('image: https only')
  const res = await ctx.fetch(parsed.toString(), {
    headers: { 'user-agent': USER_AGENT, accept: 'image/*' },
    redirect: 'follow',
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`image: HTTP ${res.status}`)
  const type = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
  const ext = IMAGE_TYPES[type]
  if (!ext) throw new Error(`image: unsupported type ${type || 'unknown'}`)
  const declared = Number(res.headers.get('content-length') ?? 0)
  if (declared > MAX_IMAGE_BYTES) throw new Error('image: larger than 8 MB')
  const data = Buffer.from(await res.arrayBuffer())
  if (data.length > MAX_IMAGE_BYTES) throw new Error('image: larger than 8 MB')
  if (data.length < 1000) throw new Error('image: too small to be a cover')

  const base =
    parsed.pathname
      .split('/')
      .pop()
      ?.replace(/\.[a-z0-9]+$/i, '')
      .replace(/[^a-z0-9-]+/gi, '-')
      .slice(0, 60) || 'scout-cover'
  const doc = (await ctx.payload.create({
    collection: 'media',
    data: { alt: alt.slice(0, 200) } as never,
    file: { data, mimetype: type, name: `${base}.${ext}`, size: data.length },
    overrideAccess: true,
  })) as unknown as { id: number; url?: string | null }
  return { id: Number(doc.id), url: doc.url }
}

/** The cover of the story's game in the CMS, matched by name. */
async function gameCover(ctx: ScoutContext, game?: string | null): Promise<Cover | null> {
  if (!game?.trim()) return null
  const { docs } = await ctx.payload.find({
    collection: 'games',
    where: { name: { like: game.trim() } },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  })
  const cover = (docs[0] as unknown as { cover?: { id: number; url?: string } | number | null })
    ?.cover
  if (!cover) return null
  return typeof cover === 'object'
    ? { id: Number(cover.id), url: cover.url, origin: `fiche du jeu ${game}` }
    : { id: Number(cover), origin: `fiche du jeu ${game}` }
}

/**
 * The cover for a new draft: an official source's share image, else the
 * game's cover, else null. Failures are skipped, never fatal.
 */
export async function pickCover(
  ctx: ScoutContext,
  story: { title: string; game?: string | null },
  sources: DraftSource[],
): Promise<Cover | null> {
  for (const s of sources) {
    if (s.reliability !== 'official' || !s.image) continue
    try {
      const up = await uploadImage(ctx, s.image, `${story.title} (official image, ${s.name})`)
      return { ...up, origin: `visuel officiel, ${s.name}` }
    } catch (err) {
      ctx.payload.logger.info({
        msg: '[scout] official image skipped',
        source: s.name,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
  return gameCover(ctx, story.game)
}

/** Title and channel of the YouTube videos found in the sources (oEmbed). */
export async function videoCandidates(
  sources: DraftSource[],
  fetchImpl: FetchLike,
  max = 6,
): Promise<Video[]> {
  const ids: string[] = []
  for (const s of sources) for (const id of s.videos ?? []) if (!ids.includes(id)) ids.push(id)
  const out: Video[] = []
  for (const id of ids.slice(0, max)) {
    const url = `https://www.youtube.com/watch?v=${id}`
    try {
      const res = await fetchImpl(
        `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
        { headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(8_000) },
      )
      if (!res.ok) continue
      const o = (await res.json()) as { title?: string; author_name?: string }
      if (o.title) out.push({ id, title: o.title, channel: o.author_name ?? '', url })
    } catch {
      // private, deleted or unreachable: left out
    }
  }
  return out
}
