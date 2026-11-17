// ─── Game facts → the games library ──────────────────────────────────────────
// What a story says about games (release dates and consoles, studios: the
// draft tool's game_facts, checked by cleanGameFacts) goes into the Games
// collection: a new game is created with it, an existing one gets its
// releases merged (lib/game-releases.ts: per console, the news wins) and its
// empty studio, publisher or genre fields filled. Studios and publishers are
// Companies, matched on name or alias, created when missing.
//
// When: a new story game is created at draft time (the article links it);
// everything else waits for the editor's Publish click (publishStory), so a
// rejected draft changes nothing in the library.

import { cleanReleases, mergeReleases, type Release } from '../lib/game-releases'
import type { ScoutContext } from './context'
import {
  describeRelease,
  type CleanGameFacts,
  type CleanGameFactsEntry,
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

const rows = (releases: Release[]) =>
  releases.map((r) => ({ platforms: r.platforms, date: r.date, precision: r.precision }))

/** Create a game the story names that isn't in Games yet, with what the sources say. */
export async function createGame(
  ctx: ScoutContext,
  name: string,
  facts: CleanGameFacts | undefined,
  index?: CompanyIndex,
): Promise<number> {
  const idx = index ?? (await companyIndex(ctx))
  const created = await ctx.payload.create({
    collection: 'games',
    data: {
      name,
      releases: rows(facts?.releases ?? []),
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
        const id = await createGame(ctx, f.game, f, index)
        games.push({ id, name: f.game })
        ids.push(id)
        lines.push(`➕ ${f.game} : ${f.releases.map(describeRelease).join(' ; ') || 'fiche créée'}`)
        continue
      }
      const current = cleanReleases(game.releases)
      const merged = mergeReleases(current, f.releases, today)
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
      if (data.releases) lines.push(`🗓️ ${game.name} : ${merged.map(describeRelease).join(' ; ')}`)
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
  const { docs } = await ctx.payload.find({
    collection: 'games',
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  const games = docs as unknown as GameDoc[]
  const out: string[] = []
  for (const f of facts) {
    const game = games.find((g) => norm(g.name) === norm(f.game))
    if (!game) {
      if (f.is_new) out.push(`➕ ${f.game} : ${f.releases.map(describeRelease).join(' ; ') || 'nouvelle fiche'}`)
      continue
    }
    const current = cleanReleases(game.releases)
    const merged = mergeReleases(current, f.releases, today)
    if (JSON.stringify(merged) !== JSON.stringify(current))
      out.push(`🗓️ ${game.name} : ${merged.map(describeRelease).join(' ; ')}`)
  }
  return out
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
