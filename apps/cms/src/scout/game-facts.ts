// ─── Game facts → the games library ──────────────────────────────────────────
// What a story says about games (release dates and consoles, studios: the
// draft tool's game_facts, checked by cleanGameFacts) goes into the Games
// collection: a new game is created with it, an existing one gets its
// releases merged (lib/game-releases.ts: per console, the news wins) and its
// empty studio, publisher or genre fields filled. Studios and publishers are
// Companies, matched on name or alias, created when missing.
//
// Consoles are Platforms, matched on slug, name or alias; a console the
// collection doesn't have yet (a PS6 reveal) is created, with its family
// guessed from its name. A family alone ("Xbox", "next-gen consoles") is never
// created: the release then keeps its date without consoles, so a partial
// list never reads as complete ("PC" alone for "PC, PS6 and Xbox").
//
// When: a new story game is created at draft time (the article links it);
// everything else waits for the editor's Publish click (publishStory), so a
// rejected draft changes nothing in the library.

import {
  cleanReleases,
  mergeReleases,
  period,
  type PlatformRef,
  type Release,
} from '../lib/game-releases'
import { familyOf } from '../lib/platforms'
import type { ScoutContext } from './context'
import {
  describeRelease,
  type CleanGameFacts,
  type CleanGameFactsEntry,
  type ConsoleFact,
} from './draft-prompt'

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')

interface CompanyIndex {
  byName: Map<string, number>
}

