// ─── Media for drafts: cover image and videos ────────────────────────────────
// Every draft needs a cover, and stories about a trailer or a showcase need the
// video. Rules, in order:
//
// Cover
//   1. An image URL the editor pasted in Discord (Modifier → Image).
//   2. The share image (og:image) of an OFFICIAL source: a publisher's or
//      platform's own press visual, made to be shared.
//   3. A still from an official video the draft links (its YouTube
//      thumbnail): the story's own trailer, unless a recent article about
//      the game already wears it.
//   4. A fresh image of the story's game: never one of the covers of its last
//      10 articles, the one whose description fits the story (game-images.ts;
//      the game's official images found online, IGDB and Steam, are added to
//      its "Other images" once a week, described by Haiku).
//   5. A press source's share image, with the outlet as credit (Alex's call,
//      2026-11-26, knowing outlets' photos can belong to agencies).
//   6. The game's image used least lately, even if used recently.
//   "Autre image" on Discord runs the same order without the current one.
//   Without any of them the draft says so on Discord, and Publish refuses
//   until an image is added.
//
// Videos
//   YouTube videos embedded or linked in the sources' articles, with their
//   title and channel from YouTube's oEmbed (public, no key). The model picks
//   the official ones about the story; the article links them in "Watch".

import type { FetchLike } from './anthropic'
import type { ScoutContext, SettingsDoc } from './context'
import type { DraftSource } from './draft-prompt'
import { USER_AGENT } from './extract'
import {
  altKey,
  findGame,
  freshGameImage,
  recentCovers,
  reusedGameImage,
  stockGameImages,
  type Exclude,
} from './game-images'
import { uploadImage } from './images'

export { COVER_REUSE_DAYS, leastUsed } from './game-images'
export { downloadImage, storeImage, uploadImage } from './images'

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

/**
 * The cover for a draft, in this order (skipping anything in `exclude`, and
 * for a game, the covers of its last 10 articles):
 *   1. an official source's share image;
 *   2. a still from an official video the draft links;
 *   3. a fresh image of the story's game, the one that fits the subject
 *      (game-images.ts; its official images found online are stocked first);
 *   4. a press source's share image, credited to the outlet (Alex,
 *      2026-11-26: "si tu trouves rien, prends les sites de presse");
 *   5. the game's image used least lately, even if used recently;
 * else null. Failures are skipped, never fatal.
 */
export async function pickCover(
  ctx: ScoutContext,
  story: { title: string; game?: string | null },
  sources: DraftSource[],
  videos: Video[] = [],
  opts: { settings?: SettingsDoc; exclude?: Exclude } = {},
): Promise<Cover | null> {
  const game = await findGame(ctx, story.game).catch(() => null)
  const recent = game
    ? await recentCovers(ctx, game.id)
    : { ids: new Set<number>(), alts: new Set<string>() }
  const exclude: Exclude = {
    ids: new Set([...recent.ids, ...(opts.exclude?.ids ?? [])]),
    alts: new Set([...recent.alts, ...(opts.exclude?.alts ?? [])]),
  }
  const shareImage = async (s: DraftSource, alt: string, origin: string, credit?: string) => {
    if (!s.image || exclude.alts.has(altKey(alt))) return null
    try {
      const up = await uploadImage(ctx, s.image, alt, credit)
      return { ...up, origin }
    } catch (err) {
      ctx.payload.logger.info({
        msg: '[scout] source image skipped',
        source: s.name,
        error: err instanceof Error ? err.message : String(err),
      })
      return null
    }
  }

  for (const s of sources) {
    if (s.reliability !== 'official') continue
    // Alt text: the publisher's own description when the page has one.
    const alt = s.imageAlt?.trim() || `Official image from ${s.name}: ${story.title}`
    const got = await shareImage(s, alt, `visuel officiel, ${s.name}`)
    if (got) return got
  }
  for (const v of videos.slice(0, 2)) {
    const alt = `Still from the official video: ${v.title}`
    // The same trailer embedded by every outlet: not the same still again.
    if (exclude.alts.has(altKey(alt))) continue
    try {
      const up = await uploadImage(ctx, `https://i.ytimg.com/vi/${v.id}/maxresdefault.jpg`, alt)
      return { ...up, origin: `image de la vidéo officielle, ${v.channel || 'YouTube'}` }
    } catch (err) {
      ctx.payload.logger.info({
        msg: '[scout] video still skipped',
        video: v.id,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
  if (game) {
    if (await stockGameImages(ctx, opts.settings, game)) {
      // New images: read the game again to have them, described.
      const again = await findGame(ctx, game.name).catch(() => null)
      if (again) Object.assign(game, again)
    }
    const fresh = await freshGameImage(ctx, opts.settings, game, story.title, exclude)
    if (fresh)
      return { id: fresh.id, url: fresh.url, origin: `fiche du jeu ${game.name} (${fresh.alt})` }
  }
  for (const s of sources) {
    if (s.reliability === 'official') continue
    const alt = s.imageAlt?.trim() || `Image from ${s.name}: ${story.title}`
    const got = await shareImage(s, alt, `image de presse, ${s.name} (crédit affiché)`, s.name)
    if (got) return got
  }
  if (game) {
    const again = await reusedGameImage(ctx, game, opts.exclude?.ids ?? new Set())
    if (again)
      return {
        id: again.id,
        url: again.url,
        origin: `fiche du jeu ${game.name}, déjà utilisée récemment`,
      }
  }
  return null
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
