// ─── Morning esport recap (scout step 4, phase 3) ────────────────────────────
// Every morning from 8 am Paris, yesterday's finished matches of the big
// tournaments (tiers in Scout settings, S and A by default) become one draft,
// "Esport results: Monday, November 23", sent to Discord like every scout
// draft (Publish / Edit / Reject). It goes through the usual draft pipeline:
// a story with one source item whose text is the results, read from the
// PandaScore sync (esport-matches), not from a web page. No big match
// yesterday: no recap. Off with "Morning esport recap" unticked, or without
// PANDASCORE_TOKEN.

import type { ScoutContext, SettingsDoc } from '../scout/context'
import { draftStory } from '../scout/draft'
import { parisClock } from '../scout/schedule'
import { GAME_LABEL, ESPORT_GAMES, type EsportGame, type Tier } from './pandascore'
import { esportToken } from './sync'

const SITE = 'https://akavish.gg'
/** The source the recap items hang on (never collected: not active). */
export const RECAP_SOURCE = 'Esport results (PandaScore)'
const RECAP_HOUR = 8

export interface RecapMatch {
  game: EsportGame
  endAt: string
  stage: string
  event: string
  tier: Tier
  team1: string
  team2: string
  score1: number | null
  score2: number | null
  winner: 1 | 2 | null
  bestOf: number | null
  forfeit: boolean
}

type MatchDoc = {
  game: EsportGame
  endAt?: string | null
  beginAt?: string | null
  status?: string | null
  bestOf?: number | null
  team1?: { name?: string | null } | null
  team2?: { name?: string | null } | null
  score1?: number | null
  score2?: number | null
  winner?: number | null
  forfeit?: boolean | null
  tournament?: {
    name?: string | null
    league?: string | null
    serie?: string | null
    tier?: string | null
  } | null
}

export function recapMatchOf(d: MatchDoc): RecapMatch | null {
  const t = d.tournament && typeof d.tournament === 'object' ? d.tournament : null
  if (!t || !d.endAt || !ESPORT_GAMES.includes(d.game)) return null
  const league = (t.league ?? '').trim()
  const serie = (t.serie ?? '').trim()
  return {
    game: d.game,
    endAt: d.endAt,
    stage: (t.name ?? '').trim(),
    event:
      serie && league && !serie.toLowerCase().startsWith(league.toLowerCase())
        ? `${league} ${serie}`
        : serie || league,
    tier: ((t.tier as Tier) || 'unranked') as Tier,
    team1: d.team1?.name?.trim() || 'TBD',
    team2: d.team2?.name?.trim() || 'TBD',
    score1: d.score1 ?? null,
    score2: d.score2 ?? null,
    winner: d.winner === 1 || d.winner === 2 ? d.winner : null,
    bestOf: d.bestOf ?? null,
    forfeit: d.forfeit === true,
  }
}

/** The matches of one Paris day in the chosen tiers. */
export function recapSelection(
  matches: RecapMatch[],
  parisDate: string,
  tiers: Tier[],
): RecapMatch[] {
  return matches
    .filter((m) => parisClock(new Date(m.endAt)).date === parisDate && tiers.includes(m.tier))
    .sort((a, b) => Date.parse(a.endAt) - Date.parse(b.endAt))
}

/** "Monday, November 23" */
export function recapDay(parisDate: string): string {
  return new Date(`${parisDate}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

/**
 * The source text the draft is written from: every match, by game then
 * event, with the exact scores. The opening lines say what to write.
 */
export function recapText(matches: RecapMatch[], parisDate: string): string {
  const lines = [
    `Official results from PandaScore for ${recapDay(parisDate)} (Paris time), big tournaments only.`,
    'Write a daily esport results round-up: a short intro on the standout results (titles, upsets, eliminations, qualifications) using only these results, then every match below grouped by game and tournament, with the exact scores. Winners as given; no stats, odds or quotes.',
    '',
  ]
  for (const game of ESPORT_GAMES) {
    const ofGame = matches.filter((m) => m.game === game)
    if (!ofGame.length) continue
    lines.push(`## ${GAME_LABEL[game]}`)
    const events = [...new Set(ofGame.map((m) => m.event))]
    for (const event of events) {
      const ms = ofGame.filter((m) => m.event === event)
      lines.push(`### ${event} (tier ${ms[0].tier.toUpperCase()})`)
      for (const m of ms) {
        const score = m.score1 != null && m.score2 != null ? `${m.score1}-${m.score2}` : 'no score'
        const won = m.winner === 1 ? m.team1 : m.winner === 2 ? m.team2 : null
        const extra = [m.stage, m.bestOf ? `best of ${m.bestOf}` : '', m.forfeit ? 'forfeit' : '']
          .filter(Boolean)
          .join(', ')
        lines.push(
          `- ${m.team1} ${score} ${m.team2}${won ? `, ${won} win` : ''}${extra ? ` (${extra})` : ''}`,
        )
      }
    }
    lines.push('')
  }
  return lines.join('\n').trim()
}

