// ─── Weekly report ───────────────────────────────────────────────────────────
// The numbers behind the threshold review: how many stories per day, how their
// scores spread, how many would pass at other thresholds, which sources bring
// nothing, what it costs, and how the drafts fared. `buildReport` and the two
// renderers are pure (unit-tested); `gatherReport` reads the collections.
// Read in /admin with GET /api/scout/report?days=7, sent to Discord with the
// Saturday morning digest, or printed by `pnpm scout:run --report` (local DB).

import type { ScoutContext } from './context'
import type { DiscordMessage } from './discord'
import { parisClock } from './schedule'

export interface ReportStory {
  id: number
  title: string
  score: number
  status: string
  sourceCount?: number | null
  category?: string | null
  createdAt: string
  draftedAt?: string | null
  version?: number | null
  rejectionReason?: string | null
}

export interface ReportItem {
  createdAt: string
  status: string
  source: number
}

export interface ReportUsage {
  createdAt: string
  purpose: string
  costUsd: number
}

export interface ReportSource {
  id: number
  name: string
  active?: boolean | null
  lastStatus?: string | null
  consecutiveFailures?: number | null
}

export interface ReportInput {
  now: Date
  days: number
  threshold: number
  stories: ReportStory[]
  items: ReportItem[]
  usage: ReportUsage[]
  sources: ReportSource[]
}

export interface DayRow {
  date: string
  items: number
  stories: number
  aboveThreshold: number
  drafted: number
  costUsd: number
}

export interface Report {
  from: string
  to: string
  days: number
  /** Days the scout actually collected something: the averages divide by these. */
  activeDays: number
  threshold: number
  perDay: DayRow[]
  totals: { items: number; ignored: number; stories: number; aboveThreshold: number }
  /** Score buckets, low to high. */
  buckets: Array<{ label: string; count: number }>
  /** Average stories per day at or above each candidate threshold. */
  thresholds: Array<{ threshold: number; perDay: number }>
  top: ReportStory[]
  justBelow: ReportStory[]
  drafts: {
    drafted: number
    published: number
    rejected: number
    pending: number
    averageVersion: number
    rejections: string[]
  }
  cost: { total: number; byPurpose: Array<{ purpose: string; usd: number }>; monthPace: number }
  silentSources: string[]
  failingSources: Array<{ name: string; status: string }>
}

const DAY = 86_400_000
const BUCKETS: Array<[string, number, number]> = [
  ['0-29', 0, 29],
  ['30-44', 30, 44],
  ['45-59', 45, 59],
  ['60-74', 60, 74],
  ['75-100', 75, 100],
]
const CANDIDATES = [45, 50, 55, 60, 65, 70, 75]

/** Saturday in Paris: the day the weekly report goes out with the first digest. */
export function isReportDay(now: Date): boolean {
  return (
    new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', weekday: 'short' }).format(now) ===
    'Sat'
  )
}

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d
const paris = (iso: string) => parisClock(new Date(iso)).date

