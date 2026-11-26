// ─── Game image library: official images found online, picked by subject ─────
// A game in the news every day (GTA VI: 5 to 8 stories a day) wore out its
// handful of images: the same Lucia and Jason on every other article, and the
// editor looking for new ones by hand (2026-11-26). So:
//
// Stock: when a draft is about a game, at most once a week, the scout looks
// for its official images online: IGDB's artworks and screenshots (Twitch's
// game database, `IGDB_CLIENT_ID` / `IGDB_CLIENT_SECRET`), then the Steam
// store page's screenshots (no key). Up to 12 new ones a week are downloaded,
// described by Haiku from the picture itself ("Lucia on a speedboat off Vice
// City beach"), and added to the game's "Other images"; the URLs tried go in
// `imageSources`, so the next week brings the next ones.
//
// Pick: among the game's cover and other images, never one of the covers of
// the last 10 articles about the game (drafts included), and among the rest
// the one whose description fits the story best (Haiku, from the
// descriptions; without it, the least used lately).

import { callTool } from './anthropic'
import { checkBudget, recordUsage } from './budget'
import type { ScoutContext, SettingsDoc } from './context'
import { USER_AGENT } from './extract'
import { downloadImage, storeImage, type Downloaded } from './images'

/** How often a game's online images are looked at again. */
export const IMAGE_CHECK_DAYS = 7
/** New images added per look (one Haiku call describes them all). */
export const MAX_NEW_PER_CHECK = 12
/** A game's "Other images" stop growing there. */
export const MAX_GALLERY = 80
/** The covers of this many latest articles about the game are never reused. */
export const RECENT_COVERS = 10
/** How far back "used lately" looks when every image was used recently. */
export const COVER_REUSE_DAYS = 14

const DAY = 86_400_000
/** Anthropic's limit for an image sent inline. */
const MAX_DESCRIBE_BYTES = 5 * 1024 * 1024

export interface PoolImage {
  id: number
  url?: string | null
  alt: string
}

export interface GameDoc {
  id: number
  name: string
  cover?: unknown
  gallery?: unknown[] | null
  imageSources?: unknown
  imagesCheckedAt?: string | null
}

/** Covers and descriptions not to use (recent articles, the current cover). */
export interface Exclude {
  ids: Set<number>
  alts: Set<string>
}

export const altKey = (alt: string | null | undefined) =>
  (alt ?? '').trim().toLowerCase().replace(/\s+/g, ' ')

// ─── Pure helpers (tested) ───────────────────────────────────────────────────

