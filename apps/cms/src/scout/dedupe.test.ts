import { describe, expect, it } from 'vitest'
import { dedupePrompt, readDuplicate, type Covered } from './dedupe'

const covered: Covered = {
  articles: [
    { id: 29, title: 'PS5 passes 100 million units shipped, Sony confirms', excerpt: 'Sony says…' },
    { id: 22, title: 'PlayStation Plus Game Catalog November 2026' },
  ],
  rejected: [{ id: 553, title: 'Nintendo ends Google sign-in', reason: 'inutile' }],
}

describe('dedupePrompt', () => {
  it('lists the story, its headlines, the articles and the rejected stories with ids', () => {
    const p = dedupePrompt(
      { title: 'PlayStation 5 surpasses 100 million units sold', sourceTitles: ['PS5 hits 100M'] },
      covered,
    )
    expect(p).toContain('Story: PlayStation 5 surpasses 100 million units sold')
    expect(p).toContain('- PS5 hits 100M')
    expect(p).toContain('[29] PS5 passes 100 million units shipped, Sony confirms | Sony says…')
    expect(p).toContain('[553] Nintendo ends Google sign-in (rejected: inutile)')
  })

  it('says (none) for empty lists', () => {
    expect(
      dedupePrompt({ title: 'x', sourceTitles: [] }, { articles: [], rejected: [] }),
    ).toContain('drafts\n(none)')
  })
})

describe('readDuplicate', () => {
  it('keeps only ids that are in the lists', () => {
    expect(
      readDuplicate({ duplicate_of: 29, rejected_like: 0, reason: 'Même chiffre' }, covered),
    ).toEqual({
      article: { id: 29, title: 'PS5 passes 100 million units shipped, Sony confirms' },
      reason: 'Même chiffre',
    })
    expect(readDuplicate({ duplicate_of: 999, rejected_like: 553, reason: '' }, covered)).toEqual({
      rejected: { id: 553, title: 'Nintendo ends Google sign-in' },
      reason: '',
    })
    expect(readDuplicate(undefined, covered)).toEqual({ reason: '' })
  })
})