export function buildReport(input: ReportInput): Report {
  const { now, days, threshold } = input
  const since = now.getTime() - days * DAY
  const inWindow = (iso: string) => new Date(iso).getTime() >= since
  const stories = input.stories.filter((s) => inWindow(s.createdAt))
  const items = input.items.filter((i) => inWindow(i.createdAt))
  const usage = input.usage.filter((u) => inWindow(u.createdAt))

  // One row per Paris day of the window, oldest first, even when empty.
  const dates: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = paris(new Date(now.getTime() - i * DAY).toISOString())
    if (!dates.includes(d)) dates.push(d)
  }
  const rows = new Map<string, DayRow>(
    dates.map((date) => [
      date,
      { date, items: 0, stories: 0, aboveThreshold: 0, drafted: 0, costUsd: 0 },
    ]),
  )
  const row = (iso: string) => rows.get(paris(iso))
  for (const i of items) {
    const r = row(i.createdAt)
    if (r) r.items++
  }
  for (const s of stories) {
    const r = row(s.createdAt)
    if (!r) continue
    r.stories++
    if (s.score >= threshold) r.aboveThreshold++
  }
  for (const s of input.stories) {
    if (!s.draftedAt || !inWindow(s.draftedAt)) continue
    const r = row(s.draftedAt)
    if (r) r.drafted++
  }
  for (const u of usage) {
    const r = row(u.createdAt)
    if (r) r.costUsd += u.costUsd
  }
  const perDay = [...rows.values()].map((r) => ({ ...r, costUsd: round(r.costUsd) }))
  // A scout started mid-week (or down for a day) would otherwise look quieter.
  const activeDays = perDay.filter((d) => d.items > 0).length || 1

  const sorted = [...stories].sort((a, b) => b.score - a.score)
  const drafted = input.stories.filter((s) => s.draftedAt && inWindow(s.draftedAt))
  const byPurpose = new Map<string, number>()
  for (const u of usage) byPurpose.set(u.purpose, (byPurpose.get(u.purpose) ?? 0) + u.costUsd)
  const total = usage.reduce((sum, u) => sum + u.costUsd, 0)

  const seen = new Set(items.map((i) => i.source))
  const active = input.sources.filter((s) => s.active !== false)

  return {
    from: dates[0],
    to: dates[dates.length - 1],
    days,
    activeDays,
    threshold,
    perDay,
    totals: {
      items: items.length,
      ignored: items.filter((i) => i.status === 'ignored').length,
      stories: stories.length,
      aboveThreshold: stories.filter((s) => s.score >= threshold).length,
    },
    buckets: BUCKETS.map(([label, lo, hi]) => ({
      label,
      count: stories.filter((s) => s.score >= lo && s.score <= hi).length,
    })),
    thresholds: [...new Set([...CANDIDATES, threshold])]
      .sort((a, b) => a - b)
      .map((t) => ({
        threshold: t,
        perDay: round(stories.filter((s) => s.score >= t).length / activeDays, 1),
      })),
    top: sorted.slice(0, 10),
    justBelow: sorted.filter((s) => s.score < threshold && s.score >= threshold - 15).slice(0, 10),
    drafts: {
      drafted: drafted.length,
      published: drafted.filter((s) => s.status === 'published').length,
      rejected: drafted.filter((s) => s.status === 'rejected').length,
      pending: drafted.filter((s) => s.status === 'drafted').length,
      averageVersion: drafted.length
        ? round(drafted.reduce((n, s) => n + (s.version ?? 1), 0) / drafted.length, 1)
        : 0,
      rejections: drafted
        .map((s) => s.rejectionReason?.trim())
        .filter((r): r is string => Boolean(r))
        .slice(0, 10),
    },
    cost: {
      total: round(total),
      byPurpose: [...byPurpose.entries()]
        .map(([purpose, usd]) => ({ purpose, usd: round(usd) }))
        .sort((a, b) => b.usd - a.usd),
      monthPace: round((total / activeDays) * 30),
    },
    silentSources: active.filter((s) => !seen.has(s.id)).map((s) => s.name),
    failingSources: active
      .filter((s) => (s.consecutiveFailures ?? 0) > 0)
      .map((s) => ({ name: s.name, status: s.lastStatus ?? 'error' })),
  }
}

const usd = (n: number) => `${n.toFixed(2)} $`

