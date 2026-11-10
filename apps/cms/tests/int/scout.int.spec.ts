/**
 * The AI scout end to end against the local/CI Postgres: collect → triage →
 * digest → budget, with the network faked (feeds, Claude API, Discord), so
 * nothing is fetched or paid for.
 *
 * ⚠ It empties the scout tables (sources, items, stories, usage) of the
 * database it runs on: scout data in a local database is disposable, and the
 * tests need to know exactly what's there. Local databases only (vitest.setup.ts).
 */
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { collect } from '@/scout/collect'
import { scoutConfig } from '@/scout/config'
import type { ScoutContext } from '@/scout/context'
import { maybeSendDigest } from '@/scout/digest'
import type { DiscordMessage } from '@/scout/discord'
import { checkBudget } from '@/scout/budget'
import { runScout } from '@/scout/run'
import { triage } from '@/scout/triage'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let payload: Payload
const NOW = new Date('2026-11-10T14:00:00Z')
const iso = (minutesAgo: number) => new Date(NOW.getTime() - minutesAgo * 60_000).toUTCString()

const FEEDS: Record<string, string> = {
  'https://scout-test.invalid/official.xml': `<rss version="2.0"><channel><title>Official</title>
    <item><title>Naughty Dog announces The Last of Us Part III</title>
      <link>https://scout-test.invalid/tlou3-official</link><pubDate>${iso(20)}</pubDate></item>
  </channel></rss>`,
  'https://scout-test.invalid/press.xml': `<rss version="2.0"><channel><title>Press</title>
    <item><title>The Last of Us Part III is official</title>
      <link>https://scout-test.invalid/tlou3-press?utm_source=rss</link><pubDate>${iso(10)}</pubDate></item>
    <item><title>Best SSD deals this week</title>
      <link>https://scout-test.invalid/deals</link><pubDate>${iso(5)}</pubDate></item>
    <item><title>Too old to matter</title>
      <link>https://scout-test.invalid/old</link><pubDate>${iso(60 * 72)}</pubDate></item>
  </channel></rss>`,
}

const claudeCalls: string[] = []
const fakeFetch: ScoutContext['fetch'] = async (url, init) => {
  if (url === 'https://api.anthropic.com/v1/messages') {
    claudeCalls.push(String(init.body))
    const body = JSON.parse(String(init.body)) as { messages: Array<{ content: string }> }
    const prompt = body.messages[0].content
    // Find each item's index in the prompt by its title.
    const idx = (title: string) =>
      Number(prompt.match(new RegExp(`\\[(\\d+)\\] \\([^)]*\\) ${title}`))?.[1])
    return Response.json({
      content: [
        {
          type: 'tool_use',
          name: 'record_triage',
          input: {
            new_stories: [
              {
                key: 'N1',
                title: 'The Last of Us Part III announced',
                game: 'The Last of Us Part III',
                category: 'news',
                significance: 92,
              },
            ],
            assignments: [
              { item: idx('Naughty Dog announces'), story: 'N1' },
              { item: idx('The Last of Us Part III is official'), story: 'N1' },
              { item: idx('Best SSD deals'), story: 'skip' },
            ],
          },
        },
      ],
      usage: { input_tokens: 2000, output_tokens: 300 },
    })
  }
  const feed = FEEDS[url]
  return feed ? new Response(feed, { status: 200 }) : new Response('nope', { status: 404 })
}

const sent: DiscordMessage[] = []
const ctx = (now = NOW): ScoutContext => ({
  payload,
  config: { ...scoutConfig({ SCOUT_ENABLED: 'true', ANTHROPIC_API_KEY: 'test-key' }) },
  now,
  fetch: fakeFetch,
  notify: async (m) => {
    sent.push(m)
  },
})

async function wipe() {
  for (const collection of [
    'scout-items',
    'scout-stories',
    'scout-usage',
    'scout-sources',
  ] as const) {
    await payload.delete({ collection, where: { id: { exists: true } }, overrideAccess: true })
  }
  await payload.updateGlobal({
    slug: 'scout-settings',
    data: {
      paused: false,
      threshold: 60,
      lastMorningDigest: null,
      lastEveningDigest: null,
      lastBudgetAlert: null,
    },
    overrideAccess: true,
  })
}

beforeAll(async () => {
  payload = await getPayload({ config })
  await wipe()
  for (const [url, name, reliability, cadence] of [
    ['https://scout-test.invalid/official.xml', 'Official', 'official', 'fast'],
    ['https://scout-test.invalid/press.xml', 'Press', 'high', 'normal'],
  ] as const) {
    await payload.create({
      collection: 'scout-sources',
      data: { name, url, kind: 'rss', reliability, cadence, language: 'en', active: true },
      overrideAccess: true,
    })
  }
})

