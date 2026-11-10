/**
 * The AI scout end to end against the local/CI Postgres: collect → triage →
 * digest → budget, with the network faked (feeds, Claude API, Discord), so
 * nothing is fetched or paid for.
 *
 * ⚠ It empties the scout tables (sources, items, stories, usage) of the
 * database it runs on: scout data in a local database is disposable, and the
 * tests need to know exactly what's there. Local databases only (vitest.setup.ts).
 */
import { generateKeyPairSync, sign } from 'node:crypto'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { collect } from '@/scout/collect'
import { scoutConfig } from '@/scout/config'
import type { ScoutContext } from '@/scout/context'
import { maybeSendDigest } from '@/scout/digest'
import { autoDraft, draftStory } from '@/scout/draft'
import { handleInteraction, scoutReportHandler } from '@/scout/interactions'
import { gatherReport } from '@/scout/report'
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
      draftsEnabled: false,
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

// ─── Step 2: drafts and the Discord buttons ──────────────────────────────────

describe('scout step 2 (drafts)', () => {
  const discordPosts: Array<{ url: string; body: Record<string, unknown> }> = []
  const draftFetch: ScoutContext['fetch'] = async (url, init) => {
    if (url === 'https://api.anthropic.com/v1/messages') {
      const body = JSON.parse(String(init.body)) as { messages: Array<{ content: string }> }
      const revision = body.messages[0].content.includes("The editor's feedback")
      return Response.json({
        content: [
          {
            type: 'tool_use',
            name: 'write_article',
            input: {
              title: revision ? 'GTA VI trailer 3 is out (V2)' : 'GTA VI trailer 3 is out',
              excerpt: 'Rockstar released it on Tuesday.',
              category: 'news',
              blocks: [
                { type: 'paragraph', text: 'Rockstar released the third trailer for GTA VI.' },
              ],
              seo_description: 'The third GTA VI trailer.',
            },
          },
        ],
        usage: { input_tokens: 9000, output_tokens: 700 },
      })
    }
    if (url.startsWith('https://discord.com/api/v10/')) {
      discordPosts.push({ url, body: JSON.parse(String(init.body)) })
      return Response.json({ id: `msg-${discordPosts.length}` })
    }
    if (url.startsWith('https://scout-test.invalid/page/')) {
      return new Response(
        '<article><p>Rockstar has released the third trailer for Grand Theft Auto VI on Tuesday afternoon.</p></article>',
      )
    }
    return new Response('nope', { status: 404 })
  }

  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  const rawPub = publicKey.export({ format: 'der', type: 'spki' }).subarray(12).toString('hex')
  const BOT_ENV = {
    DISCORD_BOT_TOKEN: 'test-token',
    DISCORD_APPLICATION_ID: '1',
    DISCORD_PUBLIC_KEY: rawPub,
    SCOUT_DISCORD_CHANNEL_ID: '42',
    SCOUT_DISCORD_OWNER_ID: 'owner',
  }
  const ctx2 = (): ScoutContext => ({
    payload,
    config: scoutConfig({ SCOUT_ENABLED: 'true', ANTHROPIC_API_KEY: 'test-key', ...BOT_ENV }),
    now: NOW,
    fetch: draftFetch,
    notify: async () => {},
  })
  const settings = async () =>
    (await payload.findGlobal({ slug: 'scout-settings', overrideAccess: true })) as never
  /** A signed interaction, as Discord would send it. */
  const interact = (body: Record<string, unknown>) => {
    const raw = JSON.stringify(body)
    const ts = String(Math.floor(Date.now() / 1000))
    const sig = sign(null, Buffer.from(ts + raw), privateKey).toString('hex')
    return handleInteraction(
      payload,
      raw,
      new Headers({ 'x-signature-ed25519': sig, 'x-signature-timestamp': ts }),
    )
  }
  const story = async (id: number) =>
    (await payload.findByID({
      collection: 'scout-stories',
      id,
      depth: 0,
      overrideAccess: true,
    })) as unknown as Record<string, unknown>

  let gtaId: number
  let smallId: number
  const savedEnv: Record<string, string | undefined> = {}

  beforeAll(async () => {
    await wipe()
    for (const [k, v] of Object.entries(BOT_ENV)) {
      savedEnv[k] = process.env[k]
      process.env[k] = v
    }
    const source = await payload.create({
      collection: 'scout-sources',
      data: {
        name: 'Rockstar',
        url: 'https://scout-test.invalid/r.xml',
        kind: 'rss',
        reliability: 'official',
        cadence: 'fast',
        language: 'en',
        active: true,
      },
      overrideAccess: true,
    })
    const mk = async (title: string, score: number, slug: string) => {
      const s = await payload.create({
        collection: 'scout-stories',
        data: {
          title,
          score,
          significance: 90,
          status: 'new',
          firstSeenAt: NOW.toISOString(),
          lastItemAt: NOW.toISOString(),
        },
        overrideAccess: true,
      })
      await payload.create({
        collection: 'scout-items',
        data: {
          title,
          url: `https://scout-test.invalid/page/${slug}`,
          source: source.id,
          status: 'triaged',
          story: s.id,
          publishedAt: NOW.toISOString(),
        },
        overrideAccess: true,
      })
      return Number(s.id)
    }
    gtaId = await mk('GTA VI third trailer', 85, 'gta')
    smallId = await mk('Small indie patch', 30, 'indie')
  })

  afterAll(async () => {
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
    await payload.delete({
      collection: 'articles',
      where: { aiAssisted: { equals: true } },
      overrideAccess: true,
    })
    await wipe()
  })

  it('writes nothing while drafts are switched off', async () => {
    expect(await autoDraft(ctx2(), await settings())).toBe(0)
  })

  it('drafts stories above the threshold into the CMS and posts them with buttons', async () => {
    await payload.updateGlobal({
      slug: 'scout-settings',
      data: { draftsEnabled: true },
      overrideAccess: true,
    })
    expect(await autoDraft(ctx2(), await settings())).toBe(1) // the indie patch stays below 60

    const s = await story(gtaId)
    expect(s).toMatchObject({ status: 'drafted', version: 1, discordMessageId: 'msg-1' })
    const article = (await payload.findByID({
      collection: 'articles',
      id: s.article as number,
      draft: true,
      overrideAccess: true,
    })) as unknown as Record<string, unknown>
    expect(article).toMatchObject({
      title: 'GTA VI trailer 3 is out',
      status: 'draft',
      aiAssisted: true,
    })
    expect(JSON.stringify(article.content)).toContain('https://scout-test.invalid/page/gta') // Sources block

    expect(discordPosts[0].url).toBe('https://discord.com/api/v10/channels/42/messages')
    expect(JSON.stringify(discordPosts[0].body)).toContain('scout:publish:' + gtaId)

    const usage = await payload.find({
      collection: 'scout-usage',
      where: { purpose: { equals: 'draft' } },
      overrideAccess: true,
    })
    expect(usage.docs[0].costUsd).toBeCloseTo(0.025) // 9000 × 2 $ + 700 × 10 $ per million
  })

  it('revises with feedback and posts V2 as a reply', async () => {
    await draftStory(
      ctx2(),
      await settings(),
      gtaId,
      'Mention that it is the third one in the title',
    )
    const s = await story(gtaId)
    expect(s.version).toBe(2)
    expect(s.feedback).toMatchObject([
      { text: 'Mention that it is the third one in the title', version: 2 },
    ])
    const reply = discordPosts.at(-1)!.body
    expect(reply.message_reference).toMatchObject({ message_id: 'msg-1' })
    expect(String(reply.content)).toContain('V2')
  })

  it('only accepts signed requests, answers the PING and only the owner', async () => {
    expect((await interact({ type: 1 })).status).toBe(200)
    expect(await (await interact({ type: 1 })).json()).toEqual({ type: 1 })

    const forged = await handleInteraction(
      payload,
      '{"type":1}',
      new Headers({ 'x-signature-ed25519': '00'.repeat(64), 'x-signature-timestamp': '1' }),
    )
    expect(forged.status).toBe(401)

    const stranger = await (
      await interact({
        type: 3,
        member: { user: { id: 'someone' } },
        data: { custom_id: `scout:publish:${gtaId}` },
      })
    ).json()
    expect(stranger.data.flags).toBe(64)
    expect((await story(gtaId)).status).toBe('drafted')
  })

  it('Publish makes the article public and closes the message', async () => {
    const res = await (
      await interact({
        type: 3,
        member: { user: { id: 'owner' } },
        data: { custom_id: `scout:publish:${gtaId}` },
        message: { embeds: [{ title: 'GTA VI trailer 3 is out (V2)' }] },
      })
    ).json()
    expect(res.type).toBe(7)
    expect(res.data.components).toEqual([])
    expect(res.data.embeds[0].footer.text).toMatch(/^Publié · http:\/\/localhost:3000\/article\//)

    const s = await story(gtaId)
    expect(s.status).toBe('published')
    const article = (await payload.findByID({
      collection: 'articles',
      id: s.article as number,
      overrideAccess: true,
    })) as unknown as Record<string, unknown>
    expect(article).toMatchObject({ status: 'published', _status: 'published' })
    expect(article.publishedAt).toBeTruthy()
  })

  it('Edit opens a form; Reject deletes the draft and keeps the reason', async () => {
    await draftStory(ctx2(), await settings(), smallId) // a manual draft (the digest menu)
    const draftId = (await story(smallId)).article as number

    const form = await (
      await interact({
        type: 3,
        member: { user: { id: 'owner' } },
        data: { custom_id: `scout:edit:${smallId}` },
      })
    ).json()
    expect(form).toMatchObject({ type: 9, data: { custom_id: `scout:editmodal:${smallId}` } })

    const res = await (
      await interact({
        type: 5,
        member: { user: { id: 'owner' } },
        data: {
          custom_id: `scout:rejectmodal:${smallId}`,
          components: [{ components: [{ custom_id: 'text', value: 'Pas intéressant' }] }],
        },
        message: { embeds: [{ title: 'Small indie patch' }] },
      })
    ).json()
    expect(res.data.embeds[0].footer.text).toContain('Rejeté : Pas intéressant')
    expect(await story(smallId)).toMatchObject({
      status: 'rejected',
      rejectionReason: 'Pas intéressant',
      article: null,
    })
    await expect(
      payload.findByID({ collection: 'articles', id: draftId, draft: true, overrideAccess: true }),
    ).rejects.toThrow()
  })
})

// ─── Weekly report ───────────────────────────────────────────────────────────

describe('scout weekly report', () => {
  beforeAll(async () => {
    const at = new Date().toISOString()
    for (const [title, score, status] of [
      ['Big story', 85, 'published'],
      ['Duplicate story', 64, 'rejected'],
      ['Small story', 40, 'listed'],
    ] as const) {
      await payload.create({
        collection: 'scout-stories',
        data: {
          title,
          score,
          status,
          firstSeenAt: at,
          ...(status === 'listed' ? {} : { draftedAt: at, version: 1 }),
        },
        overrideAccess: true,
      })
    }
  })

  it('counts the week, drafts included', async () => {
    // Created at the real time: report from now so they fall in the window.
    const r = await gatherReport({ ...ctx(), now: new Date() }, 60, 7)
    expect(r.totals.stories).toBeGreaterThanOrEqual(3)
    expect(r.totals.aboveThreshold).toBeGreaterThanOrEqual(2)
    expect(r.drafts).toMatchObject({ published: 1, rejected: 1 })
    expect(r.top[0].title).toBe('Big story')
  })

  it('is served to logged-in editors only', async () => {
    const req = (user: unknown) =>
      ({ payload, user, searchParams: new URLSearchParams('days=3') }) as never
    expect((await scoutReportHandler(req(null))).status).toBe(401)
    const res = await scoutReportHandler(req({ id: 1, collection: 'users' }))
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('3 jours, seuil 60')
  })

  it('goes out with the first digest on Saturday', async () => {
    // The next Saturday, 9:30 in Paris (within the week of the stories above).
    const saturday = new Date()
    saturday.setUTCDate(saturday.getUTCDate() + ((6 - saturday.getUTCDay() + 7) % 7 || 7))
    saturday.setUTCHours(8, 30, 0, 0)
    const settings = (await payload.findGlobal({
      slug: 'scout-settings',
      overrideAccess: true,
    })) as never
    sent.length = 0
    expect(await maybeSendDigest(ctx(saturday), settings)).toBe('morning')
    expect(sent.at(-1)?.content).toContain('bilan de la semaine')
    expect(sent.at(-1)?.embeds).toHaveLength(5)
  })
})