/** Plain text, for the admin endpoint and the CLI. */
export function reportText(r: Report): string {
  const lines: string[] = []
  const story = (s: ReportStory) =>
    `  ${String(s.score).padStart(3)}  ${s.title}${s.sourceCount ? ` (${s.sourceCount} sources)` : ''}`
  lines.push(`Scout : bilan du ${r.from} au ${r.to} (${r.days} jours, seuil ${r.threshold})`, '')
  lines.push(
    `Articles lus : ${r.totals.items} (${r.totals.ignored} ignorés) · sujets : ${r.totals.stories} · au-dessus du seuil : ${r.totals.aboveThreshold}`,
    '',
  )
  lines.push('Par jour (date · lus · sujets · au-dessus · brouillons · coût)')
  for (const d of r.perDay) {
    lines.push(
      `  ${d.date}  ${String(d.items).padStart(4)}  ${String(d.stories).padStart(4)}  ${String(d.aboveThreshold).padStart(3)}  ${String(d.drafted).padStart(3)}  ${usd(d.costUsd)}`,
    )
  }
  lines.push('', 'Répartition des scores')
  for (const b of r.buckets) lines.push(`  ${b.label.padEnd(7)} ${b.count}`)
  lines.push(
    '',
    `Sujets par jour selon le seuil (moyenne sur ${r.activeDays} jour${r.activeDays > 1 ? 's' : ''} actif${r.activeDays > 1 ? 's' : ''})`,
  )
  for (const t of r.thresholds) {
    lines.push(`  ${t.threshold === r.threshold ? '→' : ' '} ${t.threshold}  ${t.perDay}`)
  }
  lines.push('', 'Meilleurs sujets')
  lines.push(...(r.top.length ? r.top.map(story) : ['  (aucun)']))
  lines.push('', `Juste sous le seuil (${r.threshold - 15} à ${r.threshold - 1})`)
  lines.push(...(r.justBelow.length ? r.justBelow.map(story) : ['  (aucun)']))
  const d = r.drafts
  lines.push(
    '',
    `Brouillons : ${d.drafted} · publiés ${d.published} · rejetés ${d.rejected} · en attente ${d.pending} · version moyenne ${d.averageVersion}`,
  )
  for (const reason of d.rejections) lines.push(`  rejet : ${reason}`)
  lines.push(
    '',
    `Coût : ${usd(r.cost.total)} (${r.cost.byPurpose.map((p) => `${p.purpose} ${usd(p.usd)}`).join(', ') || 'rien'}) · rythme sur 30 jours : ${usd(r.cost.monthPace)}`,
  )
  lines.push(
    '',
    `Flux sans aucun article sur la période (${r.silentSources.length}) : ${r.silentSources.join(', ') || 'aucun'}`,
  )
  lines.push(
    `Flux en erreur (${r.failingSources.length}) : ${r.failingSources.map((s) => `${s.name} (${s.status})`).join(', ') || 'aucun'}`,
  )
  return lines.join('\n')
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
const BLUE = 0x3b82f6

/** The same report as Discord embeds (4096 characters per description). */
export function reportMessages(r: Report): DiscordMessage[] {
  const days = r.perDay
    .map(
      (d) =>
        `\`${d.date.slice(5)}\` ${d.stories} sujets · **${d.aboveThreshold}** au-dessus · ${d.drafted} brouillons · ${usd(d.costUsd)}`,
    )
    .join('\n')
  const thresholds = r.thresholds
    .map((t) =>
      t.threshold === r.threshold
        ? `**${t.threshold} → ${t.perDay}**`
        : `${t.threshold} → ${t.perDay}`,
    )
    .join(' · ')
  const scores = r.buckets.map((b) => `${b.label} : ${b.count}`).join(' · ')
  const list = (stories: ReportStory[]) =>
    stories.map((s) => `\`${s.score}\` ${clip(s.title, 90)}`).join('\n') || '(aucun)'
  const d = r.drafts
  const sources =
    `Sans article : ${r.silentSources.join(', ') || 'aucun'}\n` +
    `En erreur : ${r.failingSources.map((s) => `${s.name} (${clip(s.status, 40)})`).join(', ') || 'aucun'}`

  return [
    {
      content: `**Scout, bilan de la semaine** (${r.from} → ${r.to}, seuil ${r.threshold}). Détail complet : /api/scout/report dans le navigateur, connecté à /admin.`,
      embeds: [
        { title: 'Par jour', description: clip(days, 4000), color: BLUE },
        {
          title: 'Seuil',
          description: clip(
            `Sujets par jour selon le seuil (moyenne sur ${r.activeDays} j actifs) : ${thresholds}\nRépartition des scores : ${scores}`,
            4000,
          ),
          color: BLUE,
        },
        { title: 'Meilleurs sujets', description: clip(list(r.top), 4000), color: BLUE },
        {
          title: `Juste sous le seuil (${r.threshold - 15} à ${r.threshold - 1})`,
          description: clip(list(r.justBelow), 4000),
          color: BLUE,
        },
        {
          title: 'Brouillons, coût, flux',
          description: clip(
            `Brouillons : ${d.drafted} · publiés ${d.published} · rejetés ${d.rejected} · en attente ${d.pending} · version moyenne ${d.averageVersion}\n` +
              `Coût : ${usd(r.cost.total)} · rythme sur 30 jours : ${usd(r.cost.monthPace)}\n${sources}`,
            4000,
          ),
          color: BLUE,
        },
      ],
    },
  ]
}

/** Read what the report needs from the scout collections. */
export async function gatherReport(
  ctx: ScoutContext,
  threshold: number,
  days = 7,
): Promise<Report> {
  const since = new Date(ctx.now.getTime() - days * DAY).toISOString()
  const all = async <T>(collection: string, where: Record<string, unknown>) =>
    (
      await ctx.payload.find({
        collection: collection as never,
        where: where as never,
        pagination: false,
        depth: 0,
        overrideAccess: true,
      })
    ).docs as unknown as T[]

  const [stories, items, usage, sources] = await Promise.all([
    all<ReportStory>('scout-stories', {
      or: [
        { createdAt: { greater_than_equal: since } },
        { draftedAt: { greater_than_equal: since } },
      ],
    }),
    all<ReportItem>('scout-items', { createdAt: { greater_than_equal: since } }),
    all<ReportUsage>('scout-usage', { createdAt: { greater_than_equal: since } }),
    all<ReportSource>('scout-sources', {}),
  ])
  return buildReport({ now: ctx.now, days, threshold, stories, items, usage, sources })
}
