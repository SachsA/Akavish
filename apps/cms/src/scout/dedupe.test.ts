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
      readDuplicate(
        { is_duplicate: true, duplicate_of: 29, rejected_like: 0, reason: 'Même chiffre' },
        covered,
      ),
    ).toEqual({
      article: { id: 29, title: 'PS5 passes 100 million units shipped, Sony confirms' },
      reason: 'Même chiffre',
    })
    expect(
      readDuplicate(
        { is_duplicate: true, duplicate_of: 999, rejected_like: 553, reason: '' },
        covered,
      ),
    ).toEqual({
      rejected: { id: 553, title: 'Nintendo ends Google sign-in' },
      reason: '',
    })
    expect(readDuplicate(undefined, covered)).toEqual({ reason: '' })
  })

  it('ignores the ids when the model says it is not a duplicate', () => {
    // Nov 15: "BLG beat Gen.G 3-1 to win LoL Worlds 2026" came back with the
    // preview article's id and a reason saying it was a new event.
    expect(
      readDuplicate(
        {
          is_duplicate: false,
          duplicate_of: 29,
          rejected_like: 553,
          reason: 'Le résultat est un nouvel événement, pas un doublon.',
        },
        covered,
      ),
    ).toEqual({ reason: 'Le résultat est un nouvel événement, pas un doublon.' })
    // No verdict at all (older answer shape): not a duplicate either.
    expect(readDuplicate({ duplicate_of: 29, rejected_like: 0, reason: '' }, covered)).toEqual({
      reason: '',
    })
  })
})