/** A title compared loosely: accents, case, ™ and punctuation don't count. */
export function normTitle(s: string): string {
  return s
    .replace(/[™®©]/g, '') // before NFKD, which spells ™ "TM"
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

type IgdbGame = {
  name: string
  alternative_names?: Array<{ name?: string }>
  artworks?: Array<{ image_id?: string }>
  screenshots?: Array<{ image_id?: string }>
}

/** The IGDB entry for exactly this game (by name or alternative name), else null. */
export function igdbMatch(results: IgdbGame[], name: string): IgdbGame | null {
  const want = normTitle(name)
  return (
    results.find((g) => normTitle(g.name) === want) ??
    results.find((g) =>
      (g.alternative_names ?? []).some((a) => a.name && normTitle(a.name) === want),
    ) ??
    null
  )
}

/** IGDB image URLs of a game, artworks first (made to be shown), then screenshots. */
export function igdbImageUrls(g: IgdbGame): string[] {
  return [...(g.artworks ?? []), ...(g.screenshots ?? [])]
    .map((x) => x.image_id)
    .filter((id): id is string => typeof id === 'string' && /^[a-z0-9]+$/i.test(id))
    .map((id) => `https://images.igdb.com/igdb/image/upload/t_1080p/${id}.jpg`)
}

/** The Steam app for exactly this game, else null. */
export function steamMatch(
  items: Array<{ id: number; name: string }>,
  name: string,
): number | null {
  const want = normTitle(name)
  return items.find((i) => normTitle(i.name) === want)?.id ?? null
}

/** Among a game's images, the one used least lately. Ties keep the earlier one. */
export function leastUsed<T extends { id: number }>(
  images: T[],
  uses: Map<number, number>,
): T | null {
  let best: T | null = null
  for (const img of images) {
    if (!best || (uses.get(img.id) ?? 0) < (uses.get(best.id) ?? 0)) best = img
  }
  return best
}

// ─── Online sources ──────────────────────────────────────────────────────────

let igdbToken: { token: string; until: number; clientId: string } | null = null

/** For tests: forget the IGDB token. */
export function resetIgdbToken() {
  igdbToken = null
}

async function igdbAuth(ctx: ScoutContext): Promise<{ token: string; clientId: string } | null> {
  const cfg = ctx.config.igdb
  if (!cfg) return null
  if (igdbToken && igdbToken.clientId === cfg.clientId && igdbToken.until > Date.now())
    return igdbToken
  const qs = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    grant_type: 'client_credentials',
  })
  const res = await ctx.fetch(`https://id.twitch.tv/oauth2/token?${qs.toString()}`, {
    method: 'POST',
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`IGDB auth: HTTP ${res.status}`)
  const j = (await res.json()) as { access_token?: string; expires_in?: number }
  if (!j.access_token) throw new Error('IGDB auth: no token')
  igdbToken = {
    token: j.access_token,
    clientId: cfg.clientId,
    until: Date.now() + Math.max(60, (j.expires_in ?? 3600) - 300) * 1000,
  }
  return igdbToken
}

/** The game's official images on IGDB (none without the Twitch app's keys). */
export async function igdbImages(ctx: ScoutContext, name: string): Promise<string[]> {
  const auth = await igdbAuth(ctx)
  if (!auth) return []
  const res = await ctx.fetch('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: {
      'client-id': auth.clientId,
      authorization: `Bearer ${auth.token}`,
      accept: 'application/json',
      'content-type': 'text/plain',
    },
    body: `search "${name.replace(/["\\]/g, ' ')}"; fields name,alternative_names.name,artworks.image_id,screenshots.image_id; limit 10;`,
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`IGDB: HTTP ${res.status}`)
  const game = igdbMatch((await res.json()) as IgdbGame[], name)
  return game ? igdbImageUrls(game) : []
}

/** The screenshots of the game's Steam store page (none if it isn't on Steam). */
export async function steamImages(ctx: ScoutContext, name: string): Promise<string[]> {
  const headers = { 'user-agent': USER_AGENT, accept: 'application/json' }
  const search = await ctx.fetch(
    `https://store.steampowered.com/api/storesearch/?${new URLSearchParams({ term: name, l: 'english', cc: 'US' }).toString()}`,
    { headers, signal: AbortSignal.timeout(10_000) },
  )
  if (!search.ok) throw new Error(`Steam search: HTTP ${search.status}`)
  const items =
    ((await search.json()) as { items?: Array<{ id: number; name: string }> }).items ?? []
  const app = steamMatch(items, name)
  if (!app) return []
  const res = await ctx.fetch(
    `https://store.steampowered.com/api/appdetails?appids=${app}&filters=screenshots`,
    { headers, signal: AbortSignal.timeout(10_000) },
  )
  if (!res.ok) throw new Error(`Steam: HTTP ${res.status}`)
  const j = (await res.json()) as Record<
    string,
    { success?: boolean; data?: { screenshots?: Array<{ path_full?: string }> } }
  >
  return (j[String(app)]?.data?.screenshots ?? [])
    .map((x) => x.path_full)
    .filter((u): u is string => typeof u === 'string' && u.startsWith('https://'))
}

// ─── Descriptions (Haiku, from the pictures) ─────────────────────────────────

