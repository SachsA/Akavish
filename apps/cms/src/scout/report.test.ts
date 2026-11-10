import { describe, expect, it } from 'vitest'
import {
  buildReport,
  isReportDay,
  reportMessages,
  reportText,
  type ReportInput,
  type ReportStory,
} from './report'

// Tuesday 10 Nov 2026, 12:00 in Paris.
const now = new Date('2026-11-10T11:00:00Z')
const ago = (hours: number) => new Date(now.getTime() - hours * 3_600_000).toISOString()

const story = (id: number, score: number, hours: number, over: Partial<ReportStory> = {}) => ({
  id,
  title: `Story ${id}`,
  score,
  status: 'listed',
  createdAt: ago(hours),
  ...over,
})

const input = (over: Partial<ReportInput> = {}): ReportInput => ({
  now,
  days: 7,
  threshold: 60,
  stories: [
    story(1, 82, 2),
    story(2, 61, 30, { status: 'published', draftedAt: ago(29), version: 2 }),
    story(3, 55, 3, { status: 'rejected', draftedAt: ago(2), rejectionReason: 'Doublon' }),
    story(4, 47, 50),
    story(5, 20, 5),
    story(6, 90, 24 * 10), // outside the 7-day window
  ],
  items: [
    { createdAt: ago(1), status: 'triaged', source: 1 },
    { createdAt: ago(2), status: 'ignored', source: 1 },
    { createdAt: ago(40), status: 'triaged', source: 2 },
    { createdAt: ago(24 * 9), status: 'triaged', source: 3 }, // too old
  ],
  usage: [
    { createdAt: ago(1), purpose: 'triage', costUsd: 0.02 },
    { createdAt: ago(29), purpose: 'draft', costUsd: 0.08 },
    { createdAt: ago(28), purpose: 'revision', costUsd: 0.06 },
    { createdAt: ago(24 * 8), purpose: 'triage', costUsd: 5 }, // too old
  ],
  sources: [
    { id: 1, name: 'Rockstar', active: true },
    { id: 2, name: 'IGN', active: true, consecutiveFailures: 2, lastStatus: 'HTTP 403' },
    { id: 3, name: 'Quiet', active: true },
    { id: 4, name: 'Muted', active: false },
  ],
  ...over,
})

describe('buildReport', () => {
  it('keeps only the window and counts per Paris day', () => {
    const r = buildReport(input())
    expect(r.perDay).toHaveLength(7)
    expect(r.to).toBe('2026-11-10')
    expect(r.totals).toEqual({ items: 3, ignored: 1, stories: 5, aboveThreshold: 2 })
    const today = r.perDay.at(-1)!
    expect(today).toMatchObject({ items: 2, stories: 3, aboveThreshold: 1, drafted: 1 })
    expect(today.costUsd).toBe(0.02)
  })

  it('spreads the scores and simulates other thresholds', () => {
    const r = buildReport(input())
    expect(r.buckets.map((b) => b.count)).toEqual([1, 0, 2, 1, 1])
    expect(r.activeDays).toBe(2) // items today and two days ago
    expect(r.thresholds.find((t) => t.threshold === 45)?.perDay).toBe(2)
    expect(r.thresholds.find((t) => t.threshold === 60)?.perDay).toBe(1)
    expect(r.top.map((s) => s.id)).toEqual([1, 2, 3, 4, 5])
    expect(r.justBelow.map((s) => s.id)).toEqual([3, 4])
  })

  it('sums drafts, costs and source health', () => {
    const r = buildReport(input())
    expect(r.drafts).toEqual({
      drafted: 2,
      published: 1,
      rejected: 1,
      pending: 0,
      averageVersion: 1.5,
      rejections: ['Doublon'],
    })
    expect(r.cost.total).toBe(0.16)
    expect(r.cost.byPurpose[0]).toEqual({ purpose: 'draft', usd: 0.08 })
    expect(r.cost.monthPace).toBe(2.4)
    expect(r.silentSources).toEqual(['Quiet'])
    expect(r.failingSources).toEqual([{ name: 'IGN', status: 'HTTP 403' }])
  })

  it('adds a custom threshold to the candidates', () => {
    const r = buildReport(input({ threshold: 62 }))
    expect(r.thresholds.map((t) => t.threshold)).toContain(62)
  })

  it('works on an empty week', () => {
    const r = buildReport(input({ stories: [], items: [], usage: [] }))
    expect(r.totals.stories).toBe(0)
    expect(r.drafts.averageVersion).toBe(0)
    expect(reportText(r)).toContain('(aucun)')
  })
})

describe('report output', () => {
  it('renders text and Discord embeds within limits', () => {
    const r = buildReport(input())
    const text = reportText(r)
    expect(text).toContain('seuil 60')
    expect(text).toContain('→ 60')
    expect(text).toContain('Flux en erreur (1) : IGN (HTTP 403)')
    const [msg] = reportMessages(r)
    expect(msg.embeds).toHaveLength(5)
    for (const e of msg.embeds ?? []) expect(e.description.length).toBeLessThanOrEqual(4096)
  })

  it('goes out on Saturdays (Paris time)', () => {
    expect(isReportDay(new Date('2026-11-14T07:30:00Z'))).toBe(true)
    expect(isReportDay(new Date('2026-11-13T23:30:00Z'))).toBe(true) // 00:30 Saturday in Paris
    expect(isReportDay(now)).toBe(false)
  })
})
