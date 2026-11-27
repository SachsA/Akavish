// ─── Esport competitions (2026-11-27) ────────────────────────────────────────
// /esport/competitions and one page per competition (PGL Major, IEM, VCT,
// Worlds…): its editions on now, coming and past with their winner. Data: the
// CMS's hourly PandaScore sync (esport-leagues, esport-series, esport-teams:
// apps/cms/src/esport/competitions-sync.ts), tier S, A and B. Pure: mapping
// and grouping, tested.

import { ESPORT_GAMES, type EsportGame, type Tier } from './esport'

const TIERS: Tier[] = ['s', 'a', 'b', 'c', 'd', 'unranked']

export interface CompetitionTeam {
  pandaId: number | null
  name: string
  acronym: string | null
  logo: string | null
  /** Its page (/esport/teams/<slug>), once the sync gave it one. */
  slug?: string | null
}

export interface EditionStage {
  pandaId: number
  name: string
  slug: string | null
  tier: Tier
  beginAt: string | null
  endAt: string | null
}

export interface CompetitionRef {
  slug: string
  name: string
  game: EsportGame
  logo: string | null
}

export interface Edition {
  id: string
  pandaId: number
  game: EsportGame
  /** "Singapore 2026", "Season 24 2026" */
  name: string
  beginAt: string | null
  endAt: string | null
  tier: Tier
  winner: CompetitionTeam | null
  /** "1,250,000 United States Dollar", as PandaScore writes it. */
  prizePool: string | null
  /** Where it's played (country code); none online. */
  country: string | null
  stages: EditionStage[]
  /** Its competition, when read with it (the lists). */
  competition: CompetitionRef | null
}

