import { describe, expect, it } from 'vitest'
import { callTool, isForcedToolRefusal, resetToolModes } from './anthropic'
import { scoutConfig } from './config'
import { digestMessages } from './discord'
import { costUsd } from './pricing'
import { dueDigest, isDue, parisClock, periodStarts } from './schedule'
import { bestOf, scoreStory } from './score'
import { decide, dryRunAnswer, triagePrompt, type TriageItem } from './triage-prompt'

describe('scoreStory', () => {
  it('puts an official announcement of a big game well above the threshold', () => {
    expect(
      scoreStory({ significance: 90, sourceCount: 4, bestReliability: 'official', ageHours: 1 }),
    ).toBe(94)
  })

  it('lets good single-source news reach 60 (official post, big story from an outlet)', () => {
    // An official CS2 update (Steam), a star transfer on VLR.gg, a Sensor Tower figure.
    expect(
      scoreStory({ significance: 65, sourceCount: 1, bestReliability: 'official', ageHours: 1 }),
    ).toBeGreaterThanOrEqual(60)
    expect(
      scoreStory({ significance: 75, sourceCount: 1, bestReliability: 'high', ageHours: 1 }),
    ).toBeGreaterThanOrEqual(60)
    // A small patch of another game from one outlet stays well below.
    expect(
      scoreStory({ significance: 30, sourceCount: 1, bestReliability: 'high', ageHours: 1 }),
    ).toBeLessThan(40)
  })

  it('keeps a lone leaker below it until others pick the story up', () => {
    const alone = scoreStory({
      significance: 85,
      sourceCount: 1,
      bestReliability: 'variable',
      ageHours: 1,
    })
    const picked = scoreStory({
      significance: 85,
      sourceCount: 4,
      bestReliability: 'high',
      ageHours: 2,
    })
    expect(alone).toBeLessThan(60)
    expect(picked).toBeGreaterThanOrEqual(60)
  })

  it('caps sources, penalises old news and stays within 0–100', () => {
    expect(
      scoreStory({ significance: 100, sourceCount: 50, bestReliability: 'official', ageHours: 0 }),
    ).toBe(100)
    expect(
      scoreStory({ significance: 60, sourceCount: 1, bestReliability: 'high', ageHours: 30 }),
    ).toBe(41)
    expect(
      scoreStory({ significance: 10, sourceCount: 1, bestReliability: 'variable', ageHours: 100 }),
    ).toBe(0)
  })

  it('bestOf picks the most trustworthy source', () => {
    expect(bestOf(['variable', 'high'])).toBe('high')
    expect(bestOf(['high', 'official', 'variable'])).toBe('official')
    expect(bestOf([])).toBe('variable')
  })
})

describe('Paris clock and digests', () => {
  it('follows Paris time in winter and summer', () => {
    expect(parisClock(new Date('2026-11-10T19:30:00Z'))).toEqual({ date: '2026-11-10', hour: 20 })
    expect(parisClock(new Date('2026-07-10T18:30:00Z'))).toEqual({ date: '2026-07-10', hour: 20 })
    expect(parisClock(new Date('2026-11-10T23:30:00Z'))).toEqual({ date: '2026-11-11', hour: 0 })
  })

  it('sends the morning digest from 8 am and the evening one from 8 pm, once each', () => {
    const at = (iso: string) => new Date(iso)
    expect(dueDigest(at('2026-11-10T06:59:00Z'), {})).toBeNull() // 7:59 Paris
    expect(dueDigest(at('2026-11-10T07:00:00Z'), {})).toBe('morning')
    expect(dueDigest(at('2026-11-10T12:00:00Z'), { morning: '2026-11-10' })).toBeNull()
    expect(dueDigest(at('2026-11-10T19:00:00Z'), { morning: '2026-11-10' })).toBe('evening')
    expect(dueDigest(at('2026-11-10T22:00:00Z'), { evening: '2026-11-10' })).toBeNull()
    // Down all day, back at 9 pm: only the evening digest.
    expect(dueDigest(at('2026-11-10T20:00:00Z'), {})).toBe('evening')
  })

  it('fetches official sources every 5 minutes and the rest every 15', () => {
    const now = new Date('2026-11-10T10:00:00Z')
    const ago = (min: number) => new Date(now.getTime() - min * 60_000)
    expect(isDue(null, 'normal', now)).toBe(true)
    expect(isDue(ago(5), 'fast', now)).toBe(true)
    expect(isDue(ago(5), 'normal', now)).toBe(false)
    expect(isDue(ago(15), 'normal', now)).toBe(true)
  })

  it('budget periods start at the UTC month and day', () => {
    const { month, day } = periodStarts(new Date('2026-11-10T15:00:00Z'))
    expect(month.toISOString()).toBe('2026-11-01T00:00:00.000Z')
    expect(day.toISOString()).toBe('2026-11-10T00:00:00.000Z')
  })
})