/** The game with the most matches: the draft's game (its cover is the default image). */
export function mainGame(matches: RecapMatch[]): EsportGame | null {
  const count = new Map<EsportGame, number>()
  for (const m of matches) count.set(m.game, (count.get(m.game) ?? 0) + 1)
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

export type RecapSettings = SettingsDoc & {
  esportRecap?: boolean | null
  esportRecapTiers?: Tier[] | null
  lastEsportRecap?: string | null
}

async function recapSourceId(ctx: ScoutContext): Promise<number> {
  const { docs } = await ctx.payload.find({
    collection: 'scout-sources',
    where: { name: { equals: RECAP_SOURCE } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (docs[0]) return Number(docs[0].id)
  const created = await ctx.payload.create({
    collection: 'scout-sources',
    data: {
      name: RECAP_SOURCE,
      url: 'https://www.pandascore.co',
      kind: 'rss',
      reliability: 'official',
      cadence: 'normal',
      language: 'en',
      general: false,
      // Never collected: the recap reads the synced matches.
      active: false,
    } as never,
    overrideAccess: true,
  })
  return Number(created.id)
}

/**
 * The morning recap, once a day from 8 am Paris. Returns the story id, or
 * null when there's nothing to do (too early, already done, off, no match).
 */
export async function maybeEsportRecap(
  ctx: ScoutContext,
  settings: RecapSettings,
): Promise<number | null> {
  if (!esportToken() || settings.esportRecap === false) return null
  const { hour } = parisClock(ctx.now)
  if (hour < RECAP_HOUR) return null
  const yesterday = parisClock(new Date(ctx.now.getTime() - 24 * 3600 * 1000)).date
  if (settings.lastEsportRecap === yesterday) return null
  const mark = () =>
    ctx.payload.updateGlobal({
      slug: 'scout-settings',
      data: { lastEsportRecap: yesterday } as never,
      overrideAccess: true,
    })

  // A window wide enough for any time zone offset, then the Paris day exactly.
  const from = new Date(`${yesterday}T00:00:00Z`).getTime() - 3 * 3600 * 1000
  const { docs } = await ctx.payload.find({
    collection: 'esport-matches',
    where: {
      and: [
        { status: { equals: 'finished' } },
        { endAt: { greater_than_equal: new Date(from).toISOString() } },
        { endAt: { less_than: new Date(from + 30 * 3600 * 1000).toISOString() } },
      ],
    },
    limit: 1000,
    depth: 1,
    pagination: false,
    overrideAccess: true,
  })
  const tiers = settings.esportRecapTiers?.length
    ? settings.esportRecapTiers
    : (['s', 'a'] as Tier[])
  const matches = recapSelection(
    (docs as unknown as MatchDoc[]).map(recapMatchOf).filter((m): m is RecapMatch => m !== null),
    yesterday,
    tiers,
  )
  if (!matches.length) {
    await mark()
    ctx.payload.logger.info({ msg: '[esport] no recap: no big match', day: yesterday })
    return null
  }

  const game = mainGame(matches)
  const story = await ctx.payload.create({
    collection: 'scout-stories',
    data: {
      title: `Esport results: ${recapDay(yesterday)}`,
      game: game ? GAME_LABEL[game] : null,
      category: 'esport',
      significance: 60,
      status: 'new',
      score: 0,
      firstSeenAt: ctx.now.toISOString(),
      lastItemAt: ctx.now.toISOString(),
    } as never,
    overrideAccess: true,
  })
  await ctx.payload.create({
    collection: 'scout-items',
    data: {
      title: `Esport results, ${recapDay(yesterday)}`,
      url: `${SITE}/esport/results?day=${yesterday}&tier=${tiers.join(',')}`,
      summary: recapText(matches, yesterday),
      publishedAt: ctx.now.toISOString(),
      source: await recapSourceId(ctx),
      status: 'triaged',
      story: story.id,
    } as never,
    overrideAccess: true,
  })
  // Marked first: a failed draft is redone from Discord, never twice a day.
  await mark()
  await draftStory(ctx, settings, Number(story.id))
  return Number(story.id)
}
