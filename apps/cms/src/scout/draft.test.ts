import { generateKeyPairSync, sign } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { closedMessage, draftMessage, pickMenu, verifyDiscordSignature } from './discord-bot'
import { blocksToText, cleanDraft, draftPrompt, toLexical, type DraftAnswer } from './draft-prompt'
import { extractArticleText } from './extract'

const answer = (over: Partial<DraftAnswer> = {}): DraftAnswer => ({
  title: '  GTA VI gets a third trailer ',
  excerpt: 'Rockstar released it on Tuesday.',
  category: 'news',
  blocks: [
    { type: 'paragraph', text: 'Rockstar released the third trailer.' },
    { type: 'heading', text: 'What it shows' },
    { type: 'list', items: ['Vice City at night', '', 'Lucia and Jason'] },
    { type: 'quote', text: '"See you in November", Rockstar said.' },
  ],
  seo_description: 'The third GTA VI trailer is out.',
  ...over,
})

describe('cleanDraft', () => {
  it('trims, drops empty list items and keeps the blocks in order', () => {
    const d = cleanDraft(answer(), 'leak')
    expect(d.title).toBe('GTA VI gets a third trailer')
    expect(d.blocks.map((b) => b.type)).toEqual(['paragraph', 'heading', 'list', 'quote'])
    expect(d.blocks[2]).toEqual({ type: 'list', items: ['Vice City at night', 'Lucia and Jason'] })
  })

  it('falls back on the story category and on the first paragraph for the excerpt', () => {
    const d = cleanDraft(answer({ category: 'gossip' as never, excerpt: '' }), 'leak')
    expect(d.category).toBe('leak')
    expect(d.excerpt).toBe('Rockstar released the third trailer.')
  })

  it('refuses an answer without a title or a paragraph', () => {
    expect(() => cleanDraft(answer({ title: ' ' }), 'news')).toThrow()
    expect(() =>
      cleanDraft(answer({ blocks: [{ type: 'heading', text: 'Only a heading' }] }), 'news'),
    ).toThrow()
    expect(() => cleanDraft({} as never, 'news')).toThrow()
  })

  it('keeps the picked video numbers, valid and once each', () => {
    expect(cleanDraft(answer({ videos: [2, 2, 0, 1.5, -1, 1] }), 'news').videos).toEqual([2, 1])
    expect(cleanDraft(answer(), 'news').videos).toEqual([])
  })
})

describe('toLexical', () => {
  it('builds Payload rich text with a Sources list of links', () => {
    const { root } = toLexical(cleanDraft(answer(), 'news').blocks, [
      { name: 'IGN', url: 'https://ign.example/gta', title: 'GTA 6 trailer 3' },
    ])
    const types = root.children.map((c) => (c as { type: string }).type)
    expect(types).toEqual(['paragraph', 'heading', 'list', 'quote', 'heading', 'list'])
    const sources = root.children.at(-1) as {
      children: Array<{ children: Array<Record<string, unknown>> }>
    }
    const link = sources.children[0].children[1]
    expect(link).toMatchObject({
      type: 'link',
      fields: { url: 'https://ign.example/gta', newTab: true },
    })
  })

  it('adds a Watch list of video links before the Sources', () => {
    const { root } = toLexical(
      [{ type: 'paragraph', text: 'x' }],
      [{ name: 'IGN', url: 'https://ign.example/gta', title: 'GTA 6 trailer 3' }],
      [
        {
          title: 'Grand Theft Auto VI Trailer 3',
          channel: 'Rockstar Games',
          url: 'https://www.youtube.com/watch?v=QdBZY2fkU-0',
        },
      ],
    )
    const kids = root.children as Array<{
      type: string
      children: Array<{ text?: string; children: Array<Record<string, unknown>> }>
    }>
    expect(kids.map((c) => c.type)).toEqual(['paragraph', 'heading', 'list', 'heading', 'list'])
    expect(kids[1].children[0].text).toBe('Watch')
    expect(kids[2].children[0].children[1]).toMatchObject({
      type: 'link',
      fields: { url: 'https://www.youtube.com/watch?v=QdBZY2fkU-0', newTab: true },
    })
    expect(kids[3].children[0].text).toBe('Sources')
  })

  it('has no Sources heading when there are no sources', () => {
    const { root } = toLexical([{ type: 'paragraph', text: 'x' }], [])
    expect(root.children).toHaveLength(1)
  })
})