describe('triage answer handling', () => {
  const items: TriageItem[] = [
    { index: 0, title: 'GTA 6 trailer 3', summary: '', source: 'IGN' },
    { index: 1, title: 'GTA 6: third trailer is out', summary: '', source: 'VGC' },
    { index: 2, title: 'Best SSD deals', summary: '', source: 'PC Gamer' },
    { index: 3, title: 'More on the GTA trailer', summary: '', source: 'Kotaku' },
  ]

  it('groups items, joins open stories and skips the rest', () => {
    const d = decide(
      {
        new_stories: [
          {
            key: 'n1',
            title: ' GTA 6: trailer 3 ',
            game: 'GTA 6',
            category: 'news',
            significance: 140,
          },
        ],
        assignments: [
          { item: 0, story: 'N1' },
          { item: 1, story: 'n1' },
          { item: 2, story: 'skip' },
          { item: 3, story: 'S7' },
        ],
      },
      items,
      [{ id: 7, title: 'GTA 6 trailer' }],
    )
    expect(d.get(0)).toEqual({
      kind: 'new',
      story: {
        key: 'N1',
        title: 'GTA 6: trailer 3',
        game: 'GTA 6',
        category: 'news',
        significance: 100,
      },
    })
    expect(d.get(1)?.kind).toBe('new')
    expect(d.get(2)).toEqual({ kind: 'skip' })
    expect(d.get(3)).toEqual({ kind: 'existing', storyId: 7 })
  })

  it('treats anything odd as a skip instead of failing the batch', () => {
    const d = decide(
      {
        new_stories: [
          { key: 'N1', title: 'x', game: null, category: 'nonsense' as 'news', significance: 50 },
        ],
        assignments: [
          { item: 0, story: 'S99' }, // not an open story
          { item: 1, story: 'N9' }, // never defined
        ],
      },
      items,
      [],
    )
    expect(d.get(0)).toEqual({ kind: 'skip' })
    expect(d.get(1)).toEqual({ kind: 'skip' })
    expect(d.get(3)).toEqual({ kind: 'skip' }) // forgotten by the model
    expect(decide({} as never, items, []).get(0)).toEqual({ kind: 'skip' })
  })

  it('dry run makes one story per item', () => {
    const d = decide(dryRunAnswer(items), items, [])
    expect([...d.values()].every((x) => x.kind === 'new')).toBe(true)
  })

  it('the prompt lists articles, open stories with their game, and items', () => {
    const p = triagePrompt(
      items.slice(0, 1),
      [{ id: 7, title: 'GTA 6 trailer', game: 'GTA 6' }],
      [{ id: 29, title: 'PS5 passes 100 million units shipped' }],
    )
    expect(p).toContain('A29: PS5 passes 100 million units shipped')
    expect(p).toContain('S7: GTA 6 trailer [GTA 6]')
    expect(p).toContain('[0] (IGN) GTA 6 trailer 3')
    expect(triagePrompt(items.slice(0, 1), [])).toContain(
      'Already on Akavish (last 3 weeks):\n(none)',
    )
  })

  it('an item repeating a listed article is "covered", an unknown article is skipped', () => {
    const d = decide(
      {
        new_stories: [],
        assignments: [
          { item: 0, story: 'a29' },
          { item: 1, story: 'A404' },
        ],
      },
      items,
      [],
      [{ id: 29, title: 'PS5 passes 100 million units shipped' }],
    )
    expect(d.get(0)).toEqual({ kind: 'covered', articleId: 29 })
    expect(d.get(1)).toEqual({ kind: 'skip' })
  })
})

