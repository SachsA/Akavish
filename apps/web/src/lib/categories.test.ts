import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CATEGORIES, categoryBySlug, categoryByValue } from './categories'

describe('CATEGORIES', () => {
  it('has unique slugs and unique CMS values', () => {
    const slugs = CATEGORIES.map((c) => c.slug)
    const values = CATEGORIES.map((c) => c.value)
    expect(new Set(slugs).size).toBe(slugs.length)
    expect(new Set(values).size).toBe(values.length)
  })

  it('looks categories up both ways', () => {
    for (const c of CATEGORIES) {
      expect(categoryBySlug(c.slug)).toBe(c)
      expect(categoryByValue(c.value)).toBe(c)
    }
    expect(categoryBySlug('nope')).toBeUndefined()
  })

  // The web and the CMS each declare the category list. If they drift, an
  // article saved under a new CMS category would have no section on the site
  // (or a section would point at a value the CMS can't store). This reads the
  // CMS collection source directly so the two can't diverge silently.
  it('matches the category options of the CMS Articles collection', () => {
    const path = fileURLToPath(
      new URL('../../../cms/src/collections/Articles.ts', import.meta.url)
    )
    const source = readFileSync(path, 'utf8')
    const start = source.indexOf("name: 'category'")
    expect(start, "couldn't find the category field in Articles.ts").toBeGreaterThan(-1)
    const optionsBlock = source.slice(start, source.indexOf(']', start))
    const cmsValues = [...optionsBlock.matchAll(/value: '([a-z-]+)'/g)].map((m) => m[1])

    expect(cmsValues.length).toBeGreaterThan(0)
    expect([...cmsValues].sort()).toEqual(CATEGORIES.map((c) => c.value).sort())
  })
})