/** Every company, by normalised name and alias (a few hundred rows). */
async function companyIndex(ctx: ScoutContext): Promise<CompanyIndex> {
  const { docs } = await ctx.payload.find({
    collection: 'companies' as never,
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  const byName = new Map<string, number>()
  for (const c of docs as unknown as Array<{ id: number; name: string; aliases?: string[] | null }>) {
    for (const n of [c.name, ...(c.aliases ?? [])]) if (n) byName.set(norm(n), Number(c.id))
  }
  return { byName }
}

/** The ids of these companies, creating the missing ones. */
async function companyIds(ctx: ScoutContext, index: CompanyIndex, names: string[]): Promise<number[]> {
  const ids: number[] = []
  for (const name of names) {
    const key = norm(name)
    if (!key) continue
    let id = index.byName.get(key)
    if (id === undefined) {
      const created = (await ctx.payload.create({
        collection: 'companies' as never,
        data: { name } as never,
        overrideAccess: true,
      })) as unknown as { id: number }
      id = Number(created.id)
      index.byName.set(key, id)
    }
    if (!ids.includes(id)) ids.push(id)
  }
  return ids
}

// ─── Consoles ────────────────────────────────────────────────────────────────

export interface PlatformIndex {
  byKey: Map<string, number>
  names: Map<number, string>
}

/** Every console, by normalised slug, name and alias. */
export async function platformIndex(ctx: ScoutContext): Promise<PlatformIndex> {
  const { docs } = await ctx.payload.find({
    collection: 'platforms' as never,
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  const byKey = new Map<string, number>()
  const names = new Map<number, string>()
  for (const p of docs as unknown as Array<{ id: number; name: string; slug?: string; aliases?: string[] | null }>) {
    names.set(Number(p.id), p.name)
    for (const n of [p.slug, p.name, ...(p.aliases ?? [])]) if (n) byKey.set(norm(n), Number(p.id))
  }
  return { byKey, names }
}

/** A new console goes first in its family (the newest): one place before the first. */
async function firstPosition(ctx: ScoutContext, family: string): Promise<number> {
  const { docs } = await ctx.payload.find({
    collection: 'platforms' as never,
    where: { family: { equals: family } } as never,
    sort: 'position',
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const first = (docs[0] as unknown as { position?: number | null } | undefined)?.position
  return typeof first === 'number' ? first - 1 : 0
}

/** A family or a vague word: never a console of its own. */
const GENERIC =
  /^(xbox|playstation|ps|sony|nintendo|microsoft|sega|valve|meta|console|consoles|nextgen|nextgenconsoles|nextgeneration|currentgen|allplatforms|allconsoles|other|others|tba|tbd|unknown|mobile|vr)$/

/**
 * A release's consoles as Platforms ids. A console the collection doesn't
 * have is created when `create` (else kept as its name, for a preview); a
 * family alone makes the list partial: the release keeps its date only.
 */
export async function resolveConsoles(
  ctx: ScoutContext,
  index: PlatformIndex,
  refs: PlatformRef[],
  create: boolean,
): Promise<PlatformRef[]> {
  const out: PlatformRef[] = []
  for (const ref of refs) {
    if (typeof ref === 'number') {
      if (index.names.has(ref)) out.push(ref)
      continue
    }
    const key = norm(ref)
    const known = index.byKey.get(key)
    if (known !== undefined) {
      if (!out.includes(known)) out.push(known)
      continue
    }
    if (GENERIC.test(key) || key.length < 2) return []
    if (!create) {
      out.push(ref)
      continue
    }
    const created = (await ctx.payload.create({
      collection: 'platforms' as never,
      data: { name: ref, family: familyOf(ref), position: await firstPosition(ctx, familyOf(ref)) } as never,
      overrideAccess: true,
    })) as unknown as { id: number }
    const id = Number(created.id)
    index.byKey.set(key, id)
    index.names.set(id, ref)
    ctx.payload.logger.info({ msg: '[scout] console created', name: ref, id })
    out.push(id)
  }
  return out
}

/**
 * Consoles a story announces or dates: created when missing (family guessed
 * from the name), dated when the news brings a date (it wins, unless it's a
 * vaguer one that agrees: "2027" when Nov 2027 is known). Returns one line
 * per change for Discord; `apply: false` only describes them (the card).
 */
export async function applyConsoleFacts(
  ctx: ScoutContext,
  facts: ConsoleFact[],
  apply: boolean,
): Promise<string[]> {
  if (!facts.length) return []
  const index = await platformIndex(ctx)
  const lines: string[] = []
  for (const f of facts) {
    const key = norm(f.name)
    if (!key || GENERIC.test(key)) continue
    const when = describeRelease({ platforms: [], date: f.date, precision: f.precision })
    try {
      const id = index.byKey.get(key)
      if (id === undefined) {
        if (apply) {
          const created = (await ctx.payload.create({
            collection: 'platforms' as never,
            data: {
              name: f.name,
              family: familyOf(f.name),
              position: await firstPosition(ctx, familyOf(f.name)),
              releasePrecision: f.precision,
              ...(f.date ? { releaseDate: `${f.date}T00:00:00.000Z` } : {}),
            } as never,
            overrideAccess: true,
          })) as unknown as { id: number }
          index.byKey.set(key, Number(created.id))
          index.names.set(Number(created.id), f.name)
        }
        lines.push(`🕹️ 🆕 ${f.name} · ${when}`)
        continue
      }
      const doc = (await ctx.payload.findByID({
        collection: 'platforms' as never,
        id,
        depth: 0,
        overrideAccess: true,
      })) as unknown as { name: string; releaseDate?: string | null; releasePrecision?: Release['precision'] | null }
      const known = cleanReleases([{ platforms: [], date: doc.releaseDate, precision: doc.releasePrecision ?? 'tba' }])[0]
      const p = period(f)
      const k = period(known)
      // TBA never replaces a date; a vaguer date that agrees changes nothing.
      if (!p) continue
      if (k && p[0] <= k[0] && k[1] <= p[1]) continue
      if (apply)
        await ctx.payload.update({
          collection: 'platforms' as never,
          id,
          data: { releaseDate: `${f.date}T00:00:00.000Z`, releasePrecision: f.precision } as never,
          overrideAccess: true,
        })
      lines.push(`🕹️ ${doc.name} · ${when}`)
    } catch (err) {
      ctx.payload.logger.warn({
        msg: '[scout] console fact not applied',
        console: f.name,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
  return lines
}

async function resolveReleases(
  ctx: ScoutContext,
  index: PlatformIndex,
  releases: Release[],
  create: boolean,
): Promise<Release[]> {
  const out: Release[] = []
  for (const r of releases) out.push({ ...r, platforms: await resolveConsoles(ctx, index, r.platforms, create) })
  return out
}

/** Names for Discord: a console's name, or "🆕 <name>" for one Publish will create. */
const labelIn = (index: PlatformIndex) => (p: PlatformRef) =>
  typeof p === 'number' ? (index.names.get(p) ?? `#${p}`) : `🆕 ${p}`

const rows = (releases: Release[]) =>
  releases.map((r) => ({ platforms: r.platforms, date: r.date, precision: r.precision }))

/** Create a game the story names that isn't in Games yet, with what the sources say. */
export async function createGame(
  ctx: ScoutContext,
  name: string,
  facts: CleanGameFacts | undefined,
  index?: CompanyIndex,
  consoles?: PlatformIndex,
): Promise<number> {
  const idx = index ?? (await companyIndex(ctx))
  const pidx = consoles ?? (await platformIndex(ctx))
  const created = await ctx.payload.create({
    collection: 'games',
    data: {
      name,
      releases: rows(await resolveReleases(ctx, pidx, facts?.releases ?? [], true)),
      developers: await companyIds(ctx, idx, facts?.developers ?? []),
      publishers: await companyIds(ctx, idx, facts?.publishers ?? []),
      ...(facts?.genres?.length ? { genre: facts.genres } : {}),
    } as never,
    overrideAccess: true,
  })
  return Number(created.id)
}

interface GameDoc {
  id: number
  name: string
  releases?: unknown
  developers?: unknown[] | null
  publishers?: unknown[] | null
  genre?: string[] | null
}

/**
 * Apply a story's game facts to the library. Existing games (matched on
 * letters and digits) get the news merged in; games marked new are created.
 * Returns the ids of the games touched or created, and one line per change
 * for Discord. Errors on one game don't stop the others.
 */
export async function applyGameFacts(
  ctx: ScoutContext,
  facts: CleanGameFactsEntry[],
): Promise<{ ids: number[]; lines: string[] }> {
  const ids: number[] = []
  const lines: string[] = []
  if (!facts.length) return { ids, lines }
  const today = ctx.now.toISOString().slice(0, 10)
  const index = await companyIndex(ctx)
  const consoles = await platformIndex(ctx)
  const label = labelIn(consoles)
  const { docs } = await ctx.payload.find({
    collection: 'games',
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  const games = docs as unknown as GameDoc[]
  for (const f of facts) {
    try {
      const game = games.find((g) => norm(g.name) === norm(f.game))
      if (!game) {
        if (!f.is_new) continue
        const id = await createGame(ctx, f.game, f, index, consoles)
        games.push({ id, name: f.game })
        ids.push(id)
        const created = await resolveReleases(ctx, consoles, f.releases, false)
        lines.push(`➕ ${f.game} : ${created.map((r) => describeRelease(r, label)).join(' ; ') || 'fiche créée'}`)
        continue
      }
      const current = cleanReleases(game.releases)
      const incoming = await resolveReleases(ctx, consoles, f.releases, true)
      const merged = mergeReleases(current, incoming, today)
      const data: Record<string, unknown> = {}
      if (JSON.stringify(merged) !== JSON.stringify(current)) data.releases = rows(merged)
      if (!game.developers?.length && f.developers.length)
        data.developers = await companyIds(ctx, index, f.developers)
      if (!game.publishers?.length && f.publishers.length)
        data.publishers = await companyIds(ctx, index, f.publishers)
      if (!game.genre?.length && f.genres.length) data.genre = f.genres
      ids.push(Number(game.id))
      if (!Object.keys(data).length) continue
      await ctx.payload.update({
        collection: 'games',
        id: game.id,
        data: data as never,
        overrideAccess: true,
      })
      if (data.releases)
        lines.push(`🗓️ ${game.name} : ${merged.map((r) => describeRelease(r, label)).join(' ; ')}`)
      else lines.push(`🏷️ ${game.name} : studio / éditeur complété`)
    } catch (err) {
      ctx.payload.logger.warn({
        msg: '[scout] game facts not applied',
        game: f.game,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
  return { ids, lines }
}

/**
 * What Publish will change, for the Discord card (no write). One line per
 * game: its releases after the merge, or "new page".
 */
export async function previewGameFacts(
  ctx: ScoutContext,
  facts: CleanGameFactsEntry[],
): Promise<string[]> {
  if (!facts.length) return []
  const today = ctx.now.toISOString().slice(0, 10)
  const consoles = await platformIndex(ctx)
  const label = labelIn(consoles)
  const { docs } = await ctx.payload.find({
    collection: 'games',
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  const games = docs as unknown as GameDoc[]
  const out: string[] = []
  for (const f of facts) {
    // Consoles not created yet stay as their names (🆕 on the card).
    const incoming = await resolveReleases(ctx, consoles, f.releases, false)
    const game = games.find((g) => norm(g.name) === norm(f.game))
    if (!game) {
      if (f.is_new)
        out.push(`➕ ${f.game} : ${incoming.map((r) => describeRelease(r, label)).join(' ; ') || 'nouvelle fiche'}`)
      continue
    }
    const current = cleanReleases(game.releases)
    const merged = mergeReleases(current, incoming, today)
    if (JSON.stringify(merged) !== JSON.stringify(current))
      out.push(`🗓️ ${game.name} : ${merged.map((r) => describeRelease(r, label)).join(' ; ')}`)
  }
  return out
}

/**
 * After a rejected draft deleted the game created for it: remove the
 * consoles created with it that no game uses any more.
 */
export async function dropOrphanPlatforms(
  ctx: ScoutContext,
  ids: number[],
  since: string,
): Promise<void> {
  for (const id of ids) {
    const doc = (await ctx.payload
      .findByID({ collection: 'platforms' as never, id, depth: 0, overrideAccess: true })
      .catch(() => null)) as { createdAt?: string } | null
    if (!doc?.createdAt || doc.createdAt < since) continue
    const { totalDocs } = await ctx.payload.count({
      collection: 'games',
      where: { platforms: { in: [id] } },
      overrideAccess: true,
    })
    if (totalDocs === 0)
      await ctx.payload.delete({ collection: 'platforms' as never, id, overrideAccess: true })
  }
}

/**
 * After a rejected draft deleted the game created for it: remove the
 * companies created with it that no game uses any more.
 */
export async function dropOrphanCompanies(
  ctx: ScoutContext,
  ids: number[],
  since: string,
): Promise<void> {
  for (const id of ids) {
    const doc = (await ctx.payload
      .findByID({ collection: 'companies' as never, id, depth: 0, overrideAccess: true })
      .catch(() => null)) as { createdAt?: string } | null
    if (!doc?.createdAt || doc.createdAt < since) continue
    const { totalDocs } = await ctx.payload.count({
      collection: 'games',
      where: { or: [{ developers: { in: [id] } }, { publishers: { in: [id] } }] },
      overrideAccess: true,
    })
    if (totalDocs === 0)
      await ctx.payload.delete({ collection: 'companies' as never, id, overrideAccess: true })
  }
}