describe('digest messages', () => {
  const story = (score: number, n = 1) => ({
    title: `Story ${score}`,
    score,
    category: 'news',
    game: 'Game',
    sourceNames: Array.from({ length: n }, (_, i) => `Outlet ${i}`),
    url: 'https://x.example/a',
  })

  it('sorts by score, marks the threshold and splits by 10 embeds', () => {
    const msgs = digestMessages(
      'evening',
      [story(40), story(80, 3), ...Array.from({ length: 10 }, () => story(10))],
      60,
    )
    expect(msgs).toHaveLength(2)
    expect(msgs[0].content).toContain('12 sujets, dont 1 au-dessus du seuil (60)')
    expect(msgs[0].embeds?.[0]).toMatchObject({ title: '80 · Story 80', color: 0x10b981 })
    expect(msgs[0].embeds?.[0].description).toContain('3 sources')
    expect(msgs[0].embeds?.[1].color).toBe(0x52525b)
    expect(msgs[1].content).toBeUndefined()
  })

  it('says so when there is nothing new', () => {
    expect(digestMessages('morning', [], 60)[0].content).toContain('aucun nouveau sujet')
  })
})

describe('config and pricing', () => {
  it('is off by default and dry without an API key', () => {
    expect(scoutConfig({}).enabled).toBe(false)
    expect(scoutConfig({ SCOUT_ENABLED: 'true' }).dryRun).toBe(true)
    const live = scoutConfig({
      SCOUT_ENABLED: 'true',
      ANTHROPIC_API_KEY: 'k',
      SCOUT_MONTHLY_BUDGET_USD: 'abc',
    })
    expect(live.dryRun).toBe(false)
    expect(live.monthlyBudgetUsd).toBe(50)
  })

  it('prices Haiku cheaply and unknown models at the top rate', () => {
    expect(costUsd('claude-haiku-5-5', 1_000_000, 100_000)).toBeCloseTo(0.15)
    expect(costUsd('claude-sonnet-5-5', 10_000, 1_500)).toBeCloseTo(0.035)
    expect(costUsd('typo-model', 1_000_000, 0)).toBe(5)
  })
})

describe('callTool on models that refuse a forced tool', () => {
  it('retries with tool_choice auto and no up-front thinking, then remembers', async () => {
    resetToolModes()
    const bodies: Array<Record<string, unknown>> = []
    const fakeFetch = async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>
      bodies.push(body)
      if ((body.tool_choice as { type: string }).type === 'tool') {
        return new Response(
          '{"type":"error","error":{"type":"invalid_request_error","message":"tool_choice: type \\"tool\\" and \\"any\\" are not supported for this model."}}',
          { status: 400 },
        )
      }
      return Response.json({
        content: [
          { type: 'text', text: '' },
          { type: 'tool_use', name: 'record', input: { ok: true } },
        ],
        usage: { input_tokens: 10, output_tokens: 5 },
      })
    }
    const call = () =>
      callTool<{ ok: boolean }>({
        apiKey: 'k',
        model: 'model-without-forced-tools',
        system: 'Be brief.',
        prompt: 'Go',
        tool: { name: 'record', description: 'd', input_schema: { type: 'object' } },
        fetchImpl: fakeFetch,
      })
    expect((await call()).input).toEqual({ ok: true })
    expect(bodies).toHaveLength(2)
    expect(bodies[1]).toMatchObject({
      tool_choice: { type: 'auto' },
      thinking: { type: 'between_tools' },
    })
    expect(String(bodies[1].system)).toContain('Answer only by calling the record tool')
    await call()
    expect(bodies).toHaveLength(3) // straight to auto the second time
    expect(bodies[2]).toMatchObject({ tool_choice: { type: 'auto' } })
  })

  it('reports the text when the model answers without the tool', async () => {
    resetToolModes()
    const fakeFetch = async () =>
      Response.json({ content: [{ type: 'text', text: 'I cannot do that.' }], usage: {} })
    await expect(
      callTool({
        apiKey: 'k',
        model: 'm',
        system: 's',
        prompt: 'p',
        tool: { name: 'record', description: 'd', input_schema: { type: 'object' } },
        fetchImpl: fakeFetch,
      }),
    ).rejects.toThrow('I cannot do that.')
  })

  it('recognises the refusal', () => {
    expect(
      isForcedToolRefusal(400, 'tool_choice: type "tool" ... not supported for this model'),
    ).toBe(true)
    expect(isForcedToolRefusal(400, 'max_tokens too large')).toBe(false)
    expect(isForcedToolRefusal(500, 'tool_choice not supported')).toBe(false)
  })
})