export interface Competition extends CompetitionRef {
  id: string
  tier: Tier
  lastAt: string | null
  editions: number
  /** The latest edition over with a winner. */
  champion: { edition: string; team: CompetitionTeam } | null
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const tierOf = (v: unknown): Tier => (TIERS.includes(v as Tier) ? (v as Tier) : 'unranked')
const gameOf = (v: unknown): EsportGame | null =>
  ESPORT_GAMES.includes(v as EsportGame) ? (v as EsportGame) : null

function teamOf(v: unknown): CompetitionTeam | null {
  if (!v || typeof v !== 'object') return null
  const t = v as Record<string, unknown>
  const name = str(t.name)
  if (!name) return null
  return { pandaId: num(t.pandaId), name, acronym: str(t.acronym), logo: str(t.logoUrl), slug: str(t.slug) }
}

function refOf(v: unknown): CompetitionRef | null {
  if (!v || typeof v !== 'object') return null
  const d = v as Record<string, unknown>
  const game = gameOf(d.game)
  const slug = str(d.slug)
  const name = str(d.name)
  if (!game || !slug || !name) return null
  return { slug, name, game, logo: str(d.logoUrl) }
}

/** A CMS esport-leagues doc → Competition (null when unusable). */
export function competitionOf(doc: Record<string, unknown>): Competition | null {
  const ref = refOf(doc)
  if (!ref || doc.id == null) return null
  const latest = (doc.latest ?? {}) as Record<string, unknown>
  const champ = (latest.champion ?? null) as Record<string, unknown> | null
  const team = champ ? teamOf(champ.team) : null
  return {
    ...ref,
    id: String(doc.id),
    tier: tierOf(doc.tier),
    lastAt: str(doc.lastAt),
    editions: num(latest.editions) ?? 0,
    champion:
      champ && team
        ? { edition: str((champ.edition as Record<string, unknown> | undefined)?.name) ?? '', team }
        : null,
  }
}

/** A CMS esport-series doc (winner and league populated) → Edition. */
export function editionOf(doc: Record<string, unknown>): Edition | null {
  const game = gameOf(doc.game)
  const pandaId = num(doc.pandaId)
  if (!game || pandaId == null || doc.id == null) return null
  const stages = Array.isArray(doc.stages)
    ? (doc.stages as Array<Record<string, unknown>>).flatMap((s): EditionStage[] => {
        const id = num(s?.pandaId)
        return id == null
          ? []
          : [
              {
                pandaId: id,
                name: str(s.name) ?? '',
                slug: str(s.slug),
                tier: tierOf(s.tier),
                beginAt: str(s.beginAt),
                endAt: str(s.endAt),
              },
            ]
      })
    : []
  return {
    id: String(doc.id),
    pandaId,
    game,
    name: str(doc.name) ?? '',
    beginAt: str(doc.beginAt),
    endAt: str(doc.endAt),
    tier: tierOf(doc.tier),
    winner: teamOf(doc.winner),
    prizePool: str(doc.prizePool),
    country: str(doc.country),
    stages,
    competition: refOf(doc.league),
  }
}

export type EditionStatus = 'upcoming' | 'running' | 'past'

export function editionStatus(e: Pick<Edition, 'beginAt' | 'endAt'>, now = new Date()): EditionStatus {
  const t = now.getTime()
  if (e.beginAt && Date.parse(e.beginAt) > t) return 'upcoming'
  if (e.endAt && Date.parse(e.endAt) < t) return 'past'
  return 'running'
}

/** A qualifier or a regional stage of a bigger event ("Copenhagen: European RMR A 2024"). */
export const isQualifier = (name: string): boolean =>
  /qualif|\brmr\b|last chance|\blcq\b|play-?in\b/i.test(name)

/** The full name of an edition: "IEM Beijing 2026", "Worlds 2026". */
export function editionTitle(competition: string, edition: string): string {
  if (!edition) return competition
  return edition.toLowerCase().startsWith(competition.toLowerCase()) ? edition : `${competition} ${edition}`
}

const tierRank = (t: Tier) => TIERS.indexOf(t)

/**
 * On now (by tier then start), coming (by start), just over: tier S and A,
 * the last 45 days, latest first, 12 at most (the full list is per competition).
 */
export function groupEditions(editions: Edition[], now = new Date()) {
  const running: Edition[] = []
  const upcoming: Edition[] = []
  const recent: Edition[] = []
  const since = now.getTime() - 45 * 86_400_000
  for (const e of editions) {
    const s = editionStatus(e, now)
    if (s === 'running') running.push(e)
    else if (s === 'upcoming') upcoming.push(e)
    else if (
      e.endAt &&
      Date.parse(e.endAt) >= since &&
      (e.tier === 's' || e.tier === 'a') &&
      !isQualifier(e.name)
    )
      recent.push(e)
  }
  running.sort((a, b) => tierRank(a.tier) - tierRank(b.tier) || (a.beginAt ?? '').localeCompare(b.beginAt ?? ''))
  upcoming.sort((a, b) => (a.beginAt ?? '').localeCompare(b.beginAt ?? ''))
  recent.sort((a, b) => (b.endAt ?? '').localeCompare(a.endAt ?? ''))
  return { running, upcoming, recent: recent.slice(0, 12) }
}

/**
 * The competitions list: the ones with an edition in the last 13 months
 * (by tier, then the latest first), and the older ones apart.
 */
export function sortCompetitions(list: Competition[], now = new Date()) {
  const since = now.getTime() - 400 * 86_400_000
  const sorted = [...list].sort(
    (a, b) => tierRank(a.tier) - tierRank(b.tier) || (b.lastAt ?? '').localeCompare(a.lastAt ?? ''),
  )
  return {
    active: sorted.filter((c) => c.lastAt && Date.parse(c.lastAt) >= since),
    archive: sorted.filter((c) => !c.lastAt || Date.parse(c.lastAt) < since),
  }
}

/** A competition's editions: the main ones (latest first), the qualifiers apart. */
export function palmares(editions: Edition[]) {
  const sorted = [...editions].sort((a, b) => (b.beginAt ?? '').localeCompare(a.beginAt ?? ''))
  return {
    main: sorted.filter((e) => !isQualifier(e.name)),
    qualifiers: sorted.filter((e) => isQualifier(e.name)),
  }
}

/** "1,250,000 United States Dollar" → "$1,250,000" / "1 250 000 $US". Unknown currency: as written. */
export function formatPrize(prize: string | null, locale: string): string | null {
  if (!prize) return null
  const m = prize.match(/^([\d.,\s]+)\s*(.*)$/)
  if (!m) return prize
  const amount = Number(m[1].replace(/[^\d]/g, ''))
  if (!amount) return null
  const currency: Record<string, string> = {
    'united states dollar': 'USD',
    euro: 'EUR',
    'chinese yuan': 'CNY',
    'south korean won': 'KRW',
    'brazilian real': 'BRL',
    'pound sterling': 'GBP',
  }
  const code = currency[m[2].trim().toLowerCase()]
  if (!code) return prize
  return new Intl.NumberFormat(locale, { style: 'currency', currency: code, maximumFractionDigits: 0 }).format(amount)
}

/** "SG" → "Singapore" / "Singapour". */
export function countryName(code: string | null, locale: string): string | null {
  if (!code || !/^[A-Z]{2}$/.test(code)) return null
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}
