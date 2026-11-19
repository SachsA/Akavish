import { describe, expect, it } from 'vitest'
import { MAX_TAGS, TAGS, cleanTags, isValidSecret } from './revalidate'

describe('isValidSecret', () => {
  it('accepts the exact secret only', () => {
    expect(isValidSecret('s3cret-value', 's3cret-value')).toBe(true)
    expect(isValidSecret('s3cret-valuX', 's3cret-value')).toBe(false)
    expect(isValidSecret('short', 's3cret-value')).toBe(false)
  })

  it('refuses everything when no secret is configured or none is given', () => {
    expect(isValidSecret('anything', undefined)).toBe(false)
    expect(isValidSecret('anything', '')).toBe(false)
    expect(isValidSecret(null, 's3cret-value')).toBe(false)
  })
})

describe('cleanTags', () => {
  it('keeps the known shapes, once each', () => {
    expect(cleanTags(['articles', 'article:gta-6-trailer', 'game:gta-6', 'articles', 'platform:ps5'])).toEqual([
      'articles',
      'article:gta-6-trailer',
      'game:gta-6',
      'platform:ps5',
    ])
  })

  it('drops anything else', () => {
    expect(cleanTags(['cms', 'foo:bar', 'game:', 'game:a b', 42, null])).toEqual([])
    expect(cleanTags('articles')).toEqual([])
    expect(cleanTags(undefined)).toEqual([])
  })

  it('caps the list', () => {
    const many = Array.from({ length: MAX_TAGS + 20 }, (_, i) => `game:g${i}`)
    expect(cleanTags(many)).toHaveLength(MAX_TAGS)
  })
})

describe('TAGS', () => {
  it('builds the strings the CMS sends (apps/cms/src/lib/revalidate-web.ts)', () => {
    expect(TAGS.article('a')).toBe('article:a')
    expect(TAGS.game('b')).toBe('game:b')
    expect(TAGS.tag('c')).toBe('tag:c')
    expect(TAGS.author('d')).toBe('author:d')
    expect(TAGS.company('e')).toBe('company:e')
    expect(TAGS.platform('f')).toBe('platform:f')
  })
})