afterAll(async () => {
  await wipe()
})

describe('scout', () => {
  it('does nothing unless enabled', async () => {
    expect(await runScout(payload, { config: scoutConfig({}) })).toEqual({
      ran: false,
      reason: 'SCOUT_ENABLED is not true',
    })
  })

  it('collects new, recent items once, and refetches only when due', async () => {
    const first = await collect(ctx())
    expect(first).toEqual({ fetched: 2, stored: 3, errors: 0 }) // the 3-day-old item is ignored

    const { docs } = await payload.find({
      collection: 'scout-items',
      limit: 10,
      overrideAccess: true,
    })
    expect(docs.map((d) => d.url)).toContain('https://scout-test.invalid/tlou3-press') // utm stripped

    expect(await collect(ctx(new Date(NOW.getTime() + 60_000)))).toMatchObject({ fetched: 0 })
    // 6 min later: only the official (5-minute) source is due, and it has nothing new.
    expect(await collect(ctx(new Date(NOW.getTime() + 6 * 60_000)))).toEqual({
      fetched: 1,
      stored: 0,
      errors: 0,
    })
  })

  it('groups the same news from two sources into one scored story', async () => {
    const settings = await payload.findGlobal({ slug: 'scout-settings', overrideAccess: true })
    const report = await triage(ctx(), settings as never)
    expect(report).toMatchObject({ items: 3, newStories: 1, joined: 1, skipped: 1 })
    expect(claudeCalls).toHaveLength(1)

    const { docs } = await payload.find({ collection: 'scout-stories', overrideAccess: true })
    expect(docs).toHaveLength(1)
    // significance 92 → 46, 2 sources → +7.5, official → +20 = 73.5 → 74
    expect(docs[0]).toMatchObject({
      title: 'The Last of Us Part III announced',
      score: 74,
      sourceCount: 2,
      bestReliability: 'official',
    })

    const usage = await payload.find({ collection: 'scout-usage', overrideAccess: true })
    expect(usage.docs[0]).toMatchObject({ purpose: 'triage', inputTokens: 2000, outputTokens: 300 })
    expect(usage.docs[0].costUsd).toBeCloseTo(0.00035)
  })

  it('sends the evening digest once and marks the stories as listed', async () => {
    const evening = new Date('2026-11-10T19:30:00Z') // 20:30 Paris
    const settings = (await payload.findGlobal({
      slug: 'scout-settings',
      overrideAccess: true,
    })) as never
    sent.length = 0
    expect(await maybeSendDigest(ctx(evening), settings)).toBe('evening')
    expect(sent[0].content).toContain('1 sujet, dont 1 au-dessus du seuil (60)')
    expect(sent[0].embeds?.[0].title).toBe('74 · The Last of Us Part III announced')
    expect(sent[0].embeds?.[0].description).toContain('Official, Press')

    const again = (await payload.findGlobal({
      slug: 'scout-settings',
      overrideAccess: true,
    })) as never
    expect(await maybeSendDigest(ctx(new Date(evening.getTime() + 600_000)), again)).toBeNull()
    const { docs } = await payload.find({ collection: 'scout-stories', overrideAccess: true })
    expect(docs[0].status).toBe('listed')
  })

  it('pauses itself and warns once when the monthly budget is spent', async () => {
    await payload.create({
      collection: 'scout-usage',
      data: { kind: 'llm', purpose: 'test', costUsd: 60 },
      overrideAccess: true,
    })
    sent.length = 0
    const settings = (await payload.findGlobal({
      slug: 'scout-settings',
      overrideAccess: true,
    })) as never
    expect(await checkBudget(ctx(), settings)).toEqual({
      ok: false,
      reason: 'monthly budget spent',
    })
    expect(sent).toHaveLength(1)
    expect(sent[0].content).toContain('Scout en pause')

    const after = await payload.findGlobal({ slug: 'scout-settings', overrideAccess: true })
    expect(after.paused).toBe(true)
    expect(await checkBudget(ctx(), after as never)).toMatchObject({ ok: false })
    expect(sent).toHaveLength(1) // not twice

    expect(
      await runScout(payload, { config: ctx().config, fetch: fakeFetch, notify: async () => {} }),
    ).toEqual({
      ran: false,
      reason: 'paused in Scout settings',
    })
  })

  it('keeps the scout collections private', async () => {
    await expect(
      payload.find({ collection: 'scout-stories', overrideAccess: false }),
    ).rejects.toThrow()
    await expect(
      payload.find({ collection: 'scout-usage', overrideAccess: false }),
    ).rejects.toThrow()
  })
})
