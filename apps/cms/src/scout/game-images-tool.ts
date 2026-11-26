// ─── Editors' tool: stock a game's official images now ───────────────────────
//   POST /api/scout/game-images { game: id | slug, max?: 1-40 }
// Runs the weekly look online (game-images.ts) at once for one game, with up
// to `max` new images (default 24): for a game the scout hasn't drafted about
// yet, or a game without a cover. Editors only.
//   POST /api/scout/game-images { game: "all", max? }
// The whole library, one game after another, in the background (answers at
// once with how many; the games looked at in the last day are skipped, so
// running it again after a restart picks up where it stopped). Progress:
// each game's imagesCheckedAt, and the "[scout] game images" log lines.

import type { PayloadRequest } from 'payload'
import { isEditorUser } from '../access/roles'
import type { SettingsDoc } from './context'
import { poolOf, stockGameImages, type GameDoc } from './game-images'
import { makeContext } from './run'

export const gameImagesHandler = async (req: PayloadRequest): Promise<Response> => {
  if (!isEditorUser(req.user)) return Response.json({ error: 'editors only' }, { status: 403 })
  const body = ((await req.json?.().catch(() => ({}))) ?? {}) as { game?: unknown; max?: unknown }
  const key = String(body.game ?? '').trim()
  if (!key) return Response.json({ error: 'game: an id or a slug' }, { status: 400 })
  const max = Math.max(1, Math.min(40, Number(body.max ?? 24) || 24))
  if (key === 'all') return stockAll(req, max)
  const { docs } = await req.payload.find({
    collection: 'games',
    where: /^\d+$/.test(key) ? { id: { equals: Number(key) } } : { slug: { equals: key } },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  })
  const game = docs[0] as unknown as GameDoc | undefined
  if (!game) return Response.json({ error: 'no such game' }, { status: 404 })
  const ctx = makeContext(req.payload)
  if (ctx.config.dryRun)
    return Response.json({ error: 'scout in dry run (no API key)' }, { status: 503 })
  const settings = (await req.payload.findGlobal({
    slug: 'scout-settings',
    overrideAccess: true,
  })) as unknown as SettingsDoc
  const added = await stockGameImages(ctx, settings, game, { force: true, max })
  const after = (await req.payload.findByID({
    collection: 'games',
    id: game.id,
    depth: 1,
    overrideAccess: true,
  })) as unknown as GameDoc
  return Response.json({
    game: after.name,
    added,
    igdb: Boolean(ctx.config.igdb),
    cover: poolOf(after)[0]?.id ?? null,
    images: poolOf(after).map((i) => ({ id: i.id, alt: i.alt })),
  })
}

let running = false

/** Every game not looked at in the last day, one after another, detached. */
async function stockAll(req: PayloadRequest, max: number): Promise<Response> {
  if (running) return Response.json({ error: 'already running' }, { status: 409 })
  const ctx = makeContext(req.payload)
  if (ctx.config.dryRun)
    return Response.json({ error: 'scout in dry run (no API key)' }, { status: 503 })
  const since = new Date(Date.now() - 86_400_000).toISOString()
  const { docs } = await req.payload.find({
    collection: 'games',
    where: {
      or: [{ imagesCheckedAt: { exists: false } }, { imagesCheckedAt: { less_than: since } }],
    },
    limit: 1000,
    depth: 0,
    sort: 'id',
    overrideAccess: true,
  })
  const ids = docs.map((d) => Number(d.id))
  const settings = (await req.payload.findGlobal({
    slug: 'scout-settings',
    overrideAccess: true,
  })) as unknown as SettingsDoc
  running = true
  void (async () => {
    let added = 0
    try {
      for (const id of ids) {
        try {
          const game = (await req.payload.findByID({
            collection: 'games',
            id,
            depth: 1,
            overrideAccess: true,
          })) as unknown as GameDoc
          added += await stockGameImages(makeContext(req.payload), settings, game, {
            force: true,
            max,
          })
        } catch (err) {
          req.payload.logger.warn({
            msg: '[scout] game images (all): a game failed',
            game: id,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }
    } finally {
      running = false
      req.payload.logger.info({ msg: '[scout] game images (all): done', games: ids.length, added })
    }
  })()
  return Response.json({ queued: ids.length, max }, { status: 202 })
}
