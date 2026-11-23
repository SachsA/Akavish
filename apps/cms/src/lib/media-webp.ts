// ─── Media sizes in WebP ─────────────────────────────────────────────────────
// Since 2026-11-23 every size Payload makes (collections/Media.ts) is WebP.
// New uploads get them by themselves; this re-processes the images uploaded
// before, one at a time: it reads the original back from storage and saves
// it again on the same document, so Payload makes every size anew in WebP,
// under the same original filename (`overwriteExistingFiles`), and the
// storage adapter deletes the old JPEG/PNG sizes. Alt text, credit, French
// alt and focal point are kept. The media hook then refreshes the pages that
// show the image (lib/revalidate-web.ts).
//
// Run from a computer, with an editor account:
//   node apps/cms/scripts/media-webp.mjs [--max N] [--dry]
// which calls POST /api/media-webp a few images at a time until done.

import type { ImageUploadFormatOptions, Payload, PayloadHandler } from 'payload'
import { isEditorUser } from '../access/roles'

export const MEDIA_SIZE_FORMAT: ImageUploadFormatOptions = {
  format: 'webp',
  options: { quality: 80 },
}

const SIZE_NAMES = ['thumbnail', 'card', 'hero', 'square'] as const

type MediaDoc = {
  id: number | string
  filename?: string | null
  mimeType?: string | null
  filesize?: number | null
  url?: string | null
  focalX?: number | null
  focalY?: number | null
  sizes?: Record<
    string,
    { mimeType?: string | null; filesize?: number | null; url?: string | null } | null
  > | null
}

/** Whether an image already has every size, in WebP (nothing to do). */
export function hasWebpSizes(doc: MediaDoc): boolean {
  if (!doc.mimeType?.startsWith('image/') || doc.mimeType === 'image/svg+xml') return true
  return SIZE_NAMES.every((name) => doc.sizes?.[name]?.mimeType === 'image/webp')
}

/** Total weight of the sizes, in bytes (for the report). */
export function sizesWeight(doc: MediaDoc): number {
  return SIZE_NAMES.reduce((sum, name) => sum + (doc.sizes?.[name]?.filesize ?? 0), 0)
}

async function readOriginal(payload: Payload, doc: MediaDoc): Promise<Buffer> {
  if (!doc.url) throw new Error('no url')
  const url = doc.url.startsWith('/') ? `${payload.config.serverURL}${doc.url}` : doc.url
  // Filenames may hold spaces ("Screenshot 2026-11-18 at 17.26.30.png").
  const res = await fetch(encodeURI(decodeURI(url)), {
    headers: { 'User-Agent': 'AkavishScout/1.0 (+https://akavish.gg)' },
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`original: HTTP ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

export type WebpResult =
  | { id: number | string; status: 'done'; before: number; after: number }
  | { id: number | string; status: 'skipped' }
  | { id: number | string; status: 'error'; error: string }

/** Re-make one image's sizes in WebP. */
export async function convertMedia(
  payload: Payload,
  doc: MediaDoc,
  dry = false,
): Promise<WebpResult> {
  if (hasWebpSizes(doc)) return { id: doc.id, status: 'skipped' }
  if (dry) return { id: doc.id, status: 'done', before: sizesWeight(doc), after: 0 }
  try {
    const data = await readOriginal(payload, doc)
    const updated = (await payload.update({
      collection: 'media',
      id: doc.id,
      data: { focalX: doc.focalX ?? 50, focalY: doc.focalY ?? 50 },
      file: {
        data,
        mimetype: doc.mimeType ?? 'image/jpeg',
        name: doc.filename ?? 'image',
        size: data.length,
      },
      overwriteExistingFiles: true,
      overrideAccess: true,
      depth: 0,
    })) as unknown as MediaDoc
    return { id: doc.id, status: 'done', before: sizesWeight(doc), after: sizesWeight(updated) }
  } catch (err) {
    return { id: doc.id, status: 'error', error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * POST /api/media-webp {after?, limit?, dry?}: converts the next images (by
 * id, after `after`), at most `limit` (5, up to 20) that need it. Answers
 * what it did and `next`, the id to pass as `after` next time (null: done).
 * Editors and admins only.
 */
export const mediaWebpHandler: PayloadHandler = async (req) => {
  if (!req.user || req.user.collection !== 'users')
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  if (!isEditorUser(req.user)) return Response.json({ error: 'editors only' }, { status: 403 })
  let body: { after?: unknown; limit?: unknown; dry?: unknown } = {}
  try {
    body = (await req.json?.()) ?? {}
  } catch {
    // no body: defaults
  }
  const after = Number(body.after) || 0
  const limit = Math.min(20, Math.max(1, Number(body.limit) || 5))
  const dry = body.dry === true
  const results: WebpResult[] = []
  let cursor = after
  let next: number | null = null
  // Walk by id; skipped images don't count towards the limit.
  for (;;) {
    const page = await req.payload.find({
      collection: 'media',
      where: { id: { greater_than: cursor } },
      sort: 'id',
      limit: 50,
      depth: 0,
      overrideAccess: true,
    })
    const docs = page.docs as unknown as MediaDoc[]
    if (!docs.length) break
    for (const doc of docs) {
      cursor = Number(doc.id)
      const result = await convertMedia(req.payload, doc, dry)
      if (result.status !== 'skipped') results.push(result)
      if (results.length >= limit) {
        next = cursor
        break
      }
    }
    if (next !== null) break
  }
  const remaining = next === null ? 0 : await countRemaining(req.payload, next)
  return Response.json({ results, next: remaining ? next : null, remaining })
}

async function countRemaining(payload: Payload, after: number): Promise<number> {
  const { docs } = await payload.find({
    collection: 'media',
    where: { id: { greater_than: after } },
    limit: 0,
    pagination: false,
    depth: 0,
    overrideAccess: true,
    select: { mimeType: true, sizes: true },
  } as never)
  return (docs as unknown as MediaDoc[]).filter((d) => !hasWebpSizes(d)).length
}
