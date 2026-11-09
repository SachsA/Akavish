import { describe, expect, it } from 'vitest'
import { linkTarget, parseLexical } from './lexical'

describe('parseLexical', () => {
  it('returns the top-level blocks of a Payload rich-text field', () => {
    const content = JSON.stringify({
      root: {
        type: 'root',
        children: [{ type: 'paragraph', children: [{ type: 'text', text: 'Hi' }] }],
      },
    })
    expect(parseLexical(content)).toHaveLength(1)
    expect(parseLexical(content)[0].type).toBe('paragraph')
  })

  it('returns no blocks for empty or broken content', () => {
    expect(parseLexical(undefined)).toEqual([])
    expect(parseLexical('null')).toEqual([])
    expect(parseLexical('{not json')).toEqual([])
    expect(parseLexical(JSON.stringify({ root: { type: 'root' } }))).toEqual([])
  })
})

describe('linkTarget', () => {
  it('opens web and mail links', () => {
    expect(linkTarget({ type: 'link', fields: { url: 'https://example.com' } })).toBe(
      'https://example.com',
    )
    expect(linkTarget({ type: 'autolink', url: 'mailto:tips@akavish.gg' })).toBe(
      'mailto:tips@akavish.gg',
    )
  })

  it("ignores links a phone can't open", () => {
    expect(linkTarget({ type: 'link', fields: { url: '/article/other' } })).toBeUndefined()
    expect(linkTarget({ type: 'link', fields: { url: 'javascript:alert(1)' } })).toBeUndefined()
    expect(linkTarget({ type: 'link' })).toBeUndefined()
  })
})
