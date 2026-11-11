import { describe, expect, it } from 'vitest'
import { isPublicChange } from './revalidate-web'

describe('isPublicChange', () => {
  it('ignores drafts that never were public', () => {
    expect(
      isPublicChange({ _status: 'draft', status: 'draft' }, { _status: 'draft', status: 'draft' }),
    ).toBe(false)
    expect(isPublicChange({ _status: 'draft', status: 'draft' })).toBe(false)
  })

  it('counts a publish, an edit of a live article and an unpublish', () => {
    expect(
      isPublicChange(
        { _status: 'published', status: 'published' },
        { _status: 'draft', status: 'draft' },
      ),
    ).toBe(true)
    expect(
      isPublicChange(
        { _status: 'published', status: 'published' },
        { _status: 'published', status: 'published' },
      ),
    ).toBe(true)
    expect(
      isPublicChange(
        { _status: 'draft', status: 'draft' },
        { _status: 'published', status: 'published' },
      ),
    ).toBe(true)
  })

  it('always counts collections without drafts (games, tags, authors)', () => {
    expect(isPublicChange({}, {})).toBe(true)
  })
})