const DESCRIBE_TOOL = {
  name: 'describe_images',
  description: 'Describe each image for the image library of a video game news site.',
  input_schema: {
    type: 'object',
    properties: {
      images: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            index: { type: 'integer', description: 'The image number, from 1.' },
            alt: {
              type: 'string',
              description:
                'What the picture shows, in one plain English phrase of at most 110 characters: who (character names when obvious from the game), where, doing what, mood. No "image of", no game title.',
            },
            usable: {
              type: 'boolean',
              description:
                'false when it would make a poor article cover: mostly a logo, text, a menu or interface, a blank or blurry frame.',
            },
          },
          required: ['index', 'alt', 'usable'],
        },
      },
    },
    required: ['images'],
  },
}

type Described = { alt: string; usable: boolean }

async function describe(
  ctx: ScoutContext,
  settings: SettingsDoc | undefined,
  game: string,
  imgs: Downloaded[],
): Promise<Array<Described | null>> {
  const none = imgs.map(() => null)
  if (!settings || !ctx.config.anthropicKey) return none
  const budget = await checkBudget(ctx, settings)
  if (!budget.ok) return none
  const content: Array<Record<string, unknown>> = [
    {
      type: 'text',
      text: `Official images of the video game "${game}", numbered from 1. Describe each one.`,
    },
  ]
  const sent: number[] = []
  imgs.forEach((img, i) => {
    if (img.data.length > MAX_DESCRIBE_BYTES) return
    sent.push(i)
    content.push({ type: 'text', text: `Image ${i + 1}:` })
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: img.type, data: img.data.toString('base64') },
    })
  })
  if (!sent.length) return none
  const result = await callTool<{
    images?: Array<{ index?: number; alt?: string; usable?: boolean }>
  }>({
    apiKey: ctx.config.anthropicKey,
    model: ctx.config.triageModel,
    system:
      'You catalogue official video game images (key art, screenshots) so an editor can pick the one that fits a news story. Be concrete and factual.',
    prompt: content,
    tool: DESCRIBE_TOOL,
    maxTokens: 2000,
    timeoutMs: 120_000,
    fetchImpl: ctx.fetch,
  })
  await recordUsage(ctx, {
    purpose: 'images',
    model: result.model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  })
  const out: Array<Described | null> = [...none]
  for (const d of result.input.images ?? []) {
    const i = Number(d.index) - 1
    if (!sent.includes(i) || typeof d.alt !== 'string' || !d.alt.trim()) continue
    out[i] = { alt: d.alt.trim().replace(/\.$/, '').slice(0, 140), usable: d.usable !== false }
  }
  return out
}

// ─── Stock ───────────────────────────────────────────────────────────────────

const idOfMedia = (m: unknown): number | null =>
  m == null ? null : typeof m === 'object' ? Number((m as { id: unknown }).id) : Number(m)

/**
 * Add the game's next official images found online to its "Other images",
 * at most once every IMAGE_CHECK_DAYS. Returns how many were added; never
 * throws (a draft must not fail over its pictures).
 */
