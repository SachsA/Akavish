// ─── Images: download, check, store ──────────────────────────────────────────
// Shared by the draft covers (media.ts) and the game image library
// (game-images.ts).

import type { ScoutContext } from './context'
import { USER_AGENT } from './extract'

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

/** An image downloaded and checked (https, ≤ 8 MB, jpeg/png/webp/gif), not stored yet. */
export interface Downloaded {
  data: Buffer
  type: string
  ext: string
  base: string
}

/** Download an image and check it is one we can store. Throws with the reason. */
export async function downloadImage(ctx: ScoutContext, url: string): Promise<Downloaded> {
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
  return { data, type, ext, base }
}

/** Store a downloaded image in Media. */
export async function storeImage(
  ctx: ScoutContext,
  img: Downloaded,
  alt: string,
  credit?: string,
): Promise<{ id: number; url?: string | null }> {
  const doc = (await ctx.payload.create({
    collection: 'media',
    data: {
      alt: alt.slice(0, 200),
      ...(credit?.trim() ? { credit: credit.trim().slice(0, 120) } : {}),
    } as never,
    file: {
      data: img.data,
      mimetype: img.type,
      name: `${img.base}.${img.ext}`,
      size: img.data.length,
    },
    overrideAccess: true,
  })) as unknown as { id: number; url?: string | null }
  return { id: Number(doc.id), url: doc.url }
}

/** Download an image (https, ≤ 8 MB, jpeg/png/webp/gif) and store it in Media. */
export async function uploadImage(
  ctx: ScoutContext,
  url: string,
  alt: string,
  /** Shown under the cover ("BLAST / Luc Bouchon"); given with the URL on Discord. */
  credit?: string,
): Promise<{ id: number; url?: string | null }> {
  return storeImage(ctx, await downloadImage(ctx, url), alt, credit)
}
