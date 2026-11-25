// ─── Morning esport recap (scout step 4, phase 3) ────────────────────────────
// Every morning from 8 am Paris, yesterday's finished matches of the big
// tournaments (tiers in Scout settings, S and A by default) become one draft,
// "Esport results: Monday, November 23", sent to Discord like every scout
// draft (Publish / Edit / Reject). It goes through the usual draft pipeline:
// a story with one source item whose text is the results, read from the
// PandaScore sync (esport-matches), not from a web page. No big match
// yesterday: no recap. Off with "Morning esport recap" unticked, or without
// PANDASCORE_TOKEN. Since 2026-11-25 each group or Swiss stage also gets its
// standings (wins-losses over every finished match of the stage so far), so
// the article says who is 2-0, 1-1 or 0-2, not only who won yesterday.

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
  /** The stage (PandaScore tournament) it belongs to. */
  tournamentId: number | null
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
    id?: number | string | null
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
    tournamentId: t.id != null && Number.isFinite(Number(t.id)) ? Number(t.id) : null,
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

/** A knockout stage: a win-loss record means nothing there. */
export function isBracketStage(stage: string): boolean {
  return /playoff|bracket|final|knockout|elimination|quarter|semi|decider|tiebreak|showmatch/i.test(
    stage,
  )
}

/**
 * The stage's qualification rule when we know it for sure: the CS2 Major
 * stages are Swiss, 3 wins qualify and 3 losses eliminate. Otherwise null:
 * the records are given without a verdict.
 */
export function swissRule(m: Pick<RecapMatch, 'game' | 'event' | 'stage'>): {
  wins: number
  losses: number
} | null {
  if (m.game === 'cs2' && /major/i.test(m.event) && /stage\s*[123]\b/i.test(m.stage))
    return { wins: 3, losses: 3 }
  return null
}

export interface StageRecord {
  team: string
  wins: number
  losses: number
}

/** Wins and losses of every team over the given matches (one stage), best first. */
export function stageRecords(matches: RecapMatch[]): StageRecord[] {
  const rec = new Map<string, StageRecord>()
  const get = (team: string) => {
    let r = rec.get(team)
    if (!r) rec.set(team, (r = { team, wins: 0, losses: 0 }))
    return r
  }
  for (const m of matches) {
    if (m.winner !== 1 && m.winner !== 2) continue
    if (m.team1 === 'TBD' || m.team2 === 'TBD') continue
    get(m.winner === 1 ? m.team1 : m.team2).wins++
    get(m.winner === 1 ? m.team2 : m.team1).losses++
  }
  return [...rec.values()].sort(
    (a, b) => b.wins - a.wins || a.losses - b.losses || a.team.localeCompare(b.team),
  )
}

/**
 * The standings lines of one stage: one line per record ("- 2-0: A, B"),
 * with "qualified" / "eliminated" when the stage's rule is known.
 */
export function standingsLines(
  stage: string,
  stageMatches: RecapMatch[],
  rule: { wins: number; losses: number } | null,
): string[] {
  const records = stageRecords(stageMatches)
  if (records.length < 3) return []
  const groups = new Map<string, string[]>()
  for (const r of records) {
    const verdict = !rule
      ? ''
      : r.wins >= rule.wins
        ? ' (qualified)'
        : r.losses >= rule.losses
          ? ' (eliminated)'
          : ''
    const key = `${r.wins}-${r.losses}${verdict}`
    groups.set(key, [...(groups.get(key) ?? []), r.team])
  }
  return [
    `Standings of ${stage || 'the stage'} after these matches (wins-losses over every finished match of the stage${
      rule
        ? `; Swiss format: ${rule.wins} wins qualify for the next stage, ${rule.losses} losses eliminate`
        : ''
    }):`,
    ...[...groups.entries()].map(([k, teams]) => `- ${k}: ${teams.join(', ')}`),
  ]
}

/** One key per stage: the PandaScore tournament, else its names. */
const stageKey = (m: RecapMatch) => m.tournamentId ?? `${m.event}|${m.stage}`

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
 * event, with the exact scores, then each group or Swiss stage's standings
 * computed from `stageMatches` (every finished match of those stages up to
 * that day; the day's own matches when not given). The opening lines say
 * what to write.
 */
export function recapText(
  matches: RecapMatch[],
  parisDate: string,
  stageMatches: RecapMatch[] = matches,
): string {
  const lines = [
    `Official results from PandaScore for ${recapDay(parisDate)} (Paris time), big tournaments only.`,
    'Write a daily esport results round-up: a short intro on the standout results (titles, upsets, eliminations, qualifications) and on where the stage stands (who is unbeaten, who is on the brink, who qualified or is out), using only these results and standings; then every match below grouped by game and tournament, with the exact scores; then, for each stage that has them, its standings as a list, one line per record exactly as given ("2-0: Team A, Team B"), under a heading such as "Standings after day 2". Winners as given; no stats, odds or quotes.',
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
      // Standings of each group / Swiss stage played that day in this event.
      const stages = new Map<string | number, RecapMatch>()
      for (const x of ms) if (!isBracketStage(x.stage)) stages.set(stageKey(x), x)
      for (const [key, x] of stages) {
        const st = standingsLines(
          x.stage,
          stageMatches.filter((y) => stageKey(y) === key),
          swissRule(x),
        )
        if (st.length) lines.push('', ...st)
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

  // Every finished match of yesterday's group / Swiss stages so far, for
  // their standings (the stage may have started days before).
  const stageIds = [
    ...new Set(
      matches
        .filter((m) => m.tournamentId != null && !isBracketStage(m.stage))
        .map((m) => m.tournamentId as number),
    ),
  ]
  let stageMatches: RecapMatch[] = matches
  if (stageIds.length) {
    const res = await ctx.payload.find({
      collection: 'esport-matches',
      where: {
        and: [
          { tournament: { in: stageIds } },
          { status: { equals: 'finished' } },
          { endAt: { less_than: new Date(from + 30 * 3600 * 1000).toISOString() } },
        ],
      },
      limit: 2000,
      depth: 1,
      pagination: false,
      overrideAccess: true,
    })
    stageMatches = (res.docs as unknown as MatchDoc[])
      .map(recapMatchOf)
      .filter((m): m is RecapMatch => m !== null && parisClock(new Date(m.endAt)).date <= yesterday)
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
      summary: recapText(matches, yesterday, stageMatches),
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
