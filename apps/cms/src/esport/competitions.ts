// ─── Esport competitions (2026-11-27) ────────────────────────────────────────
// The big competitions (PandaScore "leagues": PGL Major, IEM, VCT, Worlds…)
// and their editions ("series": Singapore 2026, Beijing 2026…), on now, coming
// and past with their winner, for /esport/competitions. Tier S, A and B only
// (the tournaments the site already follows). All on PandaScore's free plan:
// GET /<game>/tournaments/{past,running,upcoming} with the tier filter, one
// page of 100 per list each hour, every page once to fill the history.
// PandaScore lists an edition only about a week before it starts: the ones
// announced months ahead aren't there.
//
// Pure helpers here (tested), the sync in competitions-sync.ts.

import { API_BASE, PANDASCORE_SLUG, TIERS, tierOf, type EsportGame, type Tier } from './pandascore'

export const BIG_TIERS: Tier[] = ['s', 'a', 'b']

/** One tournament (a stage) as the tournaments lists send it: only what we read. */
export interface RawTournament {
  id: number
  name?: string | null
  slug?: string | null
  tier?: string | null
  begin_at?: string | null
  end_at?: string | null
  winner_id?: number | null
  winner_type?: string | null
  /** "1,250,000 United States Dollar" */
  prizepool?: string | null
  /** Where a LAN is played (ISO code); none online. */
  country?: string | null
  league?: {
    id?: number | null
    name?: string | null
    slug?: string | null
    image_url?: string | null
  } | null
  serie?: {
    id?: number | null
    name?: string | null
    full_name?: string | null
    year?: number | null
    slug?: string | null
    begin_at?: string | null
    end_at?: string | null
    winner_id?: number | null
    winner_type?: string | null
  } | null
}

export interface LeagueData {
  pandaId: number
  game: EsportGame
  name: string
  /** Ours, for the URL: the game and the name ("cs2-pgl-major", "lol-worlds"). */
  slug: string
  pandaSlug: string | null
  logoUrl: string | null
}

export interface StageData {
  pandaId: number
  name: string
  slug: string | null
  tier: Tier
  beginAt: string | null
  endAt: string | null
  winnerId: number | null
  prizePool?: string | null
  country?: string | null
}