describe('draftPrompt', () => {
  const sources = [
    {
      name: 'Rockstar',
      url: 'https://r.example',
      title: 'Trailer 3',
      text: 'Full text.',
      reliability: 'official' as const,
    },
    {
      name: 'Leaker',
      url: 'https://x.example',
      title: 'Rumour',
      text: '',
      reliability: 'variable' as const,
    },
  ]

  it('labels each source and its reliability', () => {
    const p = draftPrompt({ storyTitle: 'GTA VI trailer 3', sources })
    expect(p).toContain('Source 1: Rockstar (official source)')
    expect(p).toContain('Source 2: Leaker (leaker / unverified)')
    expect(p).toContain('(no text available, title only)')
    expect(p).not.toContain('feedback')
  })

  it('lists the videos found, numbered, with their channel', () => {
    const p = draftPrompt({
      storyTitle: 'x',
      sources,
      videos: [{ title: 'Trailer 3', channel: 'Rockstar Games', url: 'https://youtu.be/x' }],
    })
    expect(p).toContain('[1] "Trailer 3" (YouTube channel: Rockstar Games)')
    expect(draftPrompt({ storyTitle: 'x', sources })).not.toContain('Videos found')
  })

  it('includes the previous version and the feedback for a revision', () => {
    const p = draftPrompt({
      storyTitle: 'x',
      sources,
      previous: { title: 'Old headline', body: 'Old body' },
      feedback: 'Shorter, and mention the price',
    })
    expect(p).toContain('Old headline')
    expect(p).toContain("The editor's feedback")
    expect(p).toContain('Shorter, and mention the price')
  })

  it('blocksToText gives a readable plain version', () => {
    expect(blocksToText(cleanDraft(answer(), 'news').blocks)).toContain(
      '## What it shows\n\n• Vice City at night',
    )
  })
})

describe('extractArticleText', () => {
  it('keeps the article paragraphs and drops the noise', () => {
    const html = `<html><body><nav><p>Home News Reviews and a long enough menu line to be kept otherwise</p></nav>
      <article><h1>Title</h1><p>By Someone</p>
      <p>Rockstar has released the third trailer for Grand Theft Auto VI, ahead of its November launch.</p>
      <figure><p>A caption that is long enough to pass the length filter but sits in a figure</p></figure>
      <p>The trailer runs for two minutes and focuses on <a href="#">Lucia</a> and Jason in Vice City.</p></article>
      <footer><p>Copyright notice that is long enough to pass the filter but sits in the footer</p></footer></body></html>`
    expect(extractArticleText(html)).toBe(
      'Rockstar has released the third trailer for Grand Theft Auto VI, ahead of its November launch.\n\nThe trailer runs for two minutes and focuses on Lucia and Jason in Vice City.',
    )
  })
})

describe('Discord bot', () => {
  it('verifies Discord signatures (Ed25519 over timestamp + body)', () => {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519')
    const rawPub = publicKey.export({ format: 'der', type: 'spki' }).subarray(12).toString('hex')
    const body = '{"type":1}'
    const ts = '1731240000'
    const sig = sign(null, Buffer.from(ts + body), privateKey).toString('hex')
    expect(verifyDiscordSignature(rawPub, sig, ts, body)).toBe(true)
    expect(verifyDiscordSignature(rawPub, sig, ts, '{"type":2}')).toBe(false)
    expect(verifyDiscordSignature(rawPub, sig, '1731240001', body)).toBe(false)
    expect(verifyDiscordSignature(rawPub, null, ts, body)).toBe(false)
    expect(verifyDiscordSignature(rawPub, 'zz', ts, body)).toBe(false)
  })

  const card = {
    storyId: 12,
    articleId: 34,
    version: 2,
    score: 81,
    title: 'GTA VI gets a third trailer',
    excerpt: 'Out now.',
    body: 'Body text.',
    category: 'news',
    sources: [{ name: 'IGN', url: 'https://ign.example/gta' }],
    adminUrl: 'https://cms.example/admin/collections/articles/34',
    feedback: 'Shorter',
  }

  it('draft messages carry the three buttons and the admin link', () => {
    const m = draftMessage(card)
    const buttons = (m.components?.[0] as { components: Array<Record<string, unknown>> }).components
    expect(buttons.map((b) => b.custom_id ?? b.url)).toEqual([
      'scout:publish:12',
      'scout:edit:12',
      'scout:reject:12',
      card.adminUrl,
    ])
    expect(m.content).toContain('V2')
    expect(m.embeds?.[0].fields?.find((f) => f.name === 'Sources')?.value).toBe(
      '[IGN](https://ign.example/gta)',
    )
  })

  it('closing a message removes its buttons and keeps the embed', () => {
    const closed = closedMessage(draftMessage(card), 'Publié', 0x10b981)
    expect(closed.components).toEqual([])
    expect(closed.embeds?.[0]).toMatchObject({
      title: card.title,
      color: 0x10b981,
      footer: { text: 'Publié' },
    })
  })

  it('the digest menu lists up to 25 stories', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ id: i, score: 50, title: `Story ${i}` }))
    const select = (pickMenu(many)[0] as { components: Array<{ options: unknown[] }> })
      .components[0]
    expect(select.options).toHaveLength(25)
    expect(pickMenu([])).toEqual([])
  })
})
