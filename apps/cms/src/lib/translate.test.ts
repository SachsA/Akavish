import { describe, expect, it } from 'vitest'
import {
  applyTranslation,
  collectBlocks,
  fromMarkup,
  plainText,
  sourceHash,
  toMarkup,
} from './translate'

const text = (t: string, format = 0) => ({
  type: 'text',
  text: t,
  format,
  style: '',
  mode: 'normal',
  detail: 0,
  version: 1,
})
const link = (url: string, children: unknown[]) => ({
  type: 'link',
  version: 3,
  fields: { linkType: 'custom', url, newTab: true },
  children,
})
const block = (type: string, children: unknown[], extra = {}) => ({
  type,
  children,
  version: 1,
  ...extra,
})

const doc = {
  root: block('root', [
    block('heading', [text('Dated')], { tag: 'h2' }),
    block('list', [
      block('listitem', [text('Metro 2039', 1), text(' · Feb 4 (PS5). A <new> Metro & more.')]),
      block('listitem', [
        text('See '),
        link('https://www.hltv.org/x', [text('HLTV', 2)]),
        text(' for more'),
        block('list', [block('listitem', [text('nested')])]),
      ]),
    ]),
    block('paragraph', [text('Line one'), { type: 'linebreak', version: 1 }, text('line two')]),
  ]),
}

describe('markup', () => {
  it('turns bold, italics, links and line breaks into markup, escaping text', () => {
    const blocks = collectBlocks(doc.root as never)
    expect(blocks.map((b) => toMarkup(b.children as never).markup)).toEqual([
      'Dated',
      '<b>Metro 2039</b> · Feb 4 (PS5). A &lt;new&gt; Metro &amp; more.',
      'See <a n="0"><i>HLTV</i></a> for more',
      'nested',
      'Line one<br/>line two',
    ])
  })

  it('reads markup back into Lexical nodes', () => {
    const l = link('https://x.test', [text('old')])
    const nodes = fromMarkup(
      '<b>Metro 2039</b> · 4 févr. <a n="0"><i>HLTV</i></a> &amp; co<br/>fin',
      [l as never],
    )!
    expect(nodes.map((n) => [n.type, n.text ?? null, n.format ?? null])).toEqual([
      ['text', 'Metro 2039', 1],
      ['text', ' · 4 févr. ', 0],
      ['link', null, null],
      ['text', ' & co', 0],
      ['linebreak', null, null],
      ['text', 'fin', 0],
    ])
    expect((nodes[2] as unknown as { fields: unknown }).fields).toEqual(l.fields)
    expect((nodes[2].children as Array<{ text: string; format: number }>)[0]).toMatchObject({
      text: 'HLTV',
      format: 2,
    })
  })

  it('refuses broken markup', () => {
    expect(fromMarkup('<b>open', [])).toBeNull()
    expect(fromMarkup('</i>x', [])).toBeNull()
    expect(fromMarkup('<a n="3">x</a>', [])).toBeNull()
    expect(fromMarkup('<marquee>x</marquee>', [])).toBeNull()
    expect(plainText('<b>Metro</b> &amp; co')).toBe('Metro & co')
  })
})

describe('applyTranslation', () => {
  it('keeps the structure, replaces the words, keeps nested lists', () => {
    const fr = applyTranslation(doc, [
      'Avec une date',
      '<b>Metro 2039</b> · 4 févr. (PS5). Un nouveau Metro.',
      'Voir <a n="0"><i>HLTV</i></a> pour plus',
      'imbriqué',
      'Ligne un<br/>ligne deux',
    ]) as typeof doc
    const blocks = collectBlocks(fr.root as never)
    expect(blocks.map((b) => toMarkup(b.children as never).markup)).toEqual([
      'Avec une date',
      '<b>Metro 2039</b> · 4 févr. (PS5). Un nouveau Metro.',
      'Voir <a n="0"><i>HLTV</i></a> pour plus',
      'imbriqué',
      'Ligne un<br/>ligne deux',
    ])
    // The English document is untouched.
    expect(toMarkup(collectBlocks(doc.root as never)[0].children as never).markup).toBe('Dated')
    // Heading tag and the link's URL survive.
    expect(JSON.stringify(fr)).toContain('"tag":"h2"')
    expect(JSON.stringify(fr)).toContain('https://www.hltv.org/x')
  })

  it('falls back to plain text when a segment does not parse', () => {
    const fr = applyTranslation(doc, ['<b>Date', 'x', 'y', 'z', 'w']) as typeof doc
    expect(toMarkup(collectBlocks(fr.root as never)[0].children as never).markup).toBe('Date')
  })
})

describe('sourceHash', () => {
  it('changes with the English text only', () => {
    const a = sourceHash({ title: 'A', excerpt: 'B', content: doc, seo: { title: 'S' } })
    expect(sourceHash({ title: 'A', excerpt: 'B', content: doc, seo: { title: 'S' } })).toBe(a)
    expect(sourceHash({ title: 'A!', excerpt: 'B', content: doc, seo: { title: 'S' } })).not.toBe(a)
  })
})