export interface SeriesData {
  pandaId: number
  game: EsportGame
  leaguePandaId: number
  /** "Singapore 2026", "Season 24 2026" (PandaScore's full name). */
  name: string
  year: number | null
  slug: string | null
  beginAt: string | null
  endAt: string | null
  /** Its best stage's tier. */
  tier: Tier
  /** PandaScore team id of the winner, once it's over (`winnerOf`). */
  winnerPandaId: number | null
  /** The biggest prize pool of its stages ("1,250,000 United States Dollar"). */
  prizePool: string | null
  /** Where it's played (a LAN's country code), from its stages. */
  country: string | null
  /** PandaScore's own winner of the edition (often unset): `winnerOf`'s first choice. */
  serieWinner: number | null
  stages: StageData[]
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

export function slugify(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const leagueSlug = (game: EsportGame, name: string): string =>
  `${game}-${slugify(name) || 'competition'}`

const bestTier = (tiers: Tier[]): Tier =>
  tiers.reduce<Tier>((best, t) => (TIERS.indexOf(t) < TIERS.indexOf(best) ? t : best), 'unranked')

/** "1,250,000 United States Dollar" → 1250000 (0 when unreadable). */
export const prizeAmount = (p: string | null | undefined): number =>
  Number((p ?? '').match(/^[\d.,\s]+/)?.[0].replace(/[^\d]/g, '') || 0)

/** An edition's prize pool (its biggest stage's) and country (its LAN's, the last one). */
export function editionDetails(stages: StageData[]): {
  prizePool: string | null
  country: string | null
} {
  const prize = stages.reduce<string | null>(
    (best, s) => (prizeAmount(s.prizePool) > prizeAmount(best) ? (s.prizePool ?? null) : best),
    null,
  )
  const country = [...stages].reverse().find((s) => s.country)?.country ?? null
  return { prizePool: prize, country }
}

/** Stages by id, the newer copy winning; in time order. */
export function mergeStages(old: StageData[], fresh: StageData[]): StageData[] {
  const byId = new Map<number, StageData>()
  for (const s of [...old, ...fresh]) byId.set(s.pandaId, s)
  return [...byId.values()].sort(
    (a, b) => (a.beginAt ?? '9999').localeCompare(b.beginAt ?? '9999') || a.pandaId - b.pandaId,
  )
}

/**
 * Who won an edition: PandaScore's own winner when it has one, else, once
 * every stage is over, the winner of the stage that ended last (the
 * playoffs, the final). Null while it's on or when nobody is known.
 */
export function winnerOf(
  serieWinner: number | null,
  stages: StageData[],
  endAt: string | null,
  now = new Date(),
): number | null {
  if (serieWinner != null) return serieWinner
  if (!stages.length) return null
  const over = (at: string | null) => !!at && Date.parse(at) <= now.getTime()
  if (!stages.every((s) => over(s.endAt)) || (endAt && !over(endAt))) return null
  const last = [...stages].sort((a, b) => (b.endAt ?? '').localeCompare(a.endAt ?? ''))[0]
  return last.winnerId
}

/**
 * The leagues and editions in a tournaments list, tier S / A / B only (an
 * edition counts when one of its stages is). Stages of the same edition from
 * several lists are merged by the caller (`mergeStages`).
 */
export function editionsOf(
  raws: RawTournament[],
  game: EsportGame,
  now = new Date(),
): { leagues: Map<number, LeagueData>; series: Map<number, SeriesData> } {
  const leagues = new Map<number, LeagueData>()
  const series = new Map<number, SeriesData>()
  for (const r of raws) {
    const leagueId = num(r?.league?.id)
    const serieId = num(r?.serie?.id)
    if (typeof r?.id !== 'number' || leagueId == null || serieId == null) continue
    const name = str(r.league?.name) ?? 'Competition'
    if (!leagues.has(leagueId)) {
      leagues.set(leagueId, {
        pandaId: leagueId,
        game,
        name,
        slug: leagueSlug(game, name),
        pandaSlug: str(r.league?.slug),
        logoUrl: str(r.league?.image_url),
      })
    }
    const stage: StageData = {
      pandaId: r.id,
      name: str(r.name) ?? 'Stage',
      slug: str(r.slug),
      tier: tierOf(r.tier),
      beginAt: str(r.begin_at),
      endAt: str(r.end_at),
      winnerId: r.winner_type && r.winner_type !== 'Team' ? null : num(r.winner_id),
      prizePool: str(r.prizepool),
      country: str(r.country),
    }
    const s = series.get(serieId)
    if (s) {
      s.stages = mergeStages(s.stages, [stage])
    } else {
      series.set(serieId, {
        pandaId: serieId,
        game,
        leaguePandaId: leagueId,
        name: str(r.serie?.full_name) ?? str(r.serie?.name) ?? String(num(r.serie?.year) ?? ''),
        year: num(r.serie?.year),
        slug: str(r.serie?.slug),
        beginAt: str(r.serie?.begin_at),
        endAt: str(r.serie?.end_at),
        tier: 'unranked',
        winnerPandaId: null,
        prizePool: null,
        country: null,
        stages: [stage],
        serieWinner:
          r.serie?.winner_type && r.serie.winner_type !== 'Team' ? null : num(r.serie?.winner_id),
      })
    }
  }
  const out = new Map<number, SeriesData>()
  for (const [id, s] of series) {
    const tier = bestTier(s.stages.map((x) => x.tier))
    if (!BIG_TIERS.includes(tier)) continue
    out.set(id, {
      ...s,
      tier,
      beginAt: s.beginAt ?? s.stages[0]?.beginAt ?? null,
      endAt:
        s.endAt ??
        s.stages.reduce<string | null>(
          (end, x) => (x.endAt && (!end || x.endAt > end) ? x.endAt : end),
          null,
        ),
      winnerPandaId: winnerOf(s.serieWinner, s.stages, s.endAt, now),
      ...editionDetails(s.stages),
    })
  }
  for (const id of [...leagues.keys()])
    if (![...out.values()].some((s) => s.leaguePandaId === id)) leagues.delete(id)
  return { leagues, series: out }
}

/** The tournaments lists one run reads for a game (tier S, A and B, 100 a page). */
export function competitionUrls(game: EsportGame): string[] {
  const slug = PANDASCORE_SLUG[game]
  const q = 'per_page=100&filter[tier]=s,a,b'
  return [
    `${API_BASE}/${slug}/tournaments/running?${q}`,
    `${API_BASE}/${slug}/tournaments/upcoming?${q}&sort=begin_at`,
    `${API_BASE}/${slug}/tournaments/past?${q}&sort=-end_at`,
  ]
}

// ─── Finding the competitions an article is about ────────────────────────────

export interface LeagueNames {
  id: number | string
  game: EsportGame
  /** Its name, aliases and recent editions' names ("PGL Major", "Singapore Major"). */
  names: string[]
}

const fold = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const GAME_WORD: Record<EsportGame, string> = {
  cs2: 'CS2',
  valorant: 'Valorant',
  lol: 'LoL',
  r6: 'R6',
  rl: 'RLCS',
}

/**
 * The names articles give an edition: "IEM Beijing", "PGL Bucharest", "PGL
 * Singapore Major", "Singapore Major", "VCT Masters London", "Valorant
 * Champions". The edition's name without its year (the city, the event), put
 * with the competition's. A lone generic word ("Champions", "Fall") never on
 * its own. Pure.
 */
export function editionNames(league: string, edition: string, game: EsportGame): string[] {
  const e = edition
    .replace(/\b(19|20)\d\d\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!e || e.includes(':')) return []
  const words = league.split(/\s+/).filter(Boolean)
  const out = new Set<string>([`${league} ${e}`, `${GAME_WORD[game]} ${e}`])
  if (words.length > 1) {
    out.add(`${words[0]} ${e}`)
    out.add(`${words[0]} ${e} ${words.slice(1).join(' ')}`)
    out.add(`${e} ${words[words.length - 1]}`)
  }
  // Two words or more ("Masters London") name it alone.
  if (e.split(' ').length > 1 && !/^(season|split|stage|week|day)\b/i.test(e)) out.add(e)
  return [...out]
}

/**
 * The competitions a text names, as whole words (case and accents aside).
 * With the article's game, only that game's; without one, a name that several
 * games share ("Esports World Cup") counts for none. A name found inside a
 * longer name of another one found ("PGL" when "PGL Major" is) doesn't
 * count. Lines (title, tags) are read apart. Names under 3
 * letters are ignored. Pure.
 */
export function detectLeagues(
  text: string,
  leagues: LeagueNames[],
  game: EsportGame | null,
): Array<number | string> {
  // Lines (title, each tag) apart: no name made of the end of one and the start of the next.
  const t = ` ${text.split('\n').map(fold).join(' \u0000 ')} `
  const owners = new Map<string, Set<number | string>>()
  for (const l of leagues)
    for (const n of l.names) {
      const f = fold(n)
      if (!owners.has(f)) owners.set(f, new Set())
      owners.get(f)!.add(l.id)
    }
  const hits: Array<{ id: number | string; name: string }> = []
  for (const l of leagues) {
    if (game && l.game !== game) continue
    for (const raw of new Set(l.names.map(fold))) {
      if (raw.replace(/ /g, '').length < 3) continue
      if (!game && (owners.get(raw)?.size ?? 0) > 1) continue
      if (t.includes(` ${raw} `)) hits.push({ id: l.id, name: raw })
    }
  }
  // "PGL" found, and "PGL Major" found (by any of its names): only the latter.
  const names = new Map(leagues.map((l) => [l.id, l.names.map(fold)]))
  const inLonger = (h: { id: number | string; name: string }) =>
    hits.some(
      (o) =>
        o.id !== h.id &&
        (names.get(o.id) ?? []).some(
          (n) => n.length > h.name.length && ` ${n} `.includes(` ${h.name} `),
        ),
    )
  return [...new Set(hits.filter((h) => !inLonger(h)).map((h) => h.id))]
}
