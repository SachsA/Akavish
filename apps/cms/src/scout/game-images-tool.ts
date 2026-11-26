// ─── Editors' tool: stock a game's official images now ───────────────────────
//   POST /api/scout/game-images { game: id | slug, max?: 1-40 }
// Runs the weekly look online (game-images.ts) at once for one game, with up
// to `max` new images (default 24): for a game the scout hasn't drafted about
// yet, a game without a cover, or a pass over the whole library. Editors only.

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