export async function stockGameImages(
  ctx: ScoutContext,
  settings: SettingsDoc | undefined,
  game: GameDoc,
): Promise<number> {
  if (ctx.config.dryRun) return 0
  const checked = game.imagesCheckedAt ? Date.parse(game.imagesCheckedAt) : 0
  if (checked && ctx.now.getTime() - checked < IMAGE_CHECK_DAYS * DAY) return 0
  const gallery = (game.gallery ?? []).map(idOfMedia).filter((n): n is number => n !== null)
  const known = new Set(Array.isArray(game.imageSources) ? (game.imageSources as string[]) : [])
  const save = (data: Record<string, unknown>) =>
    ctx.payload.update({
      collection: 'games',
      id: game.id,
      // Without IGDB's keys only Steam is asked, and asked again next time:
      // the keys set later still bring the game's images at once.
      data: {
        ...(ctx.config.igdb ? { imagesCheckedAt: ctx.now.toISOString() } : {}),
        ...data,
      } as never,
      overrideAccess: true,
    })
  try {
    const room = Math.min(MAX_NEW_PER_CHECK, MAX_GALLERY - gallery.length)
    const found: string[] = []
    for (const source of [igdbImages, steamImages]) {
      try {
        found.push(...(await source(ctx, game.name)))
      } catch (err) {
        ctx.payload.logger.info({
          msg: '[scout] game images: a source failed',
          game: game.name,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
    const fresh = [...new Set(found)].filter((u) => !known.has(u)).slice(0, Math.max(0, room))
    if (!fresh.length) {
      await save({})
      return 0
    }
    const downloaded: Array<{ url: string; img: Downloaded }> = []
    for (const url of fresh) {
      try {
        downloaded.push({ url, img: await downloadImage(ctx, url) })
      } catch {
        // gone or not an image: noted as tried below
      }
    }
    let described: Array<Described | null> = downloaded.map(() => null)
    try {
      described = await describe(
        ctx,
        settings,
        game.name,
        downloaded.map((d) => d.img),
      )
    } catch (err) {
      ctx.payload.logger.info({
        msg: '[scout] game images: no descriptions',
        game: game.name,
        error: err instanceof Error ? err.message : String(err),
      })
    }
    const added: number[] = []
    for (const [i, { img }] of downloaded.entries()) {
      const d = described[i]
      if (d && !d.usable) continue
      const alt = d ? `${d.alt}, ${game.name}` : `${game.name}: official image`
      try {
        added.push((await storeImage(ctx, img, alt)).id)
      } catch {
        // storage refused it: skipped
      }
    }
    await save({
      gallery: [...gallery, ...added],
      imageSources: [...known, ...fresh],
    })
    ctx.payload.logger.info({
      msg: '[scout] game images stocked',
      game: game.name,
      added: added.length,
    })
    return added.length
  } catch (err) {
    ctx.payload.logger.warn({
      msg: '[scout] game images: stocking failed',
      game: game.name,
      error: err instanceof Error ? err.message : String(err),
    })
    await save({}).catch(() => undefined)
    return 0
  }
}

// ─── Pick ────────────────────────────────────────────────────────────────────

const PICK_TOOL = {
  name: 'pick_image',
  description: 'Pick the image that best illustrates the news story.',
  input_schema: {
    type: 'object',
    properties: {
      id: { type: 'integer', description: 'The id of the chosen image.' },
    },
    required: ['id'],
  },
}

/** The image whose description fits the story best (Haiku), else null. */
async function pickBySubject(
  ctx: ScoutContext,
  settings: SettingsDoc | undefined,
  title: string,
  images: PoolImage[],
): Promise<PoolImage | null> {
  if (!settings || !ctx.config.anthropicKey || ctx.config.dryRun) return null
  try {
    const budget = await checkBudget(ctx, settings)
    if (!budget.ok) return null
    const result = await callTool<{ id?: number }>({
      apiKey: ctx.config.anthropicKey,
      model: ctx.config.triageModel,
      system:
        'You choose the cover image of a video game news article from a list of image descriptions. Prefer the image showing what the story is about (a character, a place, a vehicle, weather, an activity); when nothing matches, pick a striking, general one.',
      prompt: `Story: ${title}\n\nImages:\n${images.map((i) => `${i.id}: ${i.alt}`).join('\n')}`,
      tool: PICK_TOOL,
      maxTokens: 100,
      fetchImpl: ctx.fetch,
    })
    await recordUsage(ctx, {
      purpose: 'images',
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    })
    return images.find((i) => i.id === Number(result.input.id)) ?? null
  } catch (err) {
    ctx.payload.logger.info({
      msg: '[scout] image pick by subject failed',
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

/** The game (matched by name), with its images described. */
export async function findGame(ctx: ScoutContext, name?: string | null): Promise<GameDoc | null> {
  if (!name?.trim()) return null
  const { docs } = await ctx.payload.find({
    collection: 'games',
    where: { name: { like: name.trim() } },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  })
  return (docs[0] as unknown as GameDoc | undefined) ?? null
}

/** The game's cover then other images, each once. */
export function poolOf(game: GameDoc): PoolImage[] {
  const out: PoolImage[] = []
  for (const m of [game.cover, ...(game.gallery ?? [])]) {
    if (m == null || typeof m !== 'object') continue
    const x = m as { id: number; url?: string | null; alt?: string | null }
    if (!out.some((o) => o.id === Number(x.id)))
      out.push({ id: Number(x.id), url: x.url, alt: x.alt ?? '' })
  }
  return out
}

/** The covers of the latest articles about the game (drafts included). */
export async function recentCovers(ctx: ScoutContext, gameId: number): Promise<Exclude> {
  const { docs } = await ctx.payload.find({
    collection: 'articles',
    where: {
      or: [{ game: { equals: gameId } }, { relatedGames: { in: [gameId] } }],
    },
    sort: '-createdAt',
    limit: RECENT_COVERS,
    depth: 1,
    draft: true,
    overrideAccess: true,
  })
  const out: Exclude = { ids: new Set(), alts: new Set() }
  for (const a of docs as unknown as Array<{ coverImage?: unknown }>) {
    const c = a.coverImage
    if (c == null) continue
    if (typeof c === 'object') {
      out.ids.add(Number((c as { id: unknown }).id))
      const alt = altKey((c as { alt?: string }).alt)
      if (alt) out.alts.add(alt)
    } else out.ids.add(Number(c))
  }
  return out
}

/**
 * A fresh image of the game for this story: not one of the recent covers nor
 * excluded, the one that fits the subject. Null when every image was used
 * lately (the caller then tries the press, and `reusedGameImage` last).
 */
export async function freshGameImage(
  ctx: ScoutContext,
  settings: SettingsDoc | undefined,
  game: GameDoc,
  title: string,
  exclude: Exclude,
): Promise<PoolImage | null> {
  const pool = poolOf(game).filter(
    (i) => !exclude.ids.has(i.id) && !exclude.alts.has(altKey(i.alt)),
  )
  if (pool.length <= 1) return pool[0] ?? null
  const byUse = await usesLately(ctx, pool)
  const ordered = [...pool].sort((a, b) => (byUse.get(a.id) ?? 0) - (byUse.get(b.id) ?? 0))
  return (await pickBySubject(ctx, settings, title, ordered)) ?? ordered[0]
}

/** Every image was used lately: the one used least, never an excluded one. */
export async function reusedGameImage(
  ctx: ScoutContext,
  game: GameDoc,
  keepOut: Set<number>,
): Promise<PoolImage | null> {
  const pool = poolOf(game).filter((i) => !keepOut.has(i.id))
  if (pool.length <= 1) return pool[0] ?? null
  return leastUsed(pool, await usesLately(ctx, pool))
}

async function usesLately(ctx: ScoutContext, pool: PoolImage[]): Promise<Map<number, number>> {
  const since = new Date(ctx.now.getTime() - COVER_REUSE_DAYS * DAY).toISOString()
  const { docs } = await ctx.payload.find({
    collection: 'articles',
    where: { createdAt: { greater_than: since }, coverImage: { in: pool.map((m) => m.id) } },
    limit: 300,
    depth: 0,
    draft: true,
    overrideAccess: true,
  })
  const uses = new Map<number, number>()
  for (const a of docs as unknown as { coverImage?: number | null }[]) {
    if (a.coverImage != null)
      uses.set(Number(a.coverImage), (uses.get(Number(a.coverImage)) ?? 0) + 1)
  }
  return uses
}
