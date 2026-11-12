import { describe, expect, it } from 'vitest'
import { inline, parseFile, toLexical } from './publish-articles.mjs'

const SOURCE = `---
type: game
slug: gta-vi
name: Grand Theft Auto VI
---
---
type: article
slug: first
title: First: a title with a colon
publishAt: now
---
Intro with **bold** and a [link](https://example.com/a).

### A heading

- **One:** first
- Two

Second paragraph
on two lines.
---
type: article
slug: second
title: Second
---
Body.`

describe('publish-articles', () => {
  it('splits games and articles, keeping colons in values', () => {
    const blocks = parseFile(SOURCE)
    expect(blocks.map((b) => b.meta.slug)).toEqual(['gta-vi', 'first', 'second'])
    expect(blocks[0].body).toBe('')
    expect(blocks[1].meta.title).toBe('First: a title with a colon')
    expect(blocks[2].body).toBe('Body.')
  })

  it('turns bold and links into Lexical nodes', () => {
    const nodes = inline('a **b** [c](https://x.example/y) d')
    expect(nodes.map((n) => n.type)).toEqual(['text', 'text', 'text', 'link', 'text'])
    expect(nodes[1]).toMatchObject({ text: 'b', format: 1 })
    expect(nodes[3]).toMatchObject({ fields: { url: 'https://x.example/y', newTab: true } })
  })

  it('keeps site links in the same tab, with bold labels', () => {
    const [link] = inline('[**Fable**](/game/fable)')
    expect(link).toMatchObject({ type: 'link', fields: { url: '/game/fable', newTab: false } })
    expect(link.children[0]).toMatchObject({ text: 'Fable', format: 1 })
  })

  it('builds paragraphs, h2 headings and bullet lists', () => {
    const { root } = toLexical(parseFile(SOURCE)[1].body)
    expect(root.children.map((c) => c.type)).toEqual(['paragraph', 'heading', 'list', 'paragraph'])
    expect(root.children[1].tag).toBe('h2')
    expect(root.children[2].children).toHaveLength(2)
    expect(root.children[3].children[0].text).toBe('Second paragraph on two lines.')
  })
})
